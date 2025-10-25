'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import {
  captureBookingPayment,
  cancelBookingPayment,
  refundBookingPayment,
} from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import {
  getBookingAcceptedEmailTemplate,
  getBookingDeclinedEmailTemplate,
  getBookingCancelledEmailTemplate,
} from '@/lib/email/templates/booking-notifications';

/**
 * Coach accepts a booking request
 * Captures the held payment
 */
export async function acceptBooking(bookingId: string) {
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

    if (!bookingRecord.stripePaymentIntentId) {
      return { success: false, error: 'No payment intent found' };
    }

    // Capture the held payment
    await captureBookingPayment(bookingRecord.stripePaymentIntentId);

    // Update booking status
    await db
      .update(booking)
      .set({
        status: 'accepted',
        coachRespondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    console.log(`Booking accepted: ${bookingId}`);
    console.log(`Payment captured: ${bookingRecord.stripePaymentIntentId}`);

    // Send email notification to client
    const startDate = new Date(bookingRecord.scheduledStartAt);
    const endDate = new Date(bookingRecord.scheduledEndAt);
    
    const emailTemplate = getBookingAcceptedEmailTemplate(
      bookingRecord.client.name,
      session.user.name,
      {
        date: startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        time: `${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        duration: bookingRecord.duration,
        location: `${bookingRecord.location.name}, ${bookingRecord.location.address}`,
        amount: parseFloat(bookingRecord.clientPaid).toFixed(2),
      }
    );

    await sendEmail({
      to: bookingRecord.client.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`Booking accepted email sent to: ${bookingRecord.client.email}`);

    return { success: true };
  } catch (error) {
    console.error('Accept booking error:', error);
    return { success: false, error: 'Failed to accept booking' };
  }
}

/**
 * Coach declines a booking request
 * Cancels the held payment
 */
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

    // Cancel the held payment
    await cancelBookingPayment(bookingRecord.stripePaymentIntentId);

    // Update booking status
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

/**
 * Cancel a booking
 * Either party can cancel before the session
 */
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

    // If booking was accepted, process refund
    // If still pending, just cancel the payment intent
    if (bookingRecord.status === 'accepted') {
      await refundBookingPayment(bookingRecord.stripePaymentIntentId);
    } else {
      await cancelBookingPayment(bookingRecord.stripePaymentIntentId);
    }

    // Update booking
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

/**
 * Mark booking as complete (coach marks after session)
 */
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
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    // Update booking
    await db
      .update(booking)
      .set({
        markedCompleteByCoach: true,
        markedCompleteByCoachAt: new Date(),
        // If client already confirmed, mark as completed
        status: bookingRecord.confirmedByClient ? 'completed' : 'accepted',
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    console.log(`Booking marked complete by coach: ${bookingId}`);

    return { success: true };
  } catch (error) {
    console.error('Mark complete error:', error);
    return { success: false, error: 'Failed to mark booking complete' };
  }
}

/**
 * Client confirms booking completion
 */
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

    // Update booking
    await db
      .update(booking)
      .set({
        confirmedByClient: true,
        confirmedByClientAt: new Date(),
        // If coach already marked complete, set status to completed
        status: bookingRecord.markedCompleteByCoach ? 'completed' : 'accepted',
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    console.log(`Booking confirmed by client: ${bookingId}`);

    return { success: true };
  } catch (error) {
    console.error('Confirm complete error:', error);
    return { success: false, error: 'Failed to confirm booking' };
  }
}

