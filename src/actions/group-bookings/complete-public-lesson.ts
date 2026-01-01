'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant, coachProfile, publicGroupLessonDetails } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { transferToCoach } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { revalidatePath } from 'next/cache';
import { formatDateOnly } from '@/lib/utils/date';
import { recordStateTransition } from '@/lib/booking-audit';
import { incrementCoachLessonsCompleted } from '@/lib/coach-stats';

// Aggregates all captured participant payments and creates a single transfer to the coach.
export async function completePublicLesson(bookingId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const lesson = await db.query.booking.findFirst({
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
            timezone: true,
          },
        },
        publicGroupDetails: true,
      },
    });

    if (!lesson) {
      return { success: false, error: 'Lesson not found or unauthorized' };
    }

    if (lesson.fulfillmentStatus === 'completed') {
      return { success: false, error: 'Lesson already completed' };
    }

    const now = new Date();
    if (now < new Date(lesson.scheduledStartAt)) {
      return { success: false, error: 'Cannot complete a lesson before it has started' };
    }

    const capturedParticipants = await db.query.bookingParticipant.findMany({
      where: and(
        eq(bookingParticipant.bookingId, bookingId),
        eq(bookingParticipant.paymentStatus, 'captured')
      ),
      with: {
        user: {
          columns: {
            name: true,
            email: true,
            timezone: true,
          },
        },
      },
    });

    if (capturedParticipants.length === 0) {
      return { success: false, error: 'No captured participants to pay out' };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, lesson.coachId),
      columns: {
        stripeAccountId: true,
      },
      with: {
        user: {
          columns: {
            platformFeePercentage: true,
          },
        },
      },
    });

    if (!coach?.stripeAccountId) {
      return { success: false, error: 'Coach Stripe account not configured' };
    }

    if (!lesson.publicGroupDetails?.pricePerPerson) {
      return { success: false, error: 'Lesson pricing not configured' };
    }

    const coachRatePerPerson = parseFloat(lesson.publicGroupDetails.pricePerPerson);
    const participantCount = capturedParticipants.length;
    const coachPayoutCents = Math.round(coachRatePerPerson * 100 * participantCount);

    console.log(`[COMPLETE_PUBLIC] Coach payout: $${coachRatePerPerson} × ${participantCount} participants = $${coachPayoutCents / 100}`);

    const transfer = await transferToCoach(
      coachPayoutCents / 100,
      coach.stripeAccountId,
      {
        bookingId: lesson.id,
        paymentIntentId: `aggregate_${capturedParticipants.length}_participants`,
        coachId: lesson.coachId,
      }
    );

    console.log(`[COMPLETE_PUBLIC] Aggregate transfer ${transfer.id}: $${coachPayoutCents / 100} for ${capturedParticipants.length} participants`);

    const oldFulfillmentStatus = lesson.fulfillmentStatus;

    await db
      .update(booking)
      .set({
        fulfillmentStatus: 'completed',
        coachConfirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    // Update public group lesson details with transfer info
    await db
      .update(publicGroupLessonDetails)
      .set({
        stripeTransferId: transfer.id,
      })
      .where(eq(publicGroupLessonDetails.bookingId, bookingId));

    // Update all captured participants to completed
    await db
      .update(bookingParticipant)
      .set({
        status: 'completed',
      })
      .where(
        and(
          eq(bookingParticipant.bookingId, bookingId),
          eq(bookingParticipant.paymentStatus, 'captured')
        )
      );

    await incrementCoachLessonsCompleted(lesson.coachId);

    await recordStateTransition({
      bookingId,
      field: 'fulfillmentStatus',
      oldStatus: oldFulfillmentStatus,
      newStatus: 'completed',
      changedBy: session.user.id,
    });

    for (const participant of capturedParticipants) {
      await recordStateTransition({
        bookingId,
        participantId: participant.id,
        field: 'status',
        oldStatus: participant.status,
        newStatus: 'completed',
        changedBy: session.user.id,
      });
    }

    const startDate = new Date(lesson.scheduledStartAt);

    for (const participant of capturedParticipants) {
      const participantTimezone = participant.user.timezone || 'America/Chicago';
      const lessonDate = formatDateOnly(startDate, participantTimezone);

      await sendEmail({
        to: participant.user.email,
        subject: `Lesson Completed - Thank you!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B4A;">Lesson Completed</h2>
            <p>Hi ${participant.user.name},</p>
            <p>Your group lesson on <strong>${lessonDate}</strong> with ${lesson.coach.name} has been marked as complete.</p>
            <p>Thank you for using Hubletics!</p>
            <p style="margin: 30px 0; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/coaches/${lesson.coachId}"
                 style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Book Again
              </a>
            </p>
          </div>
        `,
        text: `Hi ${participant.user.name}, your group lesson on ${lessonDate} with ${lesson.coach.name} has been marked as complete. Thank you for using Hubletics!`,
      });
    }

    console.log(`[COMPLETE_PUBLIC] Public lesson ${bookingId} completed with ${capturedParticipants.length} participants`);

    revalidatePath('/dashboard/coach');
    revalidatePath('/dashboard/bookings');

    return {
      success: true,
      participantsCompleted: capturedParticipants.length,
      totalPayout: coachPayoutCents / 100,
    };
  } catch (error) {
    console.error('Complete public lesson error:', error);
    return { success: false, error: 'Failed to complete lesson' };
  }
}
