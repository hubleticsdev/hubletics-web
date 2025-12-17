'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { recurringGroupLesson, booking, publicGroupLessonDetails } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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

    // Fetch public group bookings and filter by recurringLessonId from details
    const allBookings = await db.query.booking.findMany({
      where: eq(booking.bookingType, 'public_group'),
      with: {
        publicGroupDetails: true,
      },
      orderBy: desc(booking.scheduledStartAt),
    });

    const bookings = allBookings.filter(b => b.publicGroupDetails?.recurringLessonId === recurringId);

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
