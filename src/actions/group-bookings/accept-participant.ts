'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant, publicGroupLessonDetails } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { getGroupLessonAcceptedEmailTemplate } from '@/lib/email/templates/group-booking-notifications';
import { revalidatePath } from 'next/cache';
import { formatDateOnly, formatTimeOnly } from '@/lib/utils/date';
import { recordPaymentEvent } from '@/lib/payment-audit';
import { recordStateTransition } from '@/lib/booking-audit';

export async function acceptParticipant(bookingId: string, participantId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.coachId, session.user.id),
        eq(booking.bookingType, 'public_group')
      ),
      with: {
        coach: {
          columns: {
            name: true,
            email: true,
          },
        },
        publicGroupDetails: true,
      },
    });

    if (!bookingRecord || bookingRecord.bookingType !== 'public_group') {
      return { success: false, error: 'Not a public group lesson' };
    }

    const participant = await db.query.bookingParticipant.findFirst({
      where: and(
        eq(bookingParticipant.id, participantId),
        eq(bookingParticipant.bookingId, bookingId)
      ),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            timezone: true,
          },
        },
      },
    });

    if (!participant) {
      return { success: false, error: 'Participant not found' };
    }

    if (participant.paymentStatus === 'captured') {
      return { success: false, error: 'Participant already accepted' };
    }

    if (!participant.stripePaymentIntentId) {
      return { success: false, error: 'No payment intent found for this participant' };
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(participant.stripePaymentIntentId);

      if (paymentIntent.status !== 'requires_capture') {
        console.error(`[ACCEPT_PARTICIPANT] Invalid PaymentIntent status: ${paymentIntent.status} for ${participant.stripePaymentIntentId}`);
        return {
          success: false,
          error: `Cannot capture payment - status is '${paymentIntent.status}'. Client may not have completed payment.`
        };
      }
    } catch (stripeError: unknown) {
      console.error('[ACCEPT_PARTICIPANT] Failed to retrieve PaymentIntent:', stripeError);
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown error';
      return { success: false, error: `Failed to verify payment status: ${errorMessage}` };
    }

    try {
      await stripe.paymentIntents.capture(participant.stripePaymentIntentId);
      console.log(`[ACCEPT_PARTICIPANT] Captured payment ${participant.stripePaymentIntentId} for participant ${participantId}`);
    } catch (stripeError: unknown) {
      console.error('[ACCEPT_PARTICIPANT] Stripe capture error:', stripeError);
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown error';
      return { success: false, error: `Payment capture failed: ${errorMessage}` };
    }

    const oldPaymentStatus = participant.paymentStatus;
    const oldStatus = participant.status;

    await db
      .update(bookingParticipant)
      .set({
        paymentStatus: 'captured',
        status: 'accepted',
        capturedAt: new Date(),
      })
      .where(eq(bookingParticipant.id, participantId));

    // Update public group lesson details counters
    if (bookingRecord.publicGroupDetails) {
      await db
        .update(publicGroupLessonDetails)
        .set({
          currentParticipants: sql`${publicGroupLessonDetails.currentParticipants} + 1`,
          capturedParticipants: sql`${publicGroupLessonDetails.capturedParticipants} + 1`,
        })
        .where(eq(publicGroupLessonDetails.bookingId, bookingId));
    }

    // Record audit events
    await recordPaymentEvent({
      bookingId,
      participantId,
      stripePaymentIntentId: participant.stripePaymentIntentId,
      amountCents: participant.amountCents ?? 0,
      status: 'captured',
    });

    await recordStateTransition({
      bookingId,
      participantId,
      field: 'paymentStatus',
      oldStatus: oldPaymentStatus,
      newStatus: 'captured',
      changedBy: session.user.id,
    });

    await recordStateTransition({
      bookingId,
      participantId,
      field: 'status',
      oldStatus: oldStatus,
      newStatus: 'accepted',
      changedBy: session.user.id,
    });

    // Check if lesson is now full
    const updatedDetails = await db.query.publicGroupLessonDetails.findFirst({
      where: eq(publicGroupLessonDetails.bookingId, bookingId),
      columns: {
        currentParticipants: true,
        maxParticipants: true,
      },
    });

    if (
      updatedDetails &&
      updatedDetails.currentParticipants >= updatedDetails.maxParticipants
    ) {
      await db
        .update(publicGroupLessonDetails)
        .set({
          capacityStatus: 'full',
        })
        .where(eq(publicGroupLessonDetails.bookingId, bookingId));

      console.log(`[ACCEPT_PARTICIPANT] Lesson ${bookingId} is now full (${updatedDetails.currentParticipants}/${updatedDetails.maxParticipants})`);
    }

    const startDate = new Date(bookingRecord.scheduledStartAt);
    const endDate = new Date(bookingRecord.scheduledEndAt);
    const participantUser = participant.user as { id: string; name: string; email: string; timezone: string };

    const participantTimezone = participantUser.timezone || 'America/Chicago';

    const lessonDate = formatDateOnly(startDate, participantTimezone);
    const startTime = formatTimeOnly(startDate, participantTimezone);
    const endTime = formatTimeOnly(endDate, participantTimezone);
    const lessonTime = `${startTime} - ${endTime}`;

    const location = bookingRecord.location
      ? `${bookingRecord.location.name}, ${bookingRecord.location.address}`
      : undefined;

    const emailTemplate = getGroupLessonAcceptedEmailTemplate(
      participantUser.name,
      'Group Lesson',
      lessonDate,
      lessonTime,
      bookingRecord.coach?.name || 'Coach',
      location
    );

    await sendEmail({
      to: participantUser.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`[ACCEPT_PARTICIPANT] Participant ${participantId} accepted for booking ${bookingId}`);

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/coach');
    return { success: true };
  } catch (error) {
    console.error('Accept participant error:', error);
    return { success: false, error: 'Failed to accept participant' };
  }
}
