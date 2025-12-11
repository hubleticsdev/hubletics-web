'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile } from '@/lib/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import {
  captureBookingPayment,
  cancelBookingPayment,
  refundBookingPayment,
  transferToCoach,
} from '@/lib/stripe';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import {
  getBookingAcceptedEmailTemplate,
  getBookingDeclinedEmailTemplate,
  getBookingCancelledEmailTemplate,
} from '@/lib/email/templates/booking-notifications';
import { z } from 'zod';
import { uuidSchema, validateInput } from '@/lib/validations';

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

    if (!bookingRecord.stripePaymentIntentId) {
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

    const coachPayoutAmount = parseFloat(bookingRecord.coachPayout);

    console.log(`[TRANSFER] Transferring $${coachPayoutAmount} to coach for booking ${bookingId}`);
    const transfer = await transferToCoach(
      coachPayoutAmount,
      coach.stripeAccountId,
      {
        bookingId: bookingRecord.id,
        paymentIntentId: bookingRecord.stripePaymentIntentId,
        coachId: bookingRecord.coachId,
      }
    );

    console.log(`[TRANSFER] Transfer successful: ${transfer.id}`);

    const updateResult = await db
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
        eq(booking.status, 'pending')
      ),
      with: {
        client: {
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
        status: 'awaiting_payment',
        coachRespondedAt: new Date(),
        paymentDueAt,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, validatedBookingId));

    console.log(`Booking accepted: ${validatedBookingId}`);
    console.log(`Payment due by: ${paymentDueAt.toISOString()}`);

    const startDate = new Date(bookingRecord.scheduledStartAt);
    
    await sendEmail({
      to: bookingRecord.client.email,
      subject: `Lesson Accepted - Payment Required`,
      html: `
        <h2>Great news! Your lesson has been accepted</h2>
        <p>Hi ${bookingRecord.client.name},</p>
        <p>Your coach has accepted your lesson request for ${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}!</p>
        
        <h3>⏰ Payment Required</h3>
        <p><strong>You have 24 hours to complete payment</strong> or this booking will be automatically cancelled.</p>
        <p><strong>Payment Deadline:</strong> ${paymentDueAt.toLocaleString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}</p>
        
        <p><strong>Amount:</strong> $${parseFloat(bookingRecord.clientPaid).toFixed(2)}</p>
        
        <p style="margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_URL}/dashboard/bookings" 
             style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Pay Now
          </a>
        </p>
        
        <p style="color: #666; font-size: 14px;">
          You'll receive reminder emails at 12 hours and 30 minutes before the deadline.
        </p>
      `,
      text: `Hi ${bookingRecord.client.name}, Your lesson has been accepted! Please complete payment within 24 hours. Payment deadline: ${paymentDueAt.toLocaleString()}. Amount: $${parseFloat(bookingRecord.clientPaid).toFixed(2)}. Visit ${process.env.NEXT_PUBLIC_URL}/dashboard/bookings to pay now.`,
    });

    console.log(`Payment request email sent to: ${bookingRecord.client.email}`);

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
        eq(booking.status, 'pending')
      ),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    if (!bookingRecord.stripePaymentIntentId) {
      return { success: false, error: 'No payment intent found' };
    }

    await cancelBookingPayment(bookingRecord.stripePaymentIntentId!);

    await db
      .update(booking)
      .set({
        status: 'declined',
        coachRespondedAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    console.log(`Booking declined: ${bookingId}`);
    console.log(`Payment cancelled: ${bookingRecord.stripePaymentIntentId}`);

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

    if (bookingRecord.status !== 'pending' && bookingRecord.status !== 'accepted') {
      return { success: false, error: 'Cannot cancel this booking' };
    }

    if (!bookingRecord.stripePaymentIntentId) {
      return { success: false, error: 'No payment intent found' };
    }

    if (bookingRecord.status === 'accepted') {
      await refundBookingPayment(bookingRecord.stripePaymentIntentId!);
    } else {
      await cancelBookingPayment(bookingRecord.stripePaymentIntentId!);
    }

    await db
      .update(booking)
      .set({
        status: 'cancelled',
        cancelledBy: session.user.id,
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundAmount: bookingRecord.clientPaid,
        refundProcessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    console.log(`Booking cancelled: ${bookingId}`);
    console.log(`Refund processed: ${bookingRecord.stripePaymentIntentId}`);

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
        eq(booking.status, 'accepted')
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

    const newStatus = bookingRecord.confirmedByClient ? 'completed' : 'accepted';

    await db
      .update(booking)
      .set({
        markedCompleteByCoach: true,
        markedCompleteByCoachAt: new Date(),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    if (!bookingRecord.confirmedByClient) {
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
    if (newStatus === 'completed') {
      await processCoachPayoutSafely(bookingId);
    }

    console.log(`Booking marked complete by coach: ${bookingId}`);

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
        eq(booking.status, 'accepted')
      ),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    const newStatus = bookingRecord.markedCompleteByCoach ? 'completed' : 'accepted';

    await db
      .update(booking)
      .set({
        confirmedByClient: true,
        confirmedByClientAt: new Date(),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    if (newStatus === 'completed') {
      await processCoachPayoutSafely(bookingId);
    }

    console.log(`Booking confirmed by client: ${bookingId}`);

    return { success: true };
  } catch (error) {
    console.error('Confirm complete error:', error);
    return { success: false, error: 'Failed to confirm booking' };
  }
}

