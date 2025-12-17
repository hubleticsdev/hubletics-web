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
        eq(booking.bookingType, 'public_group'),
        gte(booking.scheduledStartAt, now)
      ),
      with: {
        publicGroupDetails: true,
      },
      orderBy: (booking, { asc }) => [asc(booking.scheduledStartAt)],
    });

    const lessonsWithCounts = lessons
      .filter(lesson => lesson.publicGroupDetails?.capacityStatus === 'open')
      .map(lesson => ({
        ...lesson,
        maxParticipants: lesson.publicGroupDetails?.maxParticipants ?? 0,
        minParticipants: lesson.publicGroupDetails?.minParticipants ?? 0,
        pricePerPerson: lesson.publicGroupDetails?.pricePerPerson ?? '0',
        clientMessage: null, // Public lessons don't have clientMessage
        currentParticipants: lesson.publicGroupDetails?.currentParticipants ?? 0,
        paidParticipants: lesson.publicGroupDetails?.capturedParticipants ?? 0,
      }));

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
