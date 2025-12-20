'use server';

import { db } from '@/lib/db';
import { booking, coachProfile, coachAllowedDurations } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/transactions';

export async function getCoachBookings(coachId: string) {
  try {
    const now = new Date();

    const bookings = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, coachId),
        eq(booking.approvalStatus, 'accepted'),
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
  allowedDurations,
  defaultDuration,
}: {
  weeklyAvailability: Record<string, Array<{ start: string; end: string }>>;
  blockedDates: string[];
  allowedDurations: number[];
  defaultDuration: number;
}) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    await withTransaction(async (tx) => {
      await tx
        .update(coachProfile)
        .set({
          weeklyAvailability,
          blockedDates,
          sessionDuration: defaultDuration,
          updatedAt: new Date(),
        })
        .where(eq(coachProfile.userId, session.user.id));

      await tx
        .delete(coachAllowedDurations)
        .where(eq(coachAllowedDurations.coachId, session.user.id));

      if (allowedDurations.length > 0) {
        await tx.insert(coachAllowedDurations).values(
          allowedDurations.map((duration) => ({
            coachId: session.user.id,
            durationMinutes: duration,
            isDefault: duration === defaultDuration,
          }))
        );
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Update availability error:', error);
    return { success: false, error: 'Failed to update availability' };
  }
}
