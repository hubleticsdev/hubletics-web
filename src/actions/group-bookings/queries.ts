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
        eq(booking.status, 'open'),
        gte(booking.scheduledStartAt, now)
      ),
      orderBy: (booking, { asc }) => [asc(booking.scheduledStartAt)],
    });

    const lessonsWithCounts = await Promise.all(
      lessons.map(async (lesson) => {
        const participants = await db.query.bookingParticipant.findMany({
          where: and(
            eq(bookingParticipant.bookingId, lesson.id),
            eq(bookingParticipant.paymentStatus, 'paid')
          ),
        });

        return {
          ...lesson,
          currentParticipants: participants.length,
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

