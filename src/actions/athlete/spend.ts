'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, individualBookingDetails } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export type AthleteSpendSummary = {
  totalSpent: number;
  completedBookings: number;
};

export async function getAthleteSpendSummary(): Promise<AthleteSpendSummary> {
  const session = await requireRole('client');
  const athleteId = session.user.id;

  const completedBookings = await db
    .select({
      clientPaysCents: individualBookingDetails.clientPaysCents,
    })
    .from(booking)
    .innerJoin(
      individualBookingDetails,
      eq(booking.id, individualBookingDetails.bookingId)
    )
    .where(
      and(
        eq(booking.bookingType, 'individual'),
        eq(booking.fulfillmentStatus, 'completed'),
        eq(individualBookingDetails.clientId, athleteId)
      )
    );

  const totalSpent = completedBookings.reduce(
    (sum, b) => sum + (b.clientPaysCents || 0),
    0
  );

  return {
    totalSpent: Number((totalSpent / 100).toFixed(2)),
    completedBookings: completedBookings.length,
  };
}
