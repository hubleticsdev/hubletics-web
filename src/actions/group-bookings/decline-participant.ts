'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { getGroupLessonDeclinedEmailTemplate } from '@/lib/email/templates/group-booking-notifications';
import { revalidatePath } from 'next/cache';
import { formatDateOnly } from '@/lib/utils/date';
import { recordPaymentEvent } from '@/lib/payment-audit';
import { recordStateTransition } from '@/lib/booking-audit';

export async function declineParticipant(bookingId: string, participantId: string, reason?: string) {
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
      return { success: false, error: 'Cannot decline - participant already paid. Use cancel/refund instead.' };
    }

    if (participant.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(participant.stripePaymentIntentId);
        console.log(`[DECLINE_PARTICIPANT] Cancelled PaymentIntent ${participant.stripePaymentIntentId} for participant ${participantId}`);
      } catch (stripeError: unknown) {
        console.error('[DECLINE_PARTICIPANT] Stripe cancel error:', stripeError);
        
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(participant.stripePaymentIntentId);
          
          if (paymentIntent.status === 'succeeded') {
            return {
              success: false,
              error: 'Participant payment has been processed. Please use the refund feature instead of declining.',
            };
          }
          
          console.log(`[DECLINE_PARTICIPANT] PaymentIntent status: ${paymentIntent.status}, safe to continue`);
        } catch (retrieveError) {
          console.error('[DECLINE_PARTICIPANT] Could not retrieve PaymentIntent:', retrieveError);
          return {
            success: false,
            error: 'Could not verify payment status. Please try again or contact support.',
          };
        }
      }
    }

    const oldPaymentStatus = participant.paymentStatus;
    const oldStatus = participant.status;

    await db
      .update(bookingParticipant)
      .set({
        paymentStatus: 'cancelled',
        status: 'declined',
        cancelledAt: new Date(),
      })
      .where(eq(bookingParticipant.id, participantId));

    if (participant.stripePaymentIntentId) {
      await recordPaymentEvent({
        bookingId,
        participantId,
        stripePaymentIntentId: participant.stripePaymentIntentId,
        amountCents: participant.amountCents ?? 0,
        status: 'cancelled',
      });
    }

    await recordStateTransition({
      bookingId,
      participantId,
      field: 'paymentStatus',
      oldStatus: oldPaymentStatus,
      newStatus: 'cancelled',
      changedBy: session.user.id,
      reason,
    });

    await recordStateTransition({
      bookingId,
      participantId,
      field: 'status',
      oldStatus: oldStatus,
      newStatus: 'declined',
      changedBy: session.user.id,
      reason,
    });

    const startDate = new Date(bookingRecord.scheduledStartAt);
    const participantUser = participant.user as { id: string; name: string; email: string; timezone: string };

    const participantTimezone = participantUser.timezone || 'America/Chicago';
    const lessonDate = formatDateOnly(startDate, participantTimezone);

    const emailTemplate = getGroupLessonDeclinedEmailTemplate(
      participantUser.name,
      bookingRecord.coach.name,
      lessonDate,
      reason
    );

    await sendEmail({
      to: participantUser.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`[DECLINE_PARTICIPANT] Participant ${participantId} declined for booking ${bookingId}`);

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/coach');
    return { success: true };
  } catch (error) {
    console.error('Decline participant error:', error);
    return { success: false, error: 'Failed to decline participant' };
  }
}
