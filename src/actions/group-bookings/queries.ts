'use server';

import { db } from '@/lib/db';
import { booking, bookingParticipant } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';

export async function getPublicGroupLessons(coachId: string) {
  try {
    const now = new Date();

    const lessons = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, coachId),
        eq(booking.isGroupBooking, true),
        eq(booking.groupType, 'public'),
        eq(booking.capacityStatus, 'open'),
        gte(booking.scheduledStartAt, now)
      ),
      orderBy: (booking, { asc }) => [asc(booking.scheduledStartAt)],
    });

    const lessonsWithCounts = await Promise.all(
      lessons.map(async (lesson) => {
        const allParticipants = await db.query.bookingParticipant.findMany({
          where: eq(bookingParticipant.bookingId, lesson.id),
        });

        const paidParticipants = allParticipants.filter(p => p.paymentStatus === 'captured');

        return {
          ...lesson,
          currentParticipants: allParticipants.length,
          paidParticipants: paidParticipants.length,
        };
      })
    );

    return { success: true, lessons: lessonsWithCounts };
  } catch (error) {
    console.error('Get public group lessons error:', error);
    return { success: false, error: 'Failed to fetch group lessons', lessons: [] };
  }
}

export async function getCoachGroupLessons(coachId: string) {
  try {
    const openLessons = await getPublicGroupLessons(coachId);

    return { success: true, lessons: openLessons.lessons };
  } catch (error) {
    console.error('Get coach group lessons error:', error);
    return { success: false, error: 'Failed to fetch lessons', lessons: [] };
  }
}
