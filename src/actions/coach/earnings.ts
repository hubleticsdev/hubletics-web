'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile, bookingParticipant, user } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { deriveUiBookingStatusFromBooking } from '@/lib/booking-status';
import type { BookingWithDetails } from '@/lib/booking-type-guards';
import { isIndividualBooking, isPrivateGroupBooking, isPublicGroupBooking } from '@/lib/booking-type-guards';
import { calculateCoachEarnings } from '@/lib/pricing';

export type EarningsSummary = {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  completedBookings: number;
  upcomingBookings: number;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
};

export type BookingEarning = {
  id: string;
  clientName: string;
  scheduledStartAt: Date;
  duration: number;
  coachPayout: number;
  status: string;
  stripeTransferId: string | null;
};

export async function getCoachEarningsSummary(): Promise<EarningsSummary> {
  const session = await requireRole('coach');
  const coachId = session.user.id;

  const profile = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, coachId),
    columns: {
      stripeAccountId: true,
      stripeOnboardingComplete: true,
    },
  });

  // Get completed bookings with all detail tables
  const completedBookings = await db.query.booking.findMany({
    where: and(
      eq(booking.coachId, coachId),
      eq(booking.fulfillmentStatus, 'completed')
    ),
    with: {
      individualDetails: true,
      privateGroupDetails: true,
      publicGroupDetails: true,
    },
  });

  // Get platform fee percentage for public group calculations
  const coachUser = await db.query.user.findFirst({
    where: eq(user.id, coachId),
    columns: {
      platformFeePercentage: true,
    },
  });
  const platformFeePercentage = coachUser?.platformFeePercentage
    ? parseFloat(coachUser.platformFeePercentage as unknown as string)
    : 15;

  // Calculate earnings from detail tables
  let totalEarningsCents = 0;
  let pendingBalanceCents = 0;

  for (const bookingRecord of completedBookings) {
    const b = bookingRecord as BookingWithDetails;
    let coachPayoutCents = 0;
    let stripeTransferId: string | null = null;

    if (isIndividualBooking(b)) {
      coachPayoutCents = b.individualDetails.coachPayoutCents;
      stripeTransferId = b.individualDetails.stripeTransferId ?? null;
    } else if (isPrivateGroupBooking(b)) {
      coachPayoutCents = b.privateGroupDetails.coachPayoutCents;
      stripeTransferId = b.privateGroupDetails.stripeTransferId ?? null;
    } else if (isPublicGroupBooking(b)) {
      // Calculate aggregate payout from captured participants
      const capturedParticipants = await db.query.bookingParticipant.findMany({
        where: and(
          eq(bookingParticipant.bookingId, b.id),
          eq(bookingParticipant.paymentStatus, 'captured')
        ),
      });

      for (const participant of capturedParticipants) {
        if (participant.amountCents) {
          const earnings = calculateCoachEarnings(
            participant.amountCents / 100,
            platformFeePercentage
          );
          coachPayoutCents += earnings.coachPayoutCents;
        }
      }

      stripeTransferId = b.publicGroupDetails.stripeTransferId ?? null;
    }

    totalEarningsCents += coachPayoutCents;
    if (!stripeTransferId) {
      pendingBalanceCents += coachPayoutCents;
    }
  }

  const upcomingBookings = await db.query.booking.findMany({
    where: and(
      eq(booking.coachId, coachId),
      eq(booking.approvalStatus, 'accepted'),
      eq(booking.fulfillmentStatus, 'scheduled')
    ),
    columns: {
      id: true,
    },
  });

  return {
    totalEarnings: Number((totalEarningsCents / 100).toFixed(2)),
    availableBalance: Number(((totalEarningsCents - pendingBalanceCents) / 100).toFixed(2)),
    pendingBalance: Number((pendingBalanceCents / 100).toFixed(2)),
    completedBookings: completedBookings.length,
    upcomingBookings: upcomingBookings.length,
    stripeAccountId: profile?.stripeAccountId || null,
    stripeOnboardingComplete: profile?.stripeOnboardingComplete || false,
  };
}

