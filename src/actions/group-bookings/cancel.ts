'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { refundBookingPayment } from '@/lib/stripe';
import { revalidatePath } from 'next/cache';

export async function leavePublicLesson(lessonId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const participant = await db.query.bookingParticipant.findFirst({
      where: and(
        eq(bookingParticipant.bookingId, lessonId),
        eq(bookingParticipant.userId, session.user.id)
      ),
    });

    if (!participant) {
      return { success: false, error: 'You are not part of this lesson' };
    }

    const lesson = await db.query.booking.findFirst({
      where: eq(booking.id, lessonId),
    });

    if (!lesson || lesson.groupType !== 'public') {
      return { success: false, error: 'Lesson not found or not a public group lesson' };
    }

    if (new Date() >= new Date(lesson.scheduledStartAt)) {
      return { success: false, error: 'Cannot leave a lesson that has already started' };
    }

    if (participant.paymentStatus === 'paid' && participant.stripePaymentIntentId) {
      await refundBookingPayment(participant.stripePaymentIntentId);
    }

    await db
      .delete(bookingParticipant)
      .where(and(
        eq(bookingParticipant.bookingId, lessonId),
        eq(bookingParticipant.userId, session.user.id)
      ));

    if (lesson.currentParticipants && lesson.currentParticipants > 0) {
      await db
        .update(booking)
        .set({
          currentParticipants: lesson.currentParticipants - 1,
        })
        .where(eq(booking.id, lessonId));
    }

    console.log(`User ${session.user.id} left public lesson ${lessonId}`);

    revalidatePath('/dashboard/bookings');
    revalidatePath(`/coaches/${lesson.coachId}`);

    return { success: true };
  } catch (error) {
    console.error('Leave public lesson error:', error);
    return { success: false, error: 'Failed to leave lesson' };
  }
}

export async function cancelPrivateGroupBooking(bookingId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.organizerId, session.user.id),
        eq(booking.groupType, 'private')
      ),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found or you are not the organizer' };
    }

    if (new Date() >= new Date(bookingRecord.scheduledStartAt)) {
      return { success: false, error: 'Cannot cancel a lesson that has already started' };
    }

    if (bookingRecord.stripePaymentIntentId && bookingRecord.status === 'accepted') {
      await refundBookingPayment(bookingRecord.stripePaymentIntentId);
    }

    await db
      .update(booking)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    console.log(`Private group booking ${bookingId} cancelled by organizer ${session.user.id}`);

    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Cancel private group booking error:', error);
    return { success: false, error: 'Failed to cancel booking' };
  }
}

export async function coachCancelGroupLesson(lessonId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const lesson = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, lessonId),
        eq(booking.coachId, session.user.id),
        eq(booking.isGroupBooking, true)
      ),
    });

    if (!lesson) {
      return { success: false, error: 'Lesson not found or you are not the coach' };
    }

    const participants = await db.query.bookingParticipant.findMany({
      where: and(
        eq(bookingParticipant.bookingId, lessonId),
        eq(bookingParticipant.paymentStatus, 'paid')
      ),
    });

    for (const participant of participants) {
      if (participant.stripePaymentIntentId) {
        try {
          await refundBookingPayment(participant.stripePaymentIntentId);
        } catch (error) {
          console.error(`Failed to refund participant ${participant.userId}:`, error);
        }
      }
    }

    if (lesson.groupType === 'private' && lesson.stripePaymentIntentId) {
      try {
        await refundBookingPayment(lesson.stripePaymentIntentId);
      } catch (error) {
        console.error(`Failed to refund main payment intent:`, error);
      }
    }

    await db
      .update(booking)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(booking.id, lessonId));

    console.log(`Coach ${session.user.id} cancelled group lesson ${lessonId}`);

    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Coach cancel group lesson error:', error);
    return { success: false, error: 'Failed to cancel lesson' };
  }
}

