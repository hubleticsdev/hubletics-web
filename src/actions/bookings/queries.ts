'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, individualBookingDetails, privateGroupBookingDetails, publicGroupLessonDetails, bookingParticipant } from '@/lib/db/schema';
import { eq, and, or, gte, gt, inArray } from 'drizzle-orm';
import { deriveUiBookingStatusFromBooking, UiBookingStatus } from '@/lib/booking-status';
import type { BookingWithDetails } from '@/lib/booking-type-guards';
import { isIndividualBooking, isPrivateGroupBooking, isPublicGroupBooking } from '@/lib/booking-type-guards';

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

    // Support all booking types
    const conditions = [];

    // Add user-specific filters
    if (session.user.role === 'coach') {
      conditions.push(eq(booking.coachId, session.user.id));
    }
    if (status) {
      if (status === 'awaiting_coach') {
        conditions.push(eq(booking.approvalStatus, 'pending_review'));
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
      }
      // 'awaiting_payment' and 'open' will be filtered after loading details
    }

    let bookings = await db.query.booking.findMany({
      where: and(...conditions),
      with: {
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        individualDetails: {
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
        },
        privateGroupDetails: {
          with: {
            organizer: {
              columns: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        publicGroupDetails: true,
      },
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
    });

    // Filter for clients
    if (session.user.role === 'client') {
      // Get public group bookings where user is a participant
      const publicGroupBookingIds = bookings
        .filter(b => b.bookingType === 'public_group')
        .map(b => b.id);
      
      const userParticipantBookings = publicGroupBookingIds.length > 0
        ? await db.query.bookingParticipant.findMany({
            where: and(
              inArray(bookingParticipant.bookingId, publicGroupBookingIds),
              eq(bookingParticipant.userId, session.user.id)
            ),
            columns: { bookingId: true },
          })
        : [];
      
      const userPublicGroupIds = new Set(userParticipantBookings.map(p => p.bookingId));
      
      bookings = bookings.filter(booking => {
        if (booking.bookingType === 'individual') {
          return booking.individualDetails?.clientId === session.user.id;
        } else if (booking.bookingType === 'private_group') {
          return booking.privateGroupDetails?.organizerId === session.user.id;
        } else if (booking.bookingType === 'public_group') {
          return userPublicGroupIds.has(booking.id);
        }
        return false;
      });
    }
    
    // Apply status filtering after loading details (for statuses that depend on detail tables)
    if (status === 'awaiting_payment') {
      bookings = bookings.filter(booking => {
        const paymentStatus = booking.bookingType === 'individual'
          ? booking.individualDetails?.paymentStatus
          : booking.bookingType === 'private_group'
          ? booking.privateGroupDetails?.paymentStatus
          : null;
        return paymentStatus === 'awaiting_client_payment';
      });
    } else if (status === 'open') {
      bookings = bookings.filter(booking => {
        return booking.bookingType === 'public_group' 
          && booking.publicGroupDetails?.capacityStatus === 'open';
      });
    }

    // Count participants for group bookings
    const groupBookingIds = bookings
      .filter(b => b.bookingType === 'private_group' || b.bookingType === 'public_group')
      .map(b => b.id);
    const participantCounts: Record<string, number> = {};

    if (groupBookingIds.length > 0) {
      const participants = await db.query.bookingParticipant.findMany({
        where: inArray(bookingParticipant.bookingId, groupBookingIds),
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
      status: deriveUiBookingStatusFromBooking(b as BookingWithDetails),
      pendingParticipantsCount: (b.bookingType === 'private_group' || b.bookingType === 'public_group')
        ? (participantCounts[b.id] || 0)
        : undefined,
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

    // Get all pending booking requests for this coach
    const pendingBookings = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, session.user.id),
        eq(booking.approvalStatus, 'pending_review')
      ),
      with: {
        individualDetails: {
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
        },
        privateGroupDetails: {
          with: {
            organizer: {
              columns: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: (bookings, { asc }) => [asc(bookings.scheduledStartAt)],
    });

    // Get public group lesson participant requests
    const publicGroupBookings = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, session.user.id),
        eq(booking.bookingType, 'public_group'),
        eq(booking.approvalStatus, 'accepted')
      ),
      with: {
        publicGroupDetails: true,
      },
      orderBy: (bookings, { asc }) => [asc(bookings.scheduledStartAt)],
    });

    // Get pending participants for public group bookings
    const publicGroupBookingIds = publicGroupBookings.map(b => b.id);
    const pendingParticipants = publicGroupBookingIds.length > 0 ? await db.query.bookingParticipant.findMany({
      where: and(
        inArray(bookingParticipant.bookingId, publicGroupBookingIds),
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
        booking: {
          with: {
            publicGroupDetails: true,
          },
        },
      },
    }) : [];

    // Group participants by booking
    const participantsByBooking = pendingParticipants.reduce((acc, participant) => {
      if (!acc[participant.bookingId]) {
        acc[participant.bookingId] = [];
      }
      acc[participant.bookingId].push(participant);
      return acc;
    }, {} as Record<string, typeof pendingParticipants>);

    // Combine all booking requests and flatten detail fields for backward compatibility
    const combinedBookings = [
      ...pendingBookings.map(b => {
        const bookingWithDetails = b as BookingWithDetails;
        let clientMessage: string | null = null;
        let clientData: { id: string; name: string; email: string; image: string | null } | undefined = undefined;

        if (isIndividualBooking(bookingWithDetails)) {
          clientMessage = bookingWithDetails.individualDetails.clientMessage ?? null;
          const details = b.individualDetails as typeof b.individualDetails & {
            client?: { id: string; name: string; email: string; image: string | null } | null;
          };
          clientData = (details as any).client ?? undefined;
        } else if (isPrivateGroupBooking(bookingWithDetails)) {
          clientMessage = bookingWithDetails.privateGroupDetails.clientMessage ?? null;
          const details = b.privateGroupDetails as typeof b.privateGroupDetails & {
            organizer?: { id: string; name: string; email: string; image: string | null } | null;
          };
          clientData = (details as any).organizer ?? undefined;
        }

        return {
          ...b,
          status: deriveUiBookingStatusFromBooking(bookingWithDetails),
          clientMessage,
          client: clientData,
        };
      }),
      ...publicGroupBookings
        .filter(booking => participantsByBooking[booking.id]?.length > 0)
        .map(booking => {
          const bookingWithDetails = booking as BookingWithDetails;
          return {
            ...booking,
            status: deriveUiBookingStatusFromBooking(bookingWithDetails),
            hasPendingParticipants: true,
            pendingParticipantsCount: participantsByBooking[booking.id]?.length || 0,
            pendingParticipants: participantsByBooking[booking.id] || [],
            // Flatten public group detail fields
            currentParticipants: booking.publicGroupDetails?.currentParticipants ?? 0,
            maxParticipants: booking.publicGroupDetails?.maxParticipants ?? 0,
            pricePerPerson: booking.publicGroupDetails?.pricePerPerson ?? null,
            clientMessage: booking.publicGroupDetails?.clientMessage ?? null,
          };
        }),
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
    const conditions = [
      eq(booking.approvalStatus, 'accepted'),
      eq(booking.fulfillmentStatus, 'scheduled'),
      gte(booking.scheduledStartAt, now)
    ];

    // Add user-specific filters
    if (session.user.role === 'coach') {
      conditions.push(eq(booking.coachId, session.user.id));
    }
    // For clients, we'll filter after the query to avoid complex conditional joins

    let bookings = await db.query.booking.findMany({
      where: and(...conditions),
      with: {
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        individualDetails: {
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
        },
        privateGroupDetails: {
          with: {
            organizer: {
              columns: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        publicGroupDetails: true,
      },
      orderBy: (bookings, { asc }) => [asc(bookings.scheduledStartAt)],
    });

    // Filter for clients (can't do this in SQL due to conditional joins)
    if (session.user.role === 'client') {
      // Get public group bookings where user is a participant
      const publicGroupBookingIds = bookings
        .filter(b => b.bookingType === 'public_group')
        .map(b => b.id);
      
      const userParticipantBookings = publicGroupBookingIds.length > 0
        ? await db.query.bookingParticipant.findMany({
            where: and(
              inArray(bookingParticipant.bookingId, publicGroupBookingIds),
              eq(bookingParticipant.userId, session.user.id)
            ),
            columns: { bookingId: true },
          })
        : [];
      
      const userPublicGroupIds = new Set(userParticipantBookings.map(p => p.bookingId));
      
      bookings = bookings.filter(booking => {
        if (booking.bookingType === 'individual') {
          return booking.individualDetails?.clientId === session.user.id;
        } else if (booking.bookingType === 'private_group') {
          return booking.privateGroupDetails?.organizerId === session.user.id;
        } else if (booking.bookingType === 'public_group') {
          return userPublicGroupIds.has(booking.id);
        }
        return false;
      });
    }
    
    // Format results and flatten detail table fields for backward compatibility
    const formattedBookings = bookings.map(b => {
      const bookingWithDetails = b as BookingWithDetails;
      let expectedGrossCents: number | null = null;
      let clientMessage: string | null = null;
      let client: { id: string; name: string; email: string; image: string | null } | null = null;

      if (isIndividualBooking(bookingWithDetails)) {
        expectedGrossCents = bookingWithDetails.individualDetails.clientPaysCents;
        clientMessage = bookingWithDetails.individualDetails.clientMessage ?? null;
        // Access client relation from query result
        const details = b.individualDetails as typeof b.individualDetails & {
          client?: { id: string; name: string; email: string; image: string | null } | null;
        };
        client = (details as any).client ?? null;
      } else if (isPrivateGroupBooking(bookingWithDetails)) {
        expectedGrossCents = bookingWithDetails.privateGroupDetails.totalGrossCents;
        clientMessage = bookingWithDetails.privateGroupDetails.clientMessage ?? null;
        // Access organizer relation from query result
        const details = b.privateGroupDetails as typeof b.privateGroupDetails & {
          organizer?: { id: string; name: string; email: string; image: string | null } | null;
        };
        client = (details as any).organizer ?? null;
      } else if (isPublicGroupBooking(bookingWithDetails)) {
        clientMessage = bookingWithDetails.publicGroupDetails.clientMessage ?? null;
      }

      return {
        ...b,
        status: deriveUiBookingStatusFromBooking(bookingWithDetails),
        expectedGrossCents,
        clientMessage,
        client,
      };
    });

    return { success: true, bookings: formattedBookings };
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

    // First, get the booking with all details
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
      with: {
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        individualDetails: {
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
        },
        privateGroupDetails: {
          with: {
            organizer: {
              columns: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        publicGroupDetails: true,
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found', booking: null };
    }

    // Check access permissions
    const isCoach = bookingRecord.coachId === session.user.id;
    const isClient = 
      (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails?.clientId === session.user.id) ||
      (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails?.organizerId === session.user.id);
    
    // For public groups, check if user is a participant
    let isParticipant = false;
    if (bookingRecord.bookingType === 'public_group') {
      const participant = await db.query.bookingParticipant.findFirst({
        where: and(
          eq(bookingParticipant.bookingId, bookingId),
          eq(bookingParticipant.userId, session.user.id)
        ),
      });
      isParticipant = !!participant;
    }

    if (!isCoach && !isClient && !isParticipant) {
      return { success: false, error: 'Unauthorized', booking: null };
    }

    return {
      success: true,
      booking: {
        ...bookingRecord,
        status: deriveUiBookingStatusFromBooking(bookingRecord as BookingWithDetails),
      },
    };
  } catch (error) {
    console.error('Get booking error:', error);
    return { success: false, error: 'Failed to fetch booking', booking: null };
  }
}
