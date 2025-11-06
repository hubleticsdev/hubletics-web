'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export type AthleteSpendSummary = {
  totalSpent: number;
  completedBookings: number;
};

export async function getAthleteSpendSummary(): Promise<AthleteSpendSummary> {
  const session = await requireRole('client');
  const athleteId = session.user.id;

  // Get all completed bookings where athlete is the client
  const completedBookings = await db.query.booking.findMany({
    where: and(
      eq(booking.clientId, athleteId),
      eq(booking.status, 'completed')
    ),
    columns: {
      clientPaid: true,
    },
  });

  // Calculate total spent
  const totalSpent = completedBookings.reduce(
    (sum, b) => sum + parseFloat(b.clientPaid as unknown as string),
    0
  );

  return {
    totalSpent: Number(totalSpent.toFixed(2)),
    completedBookings: completedBookings.length,
  };
}
