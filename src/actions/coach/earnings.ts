'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile, bookingParticipant, coachPayout } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { deriveUiBookingStatusFromBooking } from '@/lib/booking-status';
import type { BookingWithDetails } from '@/lib/booking-type-guards';
import { isIndividualBooking, isPrivateGroupBooking, isPublicGroupBooking } from '@/lib/booking-type-guards';

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

  const publicGroupBookingIds = completedBookings
    .filter(b => b.bookingType === 'public_group')
    .map(b => b.id);

  // Batch-load all captured participants
  const allCapturedParticipants = publicGroupBookingIds.length > 0
    ? await db.query.bookingParticipant.findMany({
      where: and(
        inArray(bookingParticipant.bookingId, publicGroupBookingIds),
        eq(bookingParticipant.paymentStatus, 'captured')
      ),
    })
    : [];

  const participantsByBookingId = allCapturedParticipants.reduce((acc, p) => {
    if (!acc[p.bookingId]) {
      acc[p.bookingId] = [];
    }
    acc[p.bookingId].push(p);
    return acc;
  }, {} as Record<string, typeof allCapturedParticipants>);

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
      const capturedParticipants = participantsByBookingId[b.id] || [];
      const coachRatePerPerson = parseFloat(b.publicGroupDetails.pricePerPerson);
      coachPayoutCents = Math.round(coachRatePerPerson * 100 * capturedParticipants.length);

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

  const publicGroupIds = bookings
    .filter(b => b.bookingType === 'public_group')
    .map(b => b.id);

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
      const participants = participantsByBooking[bookingRecord.id] || [];
      clientName = `Group Lesson (${participants.length} participants)`;
      stripeTransferId = bookingRecord.publicGroupDetails.stripeTransferId ?? null;

      const coachRatePerPerson = parseFloat(bookingRecord.publicGroupDetails.pricePerPerson);
      coachPayoutCents = Math.round(coachRatePerPerson * 100 * participants.length);
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

export type PayoutRecord = {
  id: string;
  amountCents: number;
  currency: string;
  status: 'pending' | 'in_transit' | 'paid' | 'failed' | 'canceled';
  arrivalDate: Date | null;
  failedReason: string | null;
  createdAt: Date;
};

export async function getCoachPayoutHistory(limit: number = 10): Promise<PayoutRecord[]> {
  const session = await requireRole('coach');
  const coachId = session.user.id;

  const payouts = await db.query.coachPayout.findMany({
    where: eq(coachPayout.coachId, coachId),
    orderBy: (payouts, { desc }) => [desc(payouts.createdAt)],
    limit,
    columns: {
      id: true,
      amountCents: true,
      currency: true,
      status: true,
      arrivalDate: true,
      failedReason: true,
      createdAt: true,
    },
  });

  return payouts.map(p => ({
    id: p.id,
    amountCents: p.amountCents,
    currency: p.currency,
    status: p.status,
    arrivalDate: p.arrivalDate,
    failedReason: p.failedReason,
    createdAt: p.createdAt,
  }));
}
