import { db } from '@/lib/db';
import { booking, bookingParticipant } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { BookingWithDetails } from './booking-type-guards';
import { isIndividualBooking, isPrivateGroupBooking, isPublicGroupBooking } from './booking-type-guards';
import { calculateCoachEarnings } from './pricing';

/**
 * Get the relevant payment intent ID for a booking
 * Returns null for public groups (each participant has their own PI)
 */
export function getPaymentIntentId(
  booking: BookingWithDetails
): string | null {
  if (isIndividualBooking(booking)) {
    return booking.individualDetails.stripePaymentIntentId ?? null;
  }
  
  if (isPrivateGroupBooking(booking)) {
    return booking.privateGroupDetails.stripePaymentIntentId ?? null;
  }
  
  // Public groups: each participant has their own PI (not on booking level)
  return null;
}

/**
 * Get the payment status for a booking
 * Returns null for public groups (no single payment status)
 */
export function getPaymentStatus(
  booking: BookingWithDetails
): string | null {
  if (isIndividualBooking(booking)) {
    return booking.individualDetails.paymentStatus;
  }
  
  if (isPrivateGroupBooking(booking)) {
    return booking.privateGroupDetails.paymentStatus;
  }
  
  // Public groups: no single payment status (aggregate from participants)
  return null;
}

/**
 * Get total amount paid (in cents) for a booking
 */
export async function getTotalPaidCents(bookingId: string): Promise<number> {
  const bookingRecord = await db.query.booking.findFirst({
    where: eq(booking.id, bookingId),
    with: {
      individualDetails: true,
      privateGroupDetails: true,
      publicGroupDetails: true,
    },
  }) as BookingWithDetails | undefined;
  
  if (!bookingRecord) return 0;
  
  if (isIndividualBooking(bookingRecord)) {
    return bookingRecord.individualDetails.paymentStatus === 'captured' 
      ? bookingRecord.individualDetails.clientPaysCents 
      : 0;
  }
  
  if (isPrivateGroupBooking(bookingRecord)) {
    return bookingRecord.privateGroupDetails.paymentStatus === 'captured'
      ? bookingRecord.privateGroupDetails.totalGrossCents
      : 0;
  }
  
  // Public group: sum all captured participant payments
  const capturedParticipants = await db.query.bookingParticipant.findMany({
    where: and(
      eq(bookingParticipant.bookingId, bookingId),
      eq(bookingParticipant.paymentStatus, 'captured')
    ),
  });
  
  return capturedParticipants.reduce((sum, p) => sum + (p.amountCents ?? 0), 0);
}

/**
 * Get coach payout amount (in cents) for a booking
 * Uses proper pricing calculation, not hardcoded percentages
 */
export async function getCoachPayoutCents(
  bookingId: string,
  platformFeePercentage: number = 15
): Promise<number> {
  const bookingRecord = await db.query.booking.findFirst({
    where: eq(booking.id, bookingId),
    with: {
      individualDetails: true,
      privateGroupDetails: true,
      publicGroupDetails: true,
    },
  }) as BookingWithDetails | undefined;
  
  if (!bookingRecord) return 0;
  
  if (isIndividualBooking(bookingRecord)) {
    // For individual bookings, payout is already calculated and stored
    return bookingRecord.individualDetails.coachPayoutCents;
  }
  
  if (isPrivateGroupBooking(bookingRecord)) {
    // For private groups, payout is already calculated and stored
    return bookingRecord.privateGroupDetails.coachPayoutCents;
  }
  
  // For public groups, calculate aggregate payout from all captured participants
  if (isPublicGroupBooking(bookingRecord)) {
    const capturedParticipants = await db.query.bookingParticipant.findMany({
      where: and(
        eq(bookingParticipant.bookingId, bookingId),
        eq(bookingParticipant.paymentStatus, 'captured')
      ),
    });
    
    let totalCoachPayoutCents = 0;
    for (const participant of capturedParticipants) {
      if (participant.amountCents) {
        // Use proper pricing calculation, not hardcoded percentage
        const earnings = calculateCoachEarnings(
          participant.amountCents / 100,
          platformFeePercentage
        );
        totalCoachPayoutCents += earnings.coachPayoutCents;
      }
    }
    
    return totalCoachPayoutCents;
  }
  
  return 0;
}
