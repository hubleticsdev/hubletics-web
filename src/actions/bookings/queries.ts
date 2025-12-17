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

    let bookings;
    if (session.user.role === 'client') {
      const userId = session.user.id;
      
      // Build conditions for individual bookings
      const individualConditions = [
        ...conditions,
        eq(booking.bookingType, 'individual'),
        eq(individualBookingDetails.clientId, userId)
      ];
      
      // Add payment status filter if needed
      if (status === 'awaiting_payment') {
        individualConditions.push(eq(individualBookingDetails.paymentStatus, 'awaiting_client_payment'));
      }
      
      const individualBookingIds = await db
        .select({ bookingId: booking.id })
        .from(booking)
        .innerJoin(
          individualBookingDetails,
          eq(booking.id, individualBookingDetails.bookingId)
        )
        .where(and(...individualConditions));

      // Build conditions for private group bookings
      const privateGroupConditions = [
        ...conditions,
        eq(booking.bookingType, 'private_group'),
        eq(privateGroupBookingDetails.organizerId, userId)
      ];
      
      // Add payment status filter if needed
      if (status === 'awaiting_payment') {
        privateGroupConditions.push(eq(privateGroupBookingDetails.paymentStatus, 'awaiting_client_payment'));
      }
      
      const privateGroupBookingIds = await db
        .select({ bookingId: booking.id })
        .from(booking)
        .innerJoin(
          privateGroupBookingDetails,
          eq(booking.id, privateGroupBookingDetails.bookingId)
        )
        .where(and(...privateGroupConditions));

      // Also include private group bookings where user is a participant
      const privateGroupParticipantBookingIds = await db
        .select({ bookingId: bookingParticipant.bookingId })
        .from(bookingParticipant)
        .innerJoin(booking, eq(bookingParticipant.bookingId, booking.id))
        .innerJoin(
          privateGroupBookingDetails,
          eq(booking.id, privateGroupBookingDetails.bookingId)
        )
        .where(and(
          eq(bookingParticipant.userId, userId),
          eq(booking.bookingType, 'private_group'),
          ...conditions
        ));

      // Build conditions for public group bookings
      const publicGroupConditions = [
        eq(bookingParticipant.userId, userId),
        ...conditions,
        eq(booking.bookingType, 'public_group')
      ];
      
      // Add capacity status filter if needed
      if (status === 'open') {
        publicGroupConditions.push(eq(publicGroupLessonDetails.capacityStatus, 'open'));
      }
      
      const publicGroupBookingIds = await db
        .select({ bookingId: bookingParticipant.bookingId })
        .from(bookingParticipant)
        .innerJoin(booking, eq(bookingParticipant.bookingId, booking.id))
        .innerJoin(
          publicGroupLessonDetails,
          eq(booking.id, publicGroupLessonDetails.bookingId)
        )
        .where(and(...publicGroupConditions));

      // Combine all booking IDs
      const privateGroupIdsSet = new Set([
        ...privateGroupBookingIds.map(b => b.bookingId),
        ...privateGroupParticipantBookingIds.map(b => b.bookingId),
      ]);
      const allBookingIds = [
        ...individualBookingIds.map(b => b.bookingId),
        ...Array.from(privateGroupIdsSet),
        ...publicGroupBookingIds.map(b => b.bookingId),
      ];

      bookings = allBookingIds.length > 0
        ? await db.query.booking.findMany({
            where: inArray(booking.id, allBookingIds),
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
          })
        : [];
    } else {
      bookings = await db.query.booking.findMany({
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
    }
    
    if (session.user.role === 'coach') {
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
    }

    const publicGroupBookingIds = bookings
      .filter(b => b.bookingType === 'public_group')
      .map(b => b.id);
    const pendingParticipantCounts: Record<string, number> = {};

    if (publicGroupBookingIds.length > 0) {
      // Count participants awaiting coach approval for public groups
      const pendingParticipants = await db.query.bookingParticipant.findMany({
        where: and(
          inArray(bookingParticipant.bookingId, publicGroupBookingIds),
          eq(bookingParticipant.status, 'awaiting_coach')
        ),
        columns: {
          bookingId: true,
        },
      });

      pendingParticipants.forEach(p => {
        pendingParticipantCounts[p.bookingId] = (pendingParticipantCounts[p.bookingId] || 0) + 1;
      });
    }

    const bookingsWithCounts = bookings.map(b => ({
      ...b,
      status: deriveUiBookingStatusFromBooking(b as BookingWithDetails),
      pendingParticipantsCount: b.bookingType === 'public_group'
        ? (pendingParticipantCounts[b.id] || 0)
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
        let expectedGrossCents: number | null = null;
        let coachPayoutCents: number | null = null;
        let platformFeeCents: number | null = null;
        let stripeFeeCents: number | null = null;
        let clientMessage: string | null = null;
        let clientData: { id: string; name: string; email: string; image: string | null } | undefined = undefined;

        if (isIndividualBooking(bookingWithDetails)) {
          expectedGrossCents = bookingWithDetails.individualDetails.clientPaysCents;
          coachPayoutCents = bookingWithDetails.individualDetails.coachPayoutCents;
          platformFeeCents = bookingWithDetails.individualDetails.platformFeeCents;
          stripeFeeCents = bookingWithDetails.individualDetails.stripeFeeCents;
          clientMessage = bookingWithDetails.individualDetails.clientMessage ?? null;
          const details = b.individualDetails as typeof b.individualDetails & {
            client?: { id: string; name: string; email: string; image: string | null } | null;
          };
          clientData = (details as any).client ?? undefined;
        } else if (isPrivateGroupBooking(bookingWithDetails)) {
          expectedGrossCents = bookingWithDetails.privateGroupDetails.totalGrossCents;
          coachPayoutCents = bookingWithDetails.privateGroupDetails.coachPayoutCents;
          platformFeeCents = bookingWithDetails.privateGroupDetails.platformFeeCents;
          stripeFeeCents = bookingWithDetails.privateGroupDetails.stripeFeeCents;
          clientMessage = bookingWithDetails.privateGroupDetails.clientMessage ?? null;
          const details = b.privateGroupDetails as typeof b.privateGroupDetails & {
            organizer?: { id: string; name: string; email: string; image: string | null } | null;
          };
          clientData = (details as any).organizer ?? undefined;
        }

        return {
          ...b,
          status: deriveUiBookingStatusFromBooking(bookingWithDetails),
          expectedGrossCents,
          coachPayoutCents,
          platformFeeCents,
          stripeFeeCents,
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

    let bookings;
    if (session.user.role === 'client') {
      const userId = session.user.id;
      
      const individualBookingIds = await db
        .select({ bookingId: booking.id })
        .from(booking)
        .innerJoin(
          individualBookingDetails,
          eq(booking.id, individualBookingDetails.bookingId)
        )
        .where(
          and(
            ...conditions,
            eq(booking.bookingType, 'individual'),
            eq(individualBookingDetails.clientId, userId)
          )
        );

      const privateGroupBookingIds = await db
        .select({ bookingId: booking.id })
        .from(booking)
        .innerJoin(
          privateGroupBookingDetails,
          eq(booking.id, privateGroupBookingDetails.bookingId)
        )
        .where(
          and(
            ...conditions,
            eq(booking.bookingType, 'private_group'),
            eq(privateGroupBookingDetails.organizerId, userId)
          )
        );

      const publicGroupBookingIds = await db
        .select({ bookingId: bookingParticipant.bookingId })
        .from(bookingParticipant)
        .innerJoin(booking, eq(bookingParticipant.bookingId, booking.id))
        .where(
          and(
            eq(bookingParticipant.userId, userId),
            ...conditions,
            eq(booking.bookingType, 'public_group')
          )
        );

      const allBookingIds = [
        ...individualBookingIds.map(b => b.bookingId),
        ...privateGroupBookingIds.map(b => b.bookingId),
        ...publicGroupBookingIds.map(b => b.bookingId),
      ];

      bookings = allBookingIds.length > 0
        ? await db.query.booking.findMany({
            where: inArray(booking.id, allBookingIds),
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
          })
        : [];
    } else {
      bookings = await db.query.booking.findMany({
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
    }
    
    // Format results and flatten detail table fields for backward compatibility
    const formattedBookings = bookings.map(b => {
      const bookingWithDetails = b as BookingWithDetails;
      let expectedGrossCents: number | null = null;
      let coachPayoutCents: number | null = null;
      let platformFeeCents: number | null = null;
      let stripeFeeCents: number | null = null;
      let clientMessage: string | null = null;
      let client: { id: string; name: string; email: string; image: string | null } | null = null;

      if (isIndividualBooking(bookingWithDetails)) {
        expectedGrossCents = bookingWithDetails.individualDetails.clientPaysCents;
        coachPayoutCents = bookingWithDetails.individualDetails.coachPayoutCents;
        platformFeeCents = bookingWithDetails.individualDetails.platformFeeCents;
        stripeFeeCents = bookingWithDetails.individualDetails.stripeFeeCents;
        clientMessage = bookingWithDetails.individualDetails.clientMessage ?? null;
        // Access client relation from query result
        const details = b.individualDetails as typeof b.individualDetails & {
          client?: { id: string; name: string; email: string; image: string | null } | null;
        };
        client = (details as any).client ?? null;
      } else if (isPrivateGroupBooking(bookingWithDetails)) {
        expectedGrossCents = bookingWithDetails.privateGroupDetails.totalGrossCents;
        coachPayoutCents = bookingWithDetails.privateGroupDetails.coachPayoutCents;
        platformFeeCents = bookingWithDetails.privateGroupDetails.platformFeeCents;
        stripeFeeCents = bookingWithDetails.privateGroupDetails.stripeFeeCents;
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
        coachPayoutCents,
        platformFeeCents,
        stripeFeeCents,
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
