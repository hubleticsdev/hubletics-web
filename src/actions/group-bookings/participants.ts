'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function getBookingParticipants(bookingId: string) {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
      with: {
        privateGroupDetails: true,
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    const isCoach = bookingRecord.coachId === session.user.id;
    const participants = await db.query.bookingParticipant.findMany({
      where: eq(bookingParticipant.bookingId, bookingId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
            username: true,
          },
        },
      },
    });

    const isParticipant = participants.some(p => p.userId === session.user.id);

    if (!isCoach && !isParticipant) {
      return { success: false, error: 'Unauthorized' };
    }

    const formattedParticipants = participants.map(p => {
      const user = p.user as { id: string; name: string; email: string; image: string | null; username: string | null };
      return {
        id: p.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        username: user.username,
        paymentStatus: p.paymentStatus,
        status: p.status,
        amountCents: p.amountCents,
        joinedAt: p.joinedAt,
      };
    });

    return {
      success: true,
      participants: formattedParticipants,
      isOrganizer: bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails?.organizerId === session.user.id,
      isCoach,
    };
  } catch (error) {
    console.error('Get booking participants error:', error);
    return { success: false, error: 'Failed to fetch participants' };
  }
}
