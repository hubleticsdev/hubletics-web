'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile } from '@/lib/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { incrementCoachLessonsCompleted } from '@/lib/coach-stats';
import {
  cancelBookingPayment,
  refundBookingPayment,
  transferToCoach,
} from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { getBookingAcceptedEmailTemplate, getBookingDeclinedEmailTemplate } from '@/lib/email/templates/booking-management-notifications';
import { uuidSchema, validateInput } from '@/lib/validations';
import { recordStateTransition, recordMultipleTransitions } from '@/lib/booking-audit';
import { recordPaymentEvent } from '@/lib/payment-audit';
import { revalidatePath } from 'next/cache';

async function processCoachPayoutSafely(bookingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    if (bookingRecord.stripeTransferId) {
      console.log(`[TRANSFER] Booking ${bookingId} already has transfer ${bookingRecord.stripeTransferId} - skipping`);
      return { success: true };
    }

    const paymentIntentId = bookingRecord.primaryStripePaymentIntentId;

    if (!paymentIntentId) {
      return { success: false, error: 'No payment intent found' };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, bookingRecord.coachId),
      columns: {
        stripeAccountId: true,
      },
    });

    if (!coach?.stripeAccountId) {
      console.error(`[TRANSFER] Coach has no Stripe account for booking ${bookingId}`);
      return { success: false, error: 'Coach Stripe account not configured' };
    }

    const coachPayoutAmount =
      bookingRecord.coachPayoutCents !== null && bookingRecord.coachPayoutCents !== undefined
        ? bookingRecord.coachPayoutCents / 100
        : 0;

    console.log(`[TRANSFER] Transferring $${coachPayoutAmount} to coach for booking ${bookingId}`);
    const transfer = await transferToCoach(
      coachPayoutAmount,
      coach.stripeAccountId,
      {
        bookingId: bookingRecord.id,
        paymentIntentId,
        coachId: bookingRecord.coachId,
      }
    );

    console.log(`[TRANSFER] Transfer successful: ${transfer.id}`);

    await db
      .update(booking)
      .set({
        stripeTransferId: transfer.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(booking.id, bookingId),
          sql`${booking.stripeTransferId} IS NULL`
        )
      );

    return { success: true };
  } catch (error) {
    console.error(`[TRANSFER] Failed to transfer funds for booking ${bookingId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Transfer failed' };
  }
}

export async function acceptBooking(bookingId: string) {
  try {
    const validatedBookingId = validateInput(uuidSchema, bookingId);

    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, validatedBookingId),
        eq(booking.coachId, session.user.id),
        eq(booking.approvalStatus, 'pending_review')
      ),
      with: {
        client: {
          columns: {
            name: true,
            email: true,
          },
        },
        coach: {
          columns: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    const paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db
      .update(booking)
      .set({
        approvalStatus: 'accepted',
        paymentStatus: 'awaiting_client_payment',
        coachRespondedAt: new Date(),
        paymentDueAt,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, validatedBookingId));

    // Record state transitions
    await recordMultipleTransitions(
      bookingRecord.id,
      [
        { field: 'approvalStatus', oldStatus: 'pending_review', newStatus: 'accepted' },
        { field: 'paymentStatus', oldStatus: 'not_required', newStatus: 'awaiting_client_payment' },
      ],
      session.user.id
    );

    console.log(`Booking accepted: ${validatedBookingId}`);
    console.log(`Payment due by: ${paymentDueAt.toISOString()}`);

    const startDate = new Date(bookingRecord.scheduledStartAt);
    
    const lessonDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const lessonTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    const paymentDeadline = paymentDueAt.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    const emailTemplate = getBookingAcceptedEmailTemplate(
      bookingRecord.client.name,
      bookingRecord.coach.name,
      lessonDate,
      lessonTime,
      bookingRecord.location ? `${bookingRecord.location.name}, ${bookingRecord.location.address}` : 'Location to be confirmed',
      bookingRecord.expectedGrossCents ?? 0,
      paymentDeadline
    );

    await sendEmail({
      to: bookingRecord.client.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`Payment request email sent to: ${bookingRecord.client.email}`);

    revalidatePath('/dashboard/coach');

    return { success: true };
  } catch (error) {
    console.error('Accept booking error:', error);
    return { success: false, error: 'Failed to accept booking' };
  }
}

export async function declineBooking(bookingId: string, reason?: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.coachId, session.user.id),
        eq(booking.approvalStatus, 'pending_review')
      ),
      with: {
        client: {
          columns: {
            name: true,
            email: true,
          },
        },
        coach: {
          columns: {
            name: true,
          },
        },
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    // Only cancel PI if one exists (won't exist for pending_review individual bookings with deferred payment)
    if (bookingRecord.primaryStripePaymentIntentId) {
      await cancelBookingPayment(bookingRecord.primaryStripePaymentIntentId);
      console.log(`Payment cancelled: ${bookingRecord.primaryStripePaymentIntentId}`);
    }

    await db
      .update(booking)
      .set({
        approvalStatus: 'declined',
        coachRespondedAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    // Record state transition
    await recordStateTransition({
      bookingId: bookingRecord.id,
      field: 'approvalStatus',
      oldStatus: 'pending_review',
      newStatus: 'declined',
      changedBy: session.user.id,
      reason,
    });

    console.log(`Booking declined: ${bookingId}`);

    // Send decline notification email to client
    const startDate = new Date(bookingRecord.scheduledStartAt);
    const lessonDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const lessonTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    const emailTemplate = getBookingDeclinedEmailTemplate(
      bookingRecord.client.name,
      bookingRecord.coach.name,
      lessonDate,
      lessonTime,
      reason
    );

    await sendEmail({
      to: bookingRecord.client.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`Decline notification sent to: ${bookingRecord.client.email}`);

    revalidatePath('/dashboard/coach');

    return { success: true };
  } catch (error) {
    console.error('Decline booking error:', error);
    return { success: false, error: 'Failed to decline booking' };
  }
}

export async function cancelBooking(bookingId: string, reason: string) {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        or(
          eq(booking.clientId, session.user.id),
          eq(booking.coachId, session.user.id)
        )
      ),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    if (
      bookingRecord.approvalStatus !== 'pending_review' &&
      bookingRecord.approvalStatus !== 'accepted'
    ) {
      return { success: false, error: 'Cannot cancel this booking' };
    }

    const paymentIntentId = bookingRecord.primaryStripePaymentIntentId;

    if (paymentIntentId) {
    if (bookingRecord.paymentStatus === 'captured' || bookingRecord.paymentStatus === 'authorized') {
      await refundBookingPayment(paymentIntentId);
    } else if (bookingRecord.paymentStatus === 'awaiting_client_payment') {
      await cancelBookingPayment(paymentIntentId);
    }
    }

    const newPaymentStatus =
      bookingRecord.paymentStatus === 'captured' || bookingRecord.paymentStatus === 'authorized'
        ? 'refunded'
        : bookingRecord.paymentStatus;

    await db
      .update(booking)
      .set({
        approvalStatus: 'cancelled',
        paymentStatus: newPaymentStatus,
        cancelledBy: session.user.id,
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    // Record state transitions
    const transitions: Array<{ field: 'approvalStatus' | 'paymentStatus'; oldStatus: string; newStatus: string }> = [
      { field: 'approvalStatus', oldStatus: bookingRecord.approvalStatus, newStatus: 'cancelled' },
    ];
    if (newPaymentStatus !== bookingRecord.paymentStatus) {
      transitions.push({ field: 'paymentStatus', oldStatus: bookingRecord.paymentStatus, newStatus: newPaymentStatus });
    }
    await recordMultipleTransitions(bookingRecord.id, transitions, session.user.id, reason);

    // Record payment event if refunded
    if (paymentIntentId && newPaymentStatus === 'refunded') {
      await recordPaymentEvent({
        bookingId: bookingRecord.id,
        stripePaymentIntentId: paymentIntentId,
        amountCents: bookingRecord.expectedGrossCents ?? 0,
        status: 'refunded',
      });
    }

    console.log(`Booking cancelled: ${bookingId}`);
    console.log(`Refund processed: ${paymentIntentId ?? 'n/a'}`);

    revalidatePath('/dashboard/coach');
    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Cancel booking error:', error);
    return { success: false, error: 'Failed to cancel booking' };
  }
}

export async function markBookingComplete(bookingId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.coachId, session.user.id),
        eq(booking.approvalStatus, 'accepted')
      ),
      with: {
        client: {
          columns: {
            name: true,
            email: true,
          },
        },
        coach: {
          columns: {
            name: true,
          },
        },
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    const newFulfillmentStatus = bookingRecord.clientConfirmedAt ? 'completed' : 'scheduled';

    await db
      .update(booking)
      .set({
        coachConfirmedAt: new Date(),
        fulfillmentStatus: newFulfillmentStatus,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    if (newFulfillmentStatus === 'completed') {
      await incrementCoachLessonsCompleted(bookingRecord.coachId);
    }

    if (!bookingRecord.clientConfirmedAt) {
      const startDate = new Date(bookingRecord.scheduledStartAt);
      
      await sendEmail({
        to: bookingRecord.client.email,
        subject: `Please confirm lesson completion with ${bookingRecord.coach.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B4A;">Lesson Completion Confirmation</h2>
            <p>Hi ${bookingRecord.client.name},</p>
            <p>${bookingRecord.coach.name} has marked your lesson on <strong>${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong> as complete.</p>
            <p>Please confirm that the lesson was completed successfully:</p>
            <p style="margin: 30px 0; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_URL}/dashboard/bookings" 
                 style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Confirm Completion
              </a>
            </p>
            <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px;">
              <strong>Note:</strong> If we don't hear from you within 7 days, we'll automatically confirm the lesson and release payment to the coach. If there was an issue with the lesson, please contact support immediately.
            </p>
          </div>
        `,
        text: `Hi ${bookingRecord.client.name}, ${bookingRecord.coach.name} has marked your lesson on ${startDate.toLocaleDateString()} as complete. Please log in to confirm at ${process.env.NEXT_PUBLIC_URL}/dashboard/bookings or contact support if there was an issue.`,
      });

      console.log(`Completion confirmation email sent to: ${bookingRecord.client.email}`);
    }

    // If BOTH have now confirmed (client confirmed first, coach marking now), transfer funds
    if (newFulfillmentStatus === 'completed') {
      await processCoachPayoutSafely(bookingId);
    }

    console.log(`Booking marked complete by coach: ${bookingId}`);

    revalidatePath('/dashboard/coach');
    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Mark complete error:', error);
    return { success: false, error: 'Failed to mark booking complete' };
  }
}

export async function confirmBookingComplete(bookingId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.clientId, session.user.id),
        eq(booking.approvalStatus, 'accepted')
      ),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    const newFulfillmentStatus = bookingRecord.coachConfirmedAt ? 'completed' : 'scheduled';

    await db
      .update(booking)
      .set({
        clientConfirmedAt: new Date(),
        fulfillmentStatus: newFulfillmentStatus,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    if (newFulfillmentStatus === 'completed') {
      await processCoachPayoutSafely(bookingId);
    }

    console.log(`Booking confirmed by client: ${bookingId}`);

    revalidatePath('/dashboard/coach');
    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Confirm complete error:', error);
    return { success: false, error: 'Failed to confirm booking' };
  }
}