export async function getCoachBookingEarnings(): Promise<BookingEarning[]> {
  const session = await requireRole('coach');
  const coachId = session.user.id;

  const bookings = await db.query.booking.findMany({
    where: eq(booking.coachId, coachId),
    with: {
      individualDetails: {
        with: {
          client: {
            columns: {
              name: true,
            },
          },
        },
      },
      privateGroupDetails: {
        with: {
          organizer: {
            columns: {
              name: true,
            },
          },
        },
      },
      publicGroupDetails: true,
    },
    orderBy: (bookings, { desc }) => [desc(bookings.scheduledStartAt)],
    limit: 50,
  });

  // Get platform fee for public group calculations
  const coachUserForList = await db.query.user.findFirst({
    where: eq(user.id, coachId),
    columns: {
      platformFeePercentage: true,
    },
  });
  const platformFeePercentageForList = coachUserForList?.platformFeePercentage
    ? parseFloat(coachUserForList.platformFeePercentage as unknown as string)
    : 15;

  // Get public group booking IDs to fetch participants in batch
  const publicGroupIds = bookings
    .filter(b => b.bookingType === 'public_group')
    .map(b => b.id);

  // Fetch all captured participants for public groups in one query
  const publicGroupParticipants = publicGroupIds.length > 0
    ? await db.query.bookingParticipant.findMany({
        where: and(
          inArray(bookingParticipant.bookingId, publicGroupIds),
          eq(bookingParticipant.paymentStatus, 'captured')
        ),
      })
    : [];

  // Group participants by booking ID
  const participantsByBooking = publicGroupParticipants.reduce((acc, p) => {
    if (!acc[p.bookingId]) {
      acc[p.bookingId] = [];
    }
    acc[p.bookingId].push(p);
    return acc;
  }, {} as Record<string, typeof publicGroupParticipants>);

  return bookings.map(bookingRecord => {
    let clientName = 'Unknown';
    let coachPayoutCents = 0;
    let stripeTransferId: string | null = null;

    if (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails) {
      const details = bookingRecord.individualDetails;
      const clientRelation = (details as { client?: { name: string } | null }).client;
      clientName = clientRelation?.name || 'Unknown Client';
      coachPayoutCents = details.coachPayoutCents;
      stripeTransferId = details.stripeTransferId ?? null;
    } else if (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails) {
      const details = bookingRecord.privateGroupDetails;
      const organizerRelation = (details as { organizer?: { name: string } | null }).organizer;
      clientName = organizerRelation?.name || 'Unknown Organizer';
      coachPayoutCents = details.coachPayoutCents;
      stripeTransferId = details.stripeTransferId ?? null;
    } else if (bookingRecord.bookingType === 'public_group' && bookingRecord.publicGroupDetails) {
      clientName = `Group Lesson (${bookingRecord.publicGroupDetails.capturedParticipants} participants)`;
      stripeTransferId = bookingRecord.publicGroupDetails.stripeTransferId ?? null;
      
      // Calculate payout from captured participants
      const participants = participantsByBooking[bookingRecord.id] || [];
      for (const participant of participants) {
        if (participant.amountCents) {
          const earnings = calculateCoachEarnings(
            participant.amountCents / 100,
            platformFeePercentageForList
          );
          coachPayoutCents += earnings.coachPayoutCents;
        }
      }
    }

    return {
      id: bookingRecord.id,
      clientName,
      scheduledStartAt: bookingRecord.scheduledStartAt,
      duration: bookingRecord.duration,
      coachPayout: coachPayoutCents / 100,
      status: deriveUiBookingStatusFromBooking(bookingRecord as BookingWithDetails),
      stripeTransferId,
    };
  });
}

export async function getStripeLoginLink(): Promise<{ url: string } | { error: string }> {
  try {
    const session = await requireRole('coach');
    const coachId = session.user.id;
  
    const profile = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, coachId),
      columns: {
        stripeAccountId: true,
        stripeOnboardingComplete: true,
      },
    });

    if (!profile?.stripeAccountId) {
      return { error: 'No Stripe account found. Please complete onboarding first.' };
    }

    if (!profile.stripeOnboardingComplete) {
      return { error: 'Stripe onboarding not complete. Please complete setup first.' };
    }

    const loginLink = await stripe.accounts.createLoginLink(profile.stripeAccountId);

    return { url: loginLink.url };
  } catch (error) {
    console.error('Error creating Stripe login link:', error);
    return { error: 'Failed to create Stripe dashboard link' };
  }
}
