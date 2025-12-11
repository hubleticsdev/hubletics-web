'use server';

import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export async function acceptBooking(bookingId: string) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const existingBooking = await db.query.booking.findFirst({
      where: and(eq(booking.id, bookingId), eq(booking.coachId, session.user.id)),
    });

    if (!existingBooking) {
      return { success: false, error: 'Booking not found' };
    }

    if (existingBooking.status !== 'pending') {
      return { success: false, error: 'Booking is not pending' };
    }

    if (existingBooking.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.capture(existingBooking.stripePaymentIntentId);
      } catch (stripeError: any) {
        console.error('Stripe capture error:', stripeError);
        return { success: false, error: `Payment capture failed: ${stripeError.message}` };
      }
    }

    await db
      .update(booking)
      .set({
        status: 'accepted',
        coachRespondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    revalidatePath('/dashboard/bookings');
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

    const existingBooking = await db.query.booking.findFirst({
      where: and(eq(booking.id, bookingId), eq(booking.coachId, session.user.id)),
    });

    if (!existingBooking) {
      return { success: false, error: 'Booking not found' };
    }

    if (existingBooking.status !== 'pending') {
      return { success: false, error: 'Booking is not pending' };
    }

    if (existingBooking.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(existingBooking.stripePaymentIntentId);
      } catch (stripeError: any) {
        console.error('Stripe cancel error:', stripeError);
        return { success: false, error: `Payment cancellation failed: ${stripeError.message}` };
      }
    }

    await db
      .update(booking)
      .set({
        status: 'declined',
        coachRespondedAt: new Date(),
        cancelledBy: session.user.id,
        cancelledAt: new Date(),
        cancellationReason: reason || 'Coach declined the booking request',
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    revalidatePath('/dashboard/bookings');
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

    const existingBooking = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
    });

    if (!existingBooking) {
      return { success: false, error: 'Booking not found' };
    }

    if (
      existingBooking.clientId !== session.user.id &&
      existingBooking.coachId !== session.user.id
    ) {
      return { success: false, error: 'Unauthorized' };
    }

    if (existingBooking.status === 'cancelled' || existingBooking.status === 'completed') {
      return { success: false, error: 'Booking cannot be cancelled' };
    }

    const now = new Date();
    const scheduledStart = new Date(existingBooking.scheduledStartAt);
    const hoursUntilSession = (scheduledStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundAmount = 0;
    if (hoursUntilSession >= 24) {
      refundAmount = parseFloat(existingBooking.clientPaid);
    } else if (hoursUntilSession >= 12) {
      refundAmount = parseFloat(existingBooking.clientPaid) * 0.5;
    }

    if (refundAmount > 0 && existingBooking.stripePaymentIntentId) {
      try {
        await stripe.refunds.create({
          payment_intent: existingBooking.stripePaymentIntentId,
          amount: Math.round(refundAmount * 100),
        });
      } catch (stripeError: any) {
        console.error('Stripe refund error:', stripeError);
        return { success: false, error: `Refund failed: ${stripeError.message}` };
      }
    }

    await db
      .update(booking)
      .set({
        status: 'cancelled',
        cancelledBy: session.user.id,
        cancelledAt: now,
        cancellationReason: reason,
        refundAmount: refundAmount.toString(),
        refundProcessedAt: refundAmount > 0 ? now : null,
        updatedAt: now,
      })
      .where(eq(booking.id, bookingId));

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/coach');
    revalidatePath('/dashboard/athlete');
    return { success: true, refundAmount };
  } catch (error) {
    console.error('Cancel booking error:', error);
    return { success: false, error: 'Failed to cancel booking' };
  }
}
