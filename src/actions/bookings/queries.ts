'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant } from '@/lib/db/schema';
import { eq, and, or, gte, gt, inArray } from 'drizzle-orm';
import { deriveUiBookingStatus, UiBookingStatus } from '@/lib/booking-status';

type BookingRow = typeof booking.$inferSelect;

function mapBookingStatus(b: BookingRow): UiBookingStatus {
  return deriveUiBookingStatus({
    approvalStatus: b.approvalStatus,
    paymentStatus: b.paymentStatus,
    fulfillmentStatus: b.fulfillmentStatus,
    capacityStatus: b.capacityStatus,
  });
}

/**
 * Get bookings for the current user
 */
export async function getMyBookings(
  status?: UiBookingStatus
) {
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
      if (status === 'awaiting_coach') {
        conditions.push(eq(booking.approvalStatus, 'pending_review'));
      } else if (status === 'awaiting_payment') {
        conditions.push(eq(booking.paymentStatus, 'awaiting_client_payment'));
      } else if (status === 'confirmed') {
        conditions.push(eq(booking.approvalStatus, 'accepted'));
      } else if (status === 'declined') {
        conditions.push(eq(booking.approvalStatus, 'declined'));
      } else if (status === 'cancelled') {
        conditions.push(eq(booking.approvalStatus, 'cancelled'));
      } else if (status === 'completed') {
        conditions.push(eq(booking.fulfillmentStatus, 'completed'));
      } else if (status === 'disputed') {
        conditions.push(eq(booking.fulfillmentStatus, 'disputed'));
      } else if (status === 'open') {
        conditions.push(eq(booking.capacityStatus, 'open'));
      }
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
          eq(bookingParticipant.paymentStatus, 'requires_payment_method'),
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

    const bookingsWithCounts = bookings.map(b => ({
      ...b,
      status: mapBookingStatus(b),
      pendingParticipantsCount: b.isGroupBooking ? (participantCounts[b.id] || 0) : undefined,
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

    // Get individual pending bookings
    const individualBookings = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, session.user.id),
        eq(booking.approvalStatus, 'pending_review'),
        eq(booking.isGroupBooking, false)
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

    // Get group bookings
    const groupBookingsBase = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, session.user.id),
        eq(booking.isGroupBooking, true),
        eq(booking.groupType, 'public'),
        eq(booking.capacityStatus, 'open')
      ),
      orderBy: (bookings, { asc }) => [asc(bookings.scheduledStartAt)],
    });

    // Get pending and paid participants for these group bookings
    // Pending = payment not completed, Paid = payment completed but coach hasn't accepted yet
    const groupBookingIds = groupBookingsBase.map(b => b.id);
    const participants = groupBookingIds.length > 0 ? await db.query.bookingParticipant.findMany({
      where: and(
        inArray(bookingParticipant.bookingId, groupBookingIds),
        or(
          eq(bookingParticipant.status, 'awaiting_payment'),
          eq(bookingParticipant.status, 'awaiting_coach')
        )
      ),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }) : [];

    const participantsByBooking = participants.reduce((acc, participant) => {
      if (!acc[participant.bookingId]) {
        acc[participant.bookingId] = [];
      }
      acc[participant.bookingId].push(participant);
      return acc;
    }, {} as Record<string, typeof participants>);

    const groupBookings = groupBookingsBase
      .map(booking => ({
        ...booking,
        participants: participantsByBooking[booking.id] || [],
      }))
      .filter(booking => booking.participants.length > 0);

    // Combine and format the results
    const combinedBookings = [
      ...individualBookings.map(b => ({
        ...b,
        status: mapBookingStatus(b),
      })),
      ...groupBookings
        .filter(booking => booking.participants.length > 0)
        .map(booking => ({
          ...booking,
          status: mapBookingStatus(booking as any),
          hasPendingParticipants: true,
          pendingParticipantsCount: booking.participants.length,
          pendingParticipants: booking.participants,
        })),
    ];

    return { success: true, bookings: combinedBookings };
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

    // Get individual accepted bookings
    const individualBookings = await db.query.booking.findMany({
      where: and(
        or(
          eq(booking.clientId, session.user.id),
          eq(booking.coachId, session.user.id)
        ),
        eq(booking.approvalStatus, 'accepted'),
        eq(booking.fulfillmentStatus, 'scheduled'),
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

    // For coaches: Get their group bookings that have accepted participants (status = 'accepted')
    // For clients: Get group bookings where they are confirmed participants (paymentStatus = 'paid')
    let groupBookings: any[] = [];

    if (session.user.role === 'coach') {
      // Coaches see their own group bookings that have accepted participants (currentParticipants > 0)
      groupBookings = await db.query.booking.findMany({
        where: and(
          eq(booking.coachId, session.user.id),
          eq(booking.isGroupBooking, true),
          gt(booking.currentParticipants, 0),
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
    } else {
      // Clients see group bookings where they are confirmed participants
      const groupBookingIds = await db
        .select({ bookingId: bookingParticipant.bookingId })
        .from(bookingParticipant)
        .where(and(
          eq(bookingParticipant.userId, session.user.id),
          eq(bookingParticipant.paymentStatus, 'captured')
        ));

      const userGroupBookingIds = groupBookingIds.map(row => row.bookingId);

      groupBookings = userGroupBookingIds.length > 0 ? await db.query.booking.findMany({
        where: and(
          eq(booking.isGroupBooking, true),
          gte(booking.scheduledStartAt, now),
          inArray(booking.id, userGroupBookingIds)
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
      }) : [];
    }

    const userGroupBookings = groupBookings;

    const combinedBookings = [...individualBookings, ...userGroupBookings].map((b) => ({
      ...b,
      status: mapBookingStatus(b),
    }));

    return { success: true, bookings: combinedBookings };
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

    return {
      success: true,
      booking: {
        ...bookingRecord,
        status: mapBookingStatus(bookingRecord),
      },
    };
  } catch (error) {
    console.error('Get booking error:', error);
    return { success: false, error: 'Failed to fetch booking', booking: null };
  }
}
