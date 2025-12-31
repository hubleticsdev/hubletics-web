'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant, publicGroupLessonDetails, privateGroupBookingDetails } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { refundBookingPayment } from '@/lib/stripe';
import { revalidatePath } from 'next/cache';
import { recordPaymentEvent } from '@/lib/payment-audit';
import { recordStateTransition } from '@/lib/booking-audit';
import { sendEmail } from '@/lib/email/resend';
import { formatDateOnly, formatTimeOnly } from '@/lib/utils/date';

export async function leavePublicLesson(lessonId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const participant = await db.query.bookingParticipant.findFirst({
      where: and(
        eq(bookingParticipant.bookingId, lessonId),
        eq(bookingParticipant.userId, session.user.id)
      ),
    });

    if (!participant) {
      return { success: false, error: 'You are not part of this lesson' };
    }

    const lesson = await db.query.booking.findFirst({
      where: eq(booking.id, lessonId),
      with: {
        publicGroupDetails: true,
      },
    });

    if (!lesson || lesson.bookingType !== 'public_group') {
      return { success: false, error: 'Lesson not found or not a public group lesson' };
    }

    if (new Date() >= new Date(lesson.scheduledStartAt)) {
      return { success: false, error: 'Cannot leave a lesson that has already started' };
    }

    const participantCaptured = participant.paymentStatus === 'captured';

    if (participantCaptured && participant.stripePaymentIntentId) {
      await refundBookingPayment(participant.stripePaymentIntentId);

      await recordPaymentEvent({
        bookingId: lessonId,
        participantId: participant.id,
        stripePaymentIntentId: participant.stripePaymentIntentId,
        amountCents: participant.amountCents ?? 0,
        status: 'refunded',
      });
    }

    await recordStateTransition({
      bookingId: lessonId,
      participantId: participant.id,
      field: 'status',
      oldStatus: participant.status,
      newStatus: 'cancelled',
      changedBy: session.user.id,
      reason: 'Participant left lesson',
    });

    await db
      .delete(bookingParticipant)
      .where(and(
        eq(bookingParticipant.bookingId, lessonId),
        eq(bookingParticipant.userId, session.user.id)
      ));

    if (lesson.publicGroupDetails && participantCaptured) {
      const newCurrentParticipants = Math.max(0, lesson.publicGroupDetails.currentParticipants - 1);
      const newCapturedParticipants = Math.max(0, lesson.publicGroupDetails.capturedParticipants - 1);

      // Revert capacity status to 'open' if lesson was full
      const wasFullNowHasSpace =
        lesson.publicGroupDetails.capacityStatus === 'full' &&
        newCurrentParticipants < lesson.publicGroupDetails.maxParticipants;

      await db
        .update(publicGroupLessonDetails)
        .set({
          currentParticipants: newCurrentParticipants,
          capturedParticipants: newCapturedParticipants,
          ...(wasFullNowHasSpace ? { capacityStatus: 'open' } : {}),
        })
        .where(eq(publicGroupLessonDetails.bookingId, lessonId));

      if (wasFullNowHasSpace) {
        console.log(`[LEAVE_PUBLIC] Lesson ${lessonId} capacity reopened (${newCurrentParticipants}/${lesson.publicGroupDetails.maxParticipants})`);
      }
    }

    console.log(`User ${session.user.id} left public lesson ${lessonId}`);

    revalidatePath('/dashboard/bookings');
    revalidatePath(`/coaches/${lesson.coachId}`);

    return { success: true };
  } catch (error) {
    console.error('Leave public lesson error:', error);
    return { success: false, error: 'Failed to leave lesson' };
  }
}

