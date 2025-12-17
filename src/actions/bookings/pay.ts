'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, individualBookingDetails, privateGroupBookingDetails, coachProfile, bookingParticipant } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createBookingPaymentIntent, captureBookingPayment, stripe } from '@/lib/stripe';
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
        eq(booking.bookingType, 'individual')
      ),
      with: {
        individualDetails: true,
      },
    });

    if (!bookingRecord || !bookingRecord.individualDetails) {
      return { success: false, error: 'Booking not found' };
    }

    if (bookingRecord.individualDetails.clientId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    if (bookingRecord.individualDetails.paymentStatus !== 'awaiting_client_payment') {
      return { success: false, error: 'Booking is not awaiting payment' };
    }

    if (bookingRecord.individualDetails.paymentDueAt && new Date() > new Date(bookingRecord.individualDetails.paymentDueAt)) {
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
      bookingRecord.individualDetails.clientPaysCents / 100,
      coach.stripeAccountId,
      {
        bookingId: bookingRecord.id,
        clientId: session.user.id,
        coachId: bookingRecord.coachId,
      }
    );

    await db
      .update(individualBookingDetails)
      .set({
        stripePaymentIntentId: paymentIntent.id,
      })
      .where(eq(individualBookingDetails.bookingId, validatedBookingId));

    // Record payment audit event
    await recordPaymentEvent({
      bookingId: bookingRecord.id,
      stripePaymentIntentId: paymentIntent.id,
      amountCents: bookingRecord.individualDetails.clientPaysCents,
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

export async function createPaymentForPrivateGroupBooking(bookingId: string) {
  try {
    const validatedBookingId = validateInput(uuidSchema, bookingId);

    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, validatedBookingId),
        eq(booking.bookingType, 'private_group')
      ),
      with: {
        coach: {
          with: {
            coachProfile: {
              columns: {
                stripeAccountId: true,
              },
            },
          },
        },
        privateGroupDetails: true,
      },
    });

    if (!bookingRecord || !bookingRecord.privateGroupDetails) {
      return { success: false, error: 'Booking not found' };
    }

    if (bookingRecord.privateGroupDetails.organizerId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    if (bookingRecord.privateGroupDetails.paymentStatus !== 'awaiting_client_payment') {
      return { success: false, error: 'Booking is not awaiting payment' };
    }

    if (bookingRecord.privateGroupDetails.paymentDueAt && new Date() > new Date(bookingRecord.privateGroupDetails.paymentDueAt)) {
      return { success: false, error: 'Payment deadline has passed. This booking will be cancelled.' };
    }

    const coachStripeAccountId = bookingRecord.coach.coachProfile?.stripeAccountId;
    if (!coachStripeAccountId) {
      return { success: false, error: 'Coach payment setup incomplete' };
    }

    const paymentIntent = await createBookingPaymentIntent(
      bookingRecord.privateGroupDetails.totalGrossCents / 100,
      coachStripeAccountId,
      {
        bookingId: bookingRecord.id,
        clientId: session.user.id,
        coachId: bookingRecord.coachId,
      }
    );

    await db
      .update(privateGroupBookingDetails)
      .set({
        stripePaymentIntentId: paymentIntent.id,
      })
      .where(eq(privateGroupBookingDetails.bookingId, validatedBookingId));

    // Record payment audit event
    await recordPaymentEvent({
      bookingId: bookingRecord.id,
      stripePaymentIntentId: paymentIntent.id,
      amountCents: bookingRecord.privateGroupDetails.totalGrossCents,
      status: 'created',
      captureMethod: 'manual',
    });

    console.log(`PaymentIntent created for private group booking ${validatedBookingId}: ${paymentIntent.id}`);

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Create private group payment error:', error);
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
        eq(booking.bookingType, 'individual')
      ),
      with: {
        individualDetails: true,
      },
    });

    if (!bookingRecord || !bookingRecord.individualDetails) {
      return { success: false, error: 'Booking not found' };
    }

    if (bookingRecord.individualDetails.clientId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    if (bookingRecord.individualDetails.paymentStatus !== 'awaiting_client_payment') {
      return { success: false, error: 'Booking is not awaiting payment' };
    }

    if (!bookingRecord.individualDetails.stripePaymentIntentId) {
      return { success: false, error: 'No payment intent found' };
    }

    let paymentIntent;
    let retries = 3;
    while (retries > 0) {
      paymentIntent = await stripe.paymentIntents.retrieve(bookingRecord.individualDetails.stripePaymentIntentId);
      
      if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded') {
        break;
      }
      
      if (paymentIntent.status === 'requires_payment_method') {
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return { success: false, error: 'Payment not confirmed. Please try again.' };
      }
      
      break;
    }

    if (!paymentIntent) {
      return { success: false, error: 'Failed to retrieve payment intent' };
    }

    if (paymentIntent.status === 'requires_capture') {
      await captureBookingPayment(bookingRecord.individualDetails.stripePaymentIntentId);
    } else if (paymentIntent.status === 'succeeded') {
      console.log(`Payment intent ${paymentIntent.id} already succeeded`);
    } else if (paymentIntent.status === 'requires_payment_method') {
      return { success: false, error: 'Payment not confirmed. Please check your payment method and try again.' };
    } else {
      return { success: false, error: `Payment intent is in invalid state: ${paymentIntent.status}` };
    }

    const oldPaymentStatus = bookingRecord.individualDetails.paymentStatus;

    await db
      .update(booking)
      .set({
        lockedUntil: null,
        fulfillmentStatus: 'scheduled',
      })
      .where(eq(booking.id, validatedBookingId));

    await db
      .update(individualBookingDetails)
      .set({
        paymentStatus: 'captured',
        paymentDueAt: null,
      })
      .where(eq(individualBookingDetails.bookingId, validatedBookingId));

    // Record payment and state audit events
    await recordPaymentEvent({
      bookingId: bookingRecord.id,
      stripePaymentIntentId: bookingRecord.individualDetails.stripePaymentIntentId,
      amountCents: bookingRecord.individualDetails.clientPaysCents,
      status: 'captured',
    });

    await recordStateTransition({
      bookingId: bookingRecord.id,
      field: 'paymentStatus',
      oldStatus: oldPaymentStatus,
      newStatus: 'captured',
      changedBy: session.user.id,
    });

    console.log(`Payment confirmed for individual booking ${validatedBookingId}`);
    return { success: true };
  } catch (error) {
    console.error('Confirm payment error:', error);
    return { success: false, error: 'Failed to confirm payment' };
  }
}

