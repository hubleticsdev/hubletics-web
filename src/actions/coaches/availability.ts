'use server';

import { db } from '@/lib/db';
import { booking, coachProfile } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

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

export async function updateCoachAvailability({
  weeklyAvailability,
  blockedDates,
  sessionDuration,
}: {
  weeklyAvailability: Record<string, Array<{ start: string; end: string }>>;
  blockedDates: string[];
  sessionDuration: number;
}) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    await db
      .update(coachProfile)
      .set({
        weeklyAvailability,
        blockedDates,
        sessionDuration,
        updatedAt: new Date(),
      })
      .where(eq(coachProfile.userId, session.user.id));

    return { success: true };
  } catch (error) {
    console.error('Update availability error:', error);
    return { success: false, error: 'Failed to update availability' };
  }
}

