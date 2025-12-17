'use server';

import { db } from '@/lib/db';
import { booking, bookingParticipant, publicGroupLessonDetails } from '@/lib/db/schema';
import { eq, and, gte, inArray } from 'drizzle-orm';

export async function getPublicGroupLessons(coachId: string) {
  try {
    const now = new Date();

    const lessons = await db
      .select({ bookingId: booking.id })
      .from(booking)
      .innerJoin(
        publicGroupLessonDetails,
        eq(booking.id, publicGroupLessonDetails.bookingId)
      )
      .where(
        and(
          eq(booking.coachId, coachId),
          eq(booking.bookingType, 'public_group'),
          gte(booking.scheduledStartAt, now),
          eq(publicGroupLessonDetails.capacityStatus, 'open')
        )
      );

    const lessonIds = lessons.map(l => l.bookingId);

    const lessonsWithDetails = lessonIds.length > 0
      ? await db.query.booking.findMany({
          where: inArray(booking.id, lessonIds),
          with: {
            publicGroupDetails: true,
          },
          orderBy: (booking, { asc }) => [asc(booking.scheduledStartAt)],
        })
      : [];

    const lessonsWithCounts = lessonsWithDetails.map(lesson => ({
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