export async function confirmPrivateGroupBookingPayment(bookingId: string) {
  try {
    const validatedBookingId = validateInput(uuidSchema, bookingId);

    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, validatedBookingId),
        eq(booking.bookingType, 'private_group')
      ),
      with: {
        privateGroupDetails: true,
      },
    });

    if (!bookingRecord || !bookingRecord.privateGroupDetails) {
      return { success: false, error: 'Booking not found' };
    }

    if (bookingRecord.privateGroupDetails.organizerId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    if (bookingRecord.privateGroupDetails.paymentStatus !== 'awaiting_client_payment') {
      return { success: false, error: 'Booking is not awaiting payment' };
    }

    if (!bookingRecord || !bookingRecord.privateGroupDetails) {
      return { success: false, error: 'Booking not found' };
    }

    if (!bookingRecord.privateGroupDetails.stripePaymentIntentId) {
      return { success: false, error: 'No payment intent found' };
    }

    let paymentIntent;
    let retries = 3;
    while (retries > 0) {
      paymentIntent = await stripe.paymentIntents.retrieve(bookingRecord.privateGroupDetails.stripePaymentIntentId);
      
      if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded') {
        break;
      }
      
      if (paymentIntent.status === 'requires_payment_method') {
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return { success: false, error: 'Payment not confirmed. Please check your payment method and try again.' };
      }
      
      break;
    }

    if (!paymentIntent) {
      return { success: false, error: 'Failed to retrieve payment intent' };
    }

    // Check if payment intent is in a capturable state
    if (paymentIntent.status === 'requires_capture') {
      await captureBookingPayment(bookingRecord.privateGroupDetails.stripePaymentIntentId);
    } else if (paymentIntent.status === 'succeeded') {
      console.log(`Payment intent ${paymentIntent.id} already succeeded`);
    } else if (paymentIntent.status === 'requires_payment_method') {
      return { success: false, error: 'Payment not confirmed. Please check your payment method and try again.' };
    } else {
      return { success: false, error: `Payment intent is in invalid state: ${paymentIntent.status}` };
    }

    const oldPaymentStatus = bookingRecord.privateGroupDetails.paymentStatus;

    await db
      .update(booking)
      .set({
        lockedUntil: null,
        fulfillmentStatus: 'scheduled',
      })
      .where(eq(booking.id, validatedBookingId));

    await db
      .update(privateGroupBookingDetails)
      .set({
        paymentStatus: 'captured',
        paymentDueAt: null,
      })
      .where(eq(privateGroupBookingDetails.bookingId, validatedBookingId));

    // Update all participant statuses to 'accepted' (inherited from organizer's payment)
    await db.update(bookingParticipant)
      .set({
        status: 'accepted',
        paymentStatus: 'captured',
      })
      .where(eq(bookingParticipant.bookingId, validatedBookingId));

    // Record payment and state audit events
    await recordPaymentEvent({
      bookingId: bookingRecord.id,
      stripePaymentIntentId: bookingRecord.privateGroupDetails.stripePaymentIntentId,
      amountCents: bookingRecord.privateGroupDetails.totalGrossCents,
      status: 'captured',
    });

    await recordStateTransition({
      bookingId: bookingRecord.id,
      field: 'paymentStatus',
      oldStatus: oldPaymentStatus,
      newStatus: 'captured',
      changedBy: session.user.id,
    });

    console.log(`Payment confirmed for private group booking ${validatedBookingId} - all participants marked as paid`);

    return { success: true };
  } catch (error) {
    console.error('Confirm payment error:', error);
    return { success: false, error: 'Failed to confirm payment' };
  }
}
