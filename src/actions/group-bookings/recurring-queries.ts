'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { recurringGroupLesson, booking, publicGroupLessonDetails } from '@/lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export async function getMyRecurringLessons() {
  try {
    const session = await requireRole('coach');

    const lessons = await db.query.recurringGroupLesson.findMany({
      where: and(
        eq(recurringGroupLesson.coachId, session.user.id),
        eq(recurringGroupLesson.isActive, true)
      ),
      orderBy: desc(recurringGroupLesson.createdAt),
    });

    return { success: true, lessons };
  } catch (error) {
    console.error('[getMyRecurringLessons]', error);
    return {
      success: false,
      error: 'Failed to fetch recurring lessons',
      lessons: [],
    };
  }
}

export async function getRecurringLessonWithBookings(recurringId: string) {
  try {
    const session = await requireRole('coach');

    const lesson = await db.query.recurringGroupLesson.findFirst({
      where: and(
        eq(recurringGroupLesson.id, recurringId),
        eq(recurringGroupLesson.coachId, session.user.id)
      ),
    });

    if (!lesson) {
      return { success: false, error: 'Recurring lesson not found', lesson: null, bookings: [] };
    }

    const bookingIds = await db
      .select({ bookingId: booking.id })
      .from(booking)
      .innerJoin(
        publicGroupLessonDetails,
        eq(booking.id, publicGroupLessonDetails.bookingId)
      )
      .where(
        and(
          eq(booking.bookingType, 'public_group'),
          eq(publicGroupLessonDetails.recurringLessonId, recurringId)
        )
      );

    const bookings = bookingIds.length > 0
      ? await db.query.booking.findMany({
          where: inArray(booking.id, bookingIds.map(b => b.bookingId)),
          with: {
            publicGroupDetails: true,
          },
          orderBy: desc(booking.scheduledStartAt),
        })
      : [];

    return { success: true, lesson, bookings };
  } catch (error) {
    console.error('[getRecurringLessonWithBookings]', error);
    return {
      success: false,
      error: 'Failed to fetch recurring lesson details',
      lesson: null,
      bookings: [],
    };
  }
}
