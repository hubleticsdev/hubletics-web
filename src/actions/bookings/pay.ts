'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile, bookingParticipant } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createBookingPaymentIntent, captureBookingPayment } from '@/lib/stripe';
import { validateInput, uuidSchema } from '@/lib/validations';
import { recordPaymentEvent } from '@/lib/payment-audit';
import { recordStateTransition } from '@/lib/booking-audit';

export async function createPaymentForBooking(bookingId: string) {
  try {
    const validatedBookingId = validateInput(uuidSchema, bookingId);

    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, validatedBookingId),
        eq(booking.clientId, session.user.id),
        eq(booking.paymentStatus, 'awaiting_client_payment')
      ),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found or not awaiting payment' };
    }

    if (bookingRecord.paymentDueAt && new Date() > new Date(bookingRecord.paymentDueAt)) {
      return { success: false, error: 'Payment deadline has passed. This booking will be cancelled.' };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, bookingRecord.coachId),
      columns: {
        stripeAccountId: true,
      },
    });

    if (!coach?.stripeAccountId) {
      return { success: false, error: 'Coach payment setup incomplete' };
    }

    const paymentIntent = await createBookingPaymentIntent(
      bookingRecord.expectedGrossCents ? bookingRecord.expectedGrossCents / 100 : 0,
      coach.stripeAccountId,
      {
        bookingId: bookingRecord.id,
        clientId: session.user.id,
        coachId: bookingRecord.coachId,
      }
    );

    await db
      .update(booking)
      .set({
        primaryStripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, validatedBookingId));

    // Record payment audit event
    await recordPaymentEvent({
      bookingId: bookingRecord.id,
      stripePaymentIntentId: paymentIntent.id,
      amountCents: bookingRecord.expectedGrossCents ?? 0,
      status: 'created',
      captureMethod: 'manual',
    });

    console.log(`PaymentIntent created for booking ${validatedBookingId}: ${paymentIntent.id}`);

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Create payment error:', error);
    return { success: false, error: 'Failed to create payment' };
  }
}

export async function confirmBookingPayment(bookingId: string) {
  try {
    const validatedBookingId = validateInput(uuidSchema, bookingId);

    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, validatedBookingId),
        eq(booking.clientId, session.user.id),
        eq(booking.paymentStatus, 'awaiting_client_payment')
      ),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    if (!bookingRecord.primaryStripePaymentIntentId) {
      return { success: false, error: 'No payment intent found' };
    }

    await captureBookingPayment(bookingRecord.primaryStripePaymentIntentId);

    const oldPaymentStatus = bookingRecord.paymentStatus;

    await db
      .update(booking)
      .set({
        paymentStatus: 'captured',
        primaryStripePaymentIntentId: bookingRecord.primaryStripePaymentIntentId,
        updatedAt: new Date(),
        paymentDueAt: null,
        lockedUntil: null,
        fulfillmentStatus: 'scheduled',
      })
      .where(eq(booking.id, validatedBookingId));

    // Record payment and state audit events
    await recordPaymentEvent({
      bookingId: bookingRecord.id,
      stripePaymentIntentId: bookingRecord.primaryStripePaymentIntentId,
      amountCents: bookingRecord.expectedGrossCents ?? 0,
      status: 'captured',
    });

    await recordStateTransition({
      bookingId: bookingRecord.id,
      field: 'paymentStatus',
      oldStatus: oldPaymentStatus,
      newStatus: 'captured',
      changedBy: session.user.id,
    });

    if (bookingRecord.isGroupBooking && bookingRecord.groupType === 'private') {
      await db
        .update(bookingParticipant)
        .set({
          paymentStatus: 'captured',
          status: 'accepted',
          capturedAt: new Date(),
        })
        .where(eq(bookingParticipant.bookingId, validatedBookingId));
      
      console.log(`Payment confirmed for private group booking ${validatedBookingId} - all participants marked as paid`);
    } else {
      console.log(`Payment confirmed for booking ${validatedBookingId}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Confirm payment error:', error);
    return { success: false, error: 'Failed to confirm payment' };
  }
}
