/**
 * Minimal Stripe utilities for Trigger.dev tasks
 * This avoids importing the full env.ts which requires all env vars
 */

import Stripe from 'stripe';
import { db } from '@/lib/db';
import { booking, individualBookingDetails, privateGroupBookingDetails, publicGroupLessonDetails, bookingParticipant, coachProfile } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculateCoachEarnings } from '@/lib/pricing';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is required for Trigger.dev tasks');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover',
});

/**
 * Safely transfer funds to coach for a completed booking
 * Handles individual, private group, and public group bookings
 */
export async function processCoachPayoutSafely(bookingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
      with: {
        individualDetails: true,
        privateGroupDetails: true,
        publicGroupDetails: true,
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, bookingRecord.coachId),
      with: {
        user: {
          columns: {
            platformFeePercentage: true,
          },
        },
      },
    });

    if (!coach?.stripeAccountId) {
      console.error(`[TRANSFER] Coach has no Stripe account for booking ${bookingId}`);
      return { success: false, error: 'Coach Stripe account not configured' };
    }

    const platformFeePercentage = coach.user?.platformFeePercentage
      ? parseFloat(coach.user.platformFeePercentage as unknown as string)
      : 15;

    let paymentIntentId: string | null = null;
    let coachPayoutAmount = 0;

    if (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails) {
      if (bookingRecord.individualDetails.stripeTransferId) {
        console.log(`[TRANSFER] Individual booking ${bookingId} already has transfer ${bookingRecord.individualDetails.stripeTransferId} - skipping`);
        return { success: true };
      }
      paymentIntentId = bookingRecord.individualDetails.stripePaymentIntentId;
      coachPayoutAmount = bookingRecord.individualDetails.coachPayoutCents / 100;

    } else if (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails) {
      if (bookingRecord.privateGroupDetails.stripeTransferId) {
        console.log(`[TRANSFER] Private group booking ${bookingId} already has transfer ${bookingRecord.privateGroupDetails.stripeTransferId} - skipping`);
        return { success: true };
      }
      paymentIntentId = bookingRecord.privateGroupDetails.stripePaymentIntentId;
      coachPayoutAmount = bookingRecord.privateGroupDetails.coachPayoutCents / 100;

    } else if (bookingRecord.bookingType === 'public_group' && bookingRecord.publicGroupDetails) {
      if (bookingRecord.publicGroupDetails.stripeTransferId) {
        console.log(`[TRANSFER] Public group booking ${bookingId} already has transfer ${bookingRecord.publicGroupDetails.stripeTransferId} - skipping`);
        return { success: true };
      }

      // For public groups, calculate aggregate payout from all captured participants
      const capturedParticipants = await db.query.bookingParticipant.findMany({
        where: and(
          eq(bookingParticipant.bookingId, bookingId),
          eq(bookingParticipant.paymentStatus, 'captured')
        ),
      });

      for (const participant of capturedParticipants) {
        if (participant.amountCents) {
          const earnings = calculateCoachEarnings(
            participant.amountCents / 100,
            platformFeePercentage
          );
          coachPayoutAmount += earnings.coachPayout;
        }
      }

      if (coachPayoutAmount === 0) {
        console.log(`[TRANSFER] No payout amount for public group ${bookingId}`);
        return { success: false, error: 'No payout amount calculated' };
      }
    }

    if (!paymentIntentId && bookingRecord.bookingType !== 'public_group') {
      return { success: false, error: 'No payment intent found' };
    }

    if (coachPayoutAmount <= 0) {
      return { success: false, error: 'Invalid payout amount' };
    }

    // Create transfer to coach
    const transfer = await stripe.transfers.create({
      amount: Math.round(coachPayoutAmount * 100),
      currency: 'usd',
      destination: coach.stripeAccountId,
      description: `Payout for booking ${bookingId}`,
      metadata: {
        bookingId,
        bookingType: bookingRecord.bookingType,
      },
    });

    console.log(`[TRANSFER] Created transfer ${transfer.id} for booking ${bookingId}: $${coachPayoutAmount}`);

    // Update the appropriate details table with transfer ID
    if (bookingRecord.bookingType === 'individual') {
      await db
        .update(individualBookingDetails)
        .set({
          stripeTransferId: transfer.id,
        })
        .where(eq(individualBookingDetails.bookingId, bookingId));
    } else if (bookingRecord.bookingType === 'private_group') {
      await db
        .update(privateGroupBookingDetails)
        .set({
          stripeTransferId: transfer.id,
        })
        .where(eq(privateGroupBookingDetails.bookingId, bookingId));
    } else if (bookingRecord.bookingType === 'public_group') {
      await db
        .update(publicGroupLessonDetails)
        .set({
          stripeTransferId: transfer.id,
        })
        .where(eq(publicGroupLessonDetails.bookingId, bookingId));
    }

    return { success: true };

  } catch (error) {
    console.error(`[TRANSFER] Error processing payout for booking ${bookingId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
