'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile, bookingParticipant } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createBookingPaymentIntent, captureBookingPayment } from '@/lib/stripe';
import { z } from 'zod';
import { uuidSchema, validateInput } from '@/lib/validations';

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
        eq(booking.status, 'awaiting_payment')
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
      parseFloat(bookingRecord.clientPaid),
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
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, validatedBookingId));

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
        eq(booking.status, 'awaiting_payment')
      ),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    if (!bookingRecord.stripePaymentIntentId) {
      return { success: false, error: 'No payment intent found' };
    }

    await captureBookingPayment(bookingRecord.stripePaymentIntentId);

    await db
      .update(booking)
      .set({
        status: 'accepted',
        paymentCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, validatedBookingId));

    if (bookingRecord.isGroupBooking && bookingRecord.groupType === 'private') {
      await db
        .update(bookingParticipant)
        .set({
          paymentStatus: 'paid',
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

