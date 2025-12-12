'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant } from '@/lib/db/schema';
import { eq, and, or, gte, inArray } from 'drizzle-orm';

/**
 * Get bookings for the current user
 */
export async function getMyBookings(status?: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed') {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Unauthorized', bookings: [] };
    }

    const conditions = [
      or(
        eq(booking.clientId, session.user.id),
        eq(booking.coachId, session.user.id)
      ),
    ];

    if (status) {
      conditions.push(eq(booking.status, status));
    }

    const bookings = await db.query.booking.findMany({
      where: and(...conditions),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
    });

    const groupBookingIds = bookings.filter(b => b.isGroupBooking).map(b => b.id);
    const participantCounts: Record<string, number> = {};

    if (groupBookingIds.length > 0) {
      const participants = await db.query.bookingParticipant.findMany({
        where: and(
          eq(bookingParticipant.paymentStatus, 'pending'),
          inArray(bookingParticipant.bookingId, groupBookingIds)
        ),
        columns: {
          bookingId: true,
        },
      });

      participants.forEach(p => {
        participantCounts[p.bookingId] = (participantCounts[p.bookingId] || 0) + 1;
      });
    }

    const bookingsWithCounts = bookings.map(booking => ({
      ...booking,
      pendingParticipantsCount: booking.isGroupBooking ? (participantCounts[booking.id] || 0) : undefined,
    }));

    return { success: true, bookings: bookingsWithCounts };
  } catch (error) {
    console.error('Get bookings error:', error);
    return { success: false, error: 'Failed to fetch bookings', bookings: [] };
  }
}

/**
 * Get pending booking requests for a coach
 */
export async function getPendingBookingRequests() {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized', bookings: [] };
    }

    const bookings = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, session.user.id),
        eq(booking.status, 'pending')
      ),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: (bookings, { asc }) => [asc(bookings.scheduledStartAt)],
    });

    return { success: true, bookings };
  } catch (error) {
    console.error('Get pending requests error:', error);
    return { success: false, error: 'Failed to fetch pending requests', bookings: [] };
  }
}

/**
 * Get upcoming bookings
 */
export async function getUpcomingBookings() {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Unauthorized', bookings: [] };
    }

    const now = new Date();

    const bookings = await db.query.booking.findMany({
      where: and(
        or(
          eq(booking.clientId, session.user.id),
          eq(booking.coachId, session.user.id)
        ),
        eq(booking.status, 'accepted'),
        gte(booking.scheduledStartAt, now)
      ),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: (bookings, { asc }) => [asc(bookings.scheduledStartAt)],
    });

    return { success: true, bookings };
  } catch (error) {
    console.error('Get upcoming bookings error:', error);
    return { success: false, error: 'Failed to fetch upcoming bookings', bookings: [] };
  }
}

/**
 * Get a single booking by ID
 */
export async function getBookingById(bookingId: string) {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Unauthorized', booking: null };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        or(
          eq(booking.clientId, session.user.id),
          eq(booking.coachId, session.user.id)
        )
      ),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found', booking: null };
    }

    return { success: true, booking: bookingRecord };
  } catch (error) {
    console.error('Get booking error:', error);
    return { success: false, error: 'Failed to fetch booking', booking: null };
  }
}

