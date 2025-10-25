'use server';

import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Get coach's upcoming bookings for availability calculation
 */
export async function getCoachBookings(coachId: string) {
  try {
    const now = new Date();

    const bookings = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, coachId),
        eq(booking.status, 'accepted'),
        gte(booking.scheduledStartAt, now)
      ),
      columns: {
        scheduledStartAt: true,
        scheduledEndAt: true,
      },
    });

    return { success: true, bookings };
  } catch (error) {
    console.error('Get coach bookings error:', error);
    return { success: false, bookings: [], error: 'Failed to fetch bookings' };
  }
}