export async function cancelPrivateGroupBooking(bookingId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.bookingType, 'private_group')
      ),
      with: {
        privateGroupDetails: true,
        coach: {
          columns: {
            name: true,
          },
        },
      },
    });

    // Check if user is the organizer
    if (!bookingRecord || bookingRecord.privateGroupDetails?.organizerId !== session.user.id) {
      return { success: false, error: 'Booking not found or you are not the organizer' };
    }

    if (new Date() >= new Date(bookingRecord.scheduledStartAt)) {
      return { success: false, error: 'Cannot cancel a lesson that has already started' };
    }

    const participants = await db.query.bookingParticipant.findMany({
      where: and(
        eq(bookingParticipant.bookingId, bookingId),
        ne(bookingParticipant.userId, session.user.id)
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

    const oldApprovalStatus = bookingRecord.approvalStatus;
    const oldPaymentStatus = bookingRecord.privateGroupDetails?.paymentStatus;
    const newPaymentStatus = bookingRecord.privateGroupDetails?.paymentStatus === 'captured' ? 'refunded' : bookingRecord.privateGroupDetails?.paymentStatus;

    if (bookingRecord.privateGroupDetails?.stripePaymentIntentId && bookingRecord.privateGroupDetails.paymentStatus === 'captured') {
      await refundBookingPayment(bookingRecord.privateGroupDetails.stripePaymentIntentId);

      await recordPaymentEvent({
        bookingId,
        stripePaymentIntentId: bookingRecord.privateGroupDetails.stripePaymentIntentId,
        amountCents: bookingRecord.privateGroupDetails.totalGrossCents ?? 0,
        status: 'refunded',
      });
    }

    await db
      .update(booking)
      .set({
        approvalStatus: 'cancelled',
        cancelledBy: session.user.id,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    if (bookingRecord.privateGroupDetails && newPaymentStatus) {
      await db
        .update(privateGroupBookingDetails)
        .set({
          paymentStatus: newPaymentStatus,
        })
        .where(eq(privateGroupBookingDetails.bookingId, bookingId));
    }

    // Update all participant statuses to cancelled
    await db
      .update(bookingParticipant)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
      })
      .where(eq(bookingParticipant.bookingId, bookingId));

    await recordStateTransition({
      bookingId,
      field: 'approvalStatus',
      oldStatus: oldApprovalStatus,
      newStatus: 'cancelled',
      changedBy: session.user.id,
      reason: 'Organizer cancelled booking',
    });

    if (newPaymentStatus !== oldPaymentStatus) {
      await recordStateTransition({
        bookingId,
        field: 'paymentStatus',
        oldStatus: oldPaymentStatus,
        newStatus: newPaymentStatus,
        changedBy: session.user.id,
      });
    }

    // Send cancellation notifications to participants
    const startDate = new Date(bookingRecord.scheduledStartAt);
    const endDate = new Date(bookingRecord.scheduledEndAt);

    for (const participant of participants) {
      const participantTimezone = participant.user.timezone || 'America/Chicago';
      const lessonDate = formatDateOnly(startDate, participantTimezone);
      const startTime = formatTimeOnly(startDate, participantTimezone);
      const endTime = formatTimeOnly(endDate, participantTimezone);
      const lessonTime = `${startTime} - ${endTime}`;

      await sendEmail({
        to: participant.user.email,
        subject: `Group Lesson Cancelled`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B4A;">Group Lesson Cancelled</h2>
            <p>Hi ${participant.user.name},</p>
            <p>Unfortunately, the group lesson organized by ${session.user.name || 'the organizer'} has been cancelled.</p>
            <p><strong>Lesson Details:</strong></p>
            <ul>
              <li><strong>Date:</strong> ${lessonDate}</li>
              <li><strong>Time:</strong> ${lessonTime}</li>
              <li><strong>Coach:</strong> ${bookingRecord.coach?.name || 'Coach'}</li>
            </ul>
            <p>We apologize for any inconvenience. If you have any questions, please contact support.</p>
          </div>
        `,
        text: `Hi ${participant.user.name}, the group lesson on ${lessonDate} at ${lessonTime} with ${bookingRecord.coach?.name || 'Coach'} organized by ${session.user.name || 'the organizer'} has been cancelled. We apologize for any inconvenience.`,
      });

      await recordStateTransition({
        bookingId,
        participantId: participant.id,
        field: 'status',
        oldStatus: participant.status,
        newStatus: 'cancelled',
        changedBy: session.user.id,
        reason: 'Organizer cancelled booking',
      });
    }

    console.log(`Private group booking ${bookingId} cancelled by organizer ${session.user.id}, notified ${participants.length} participants`);

    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Cancel private group booking error:', error);
    return { success: false, error: 'Failed to cancel booking' };
  }
}

export async function coachCancelGroupLesson(lessonId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const lesson = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, lessonId),
        eq(booking.coachId, session.user.id)
      ),
      with: {
        privateGroupDetails: true,
        publicGroupDetails: true,
      },
    });

    if (!lesson || (lesson.bookingType !== 'private_group' && lesson.bookingType !== 'public_group')) {
      return { success: false, error: 'Lesson not found or not a group lesson' };
    }

    const participants = await db.query.bookingParticipant.findMany({
      where: and(
        eq(bookingParticipant.bookingId, lessonId),
        eq(bookingParticipant.paymentStatus, 'captured')
      ),
    });

    const oldApprovalStatus = lesson.approvalStatus;
    const oldPaymentStatus = lesson.bookingType === 'private_group'
      ? lesson.privateGroupDetails?.paymentStatus
      : null; // Public groups don't have booking-level payment status

    for (const participant of participants) {
      if (participant.stripePaymentIntentId) {
        try {
          await refundBookingPayment(participant.stripePaymentIntentId);

          await recordPaymentEvent({
            bookingId: lessonId,
            participantId: participant.id,
            stripePaymentIntentId: participant.stripePaymentIntentId,
            amountCents: participant.amountCents ?? 0,
            status: 'refunded',
          });

          await recordStateTransition({
            bookingId: lessonId,
            participantId: participant.id,
            field: 'paymentStatus',
            oldStatus: participant.paymentStatus,
            newStatus: 'refunded',
            changedBy: session.user.id,
            reason: 'Coach cancelled lesson',
          });
        } catch (error) {
          console.error(`Failed to refund participant ${participant.userId}:`, error);
        }
      }
    }

    // Handle private group main payment
    if (lesson.bookingType === 'private_group' && lesson.privateGroupDetails?.stripePaymentIntentId && lesson.privateGroupDetails.paymentStatus === 'captured') {
      try {
        await refundBookingPayment(lesson.privateGroupDetails.stripePaymentIntentId);

        await recordPaymentEvent({
          bookingId: lessonId,
          stripePaymentIntentId: lesson.privateGroupDetails.stripePaymentIntentId,
          amountCents: lesson.privateGroupDetails.totalGrossCents ?? 0,
          status: 'refunded',
        });
      } catch (error) {
        console.error(`Failed to refund main payment intent:`, error);
      }
    }

    await db
      .update(booking)
      .set({
        approvalStatus: 'cancelled',
        cancelledBy: session.user.id,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, lessonId));

    // Update payment status in detail table
    if (lesson.bookingType === 'private_group' && lesson.privateGroupDetails) {
      await db
        .update(privateGroupBookingDetails)
        .set({
          paymentStatus: 'refunded',
        })
        .where(eq(privateGroupBookingDetails.bookingId, lessonId));
    }

    await db
      .update(bookingParticipant)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
      })
      .where(eq(bookingParticipant.bookingId, lessonId));

    await recordStateTransition({
      bookingId: lessonId,
      field: 'approvalStatus',
      oldStatus: oldApprovalStatus,
      newStatus: 'cancelled',
      changedBy: session.user.id,
      reason: 'Coach cancelled lesson',
    });

    if (oldPaymentStatus && oldPaymentStatus !== 'refunded') {
      await recordStateTransition({
        bookingId: lessonId,
        field: 'paymentStatus',
        oldStatus: oldPaymentStatus,
        newStatus: 'refunded',
        changedBy: session.user.id,
      });
    }

    console.log(`Coach ${session.user.id} cancelled group lesson ${lessonId}`);

    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Coach cancel group lesson error:', error);
    return { success: false, error: 'Failed to cancel lesson' };
  }
}
