'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { deriveUiBookingStatus, UiBookingStatus } from '@/lib/booking-status';

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
  status: UiBookingStatus;
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

  const completedBookings = await db.query.booking.findMany({
    where: and(
      eq(booking.coachId, coachId),
      eq(booking.fulfillmentStatus, 'completed')
    ),
    columns: {
      coachPayoutCents: true,
      stripeTransferId: true,
    },
  });

  const upcomingBookings = await db.query.booking.findMany({
    where: and(
      eq(booking.coachId, coachId),
      eq(booking.approvalStatus, 'accepted')
    ),
    columns: {
      id: true,
    },
  });

  const totalEarnings = completedBookings.reduce(
    (sum, b) => sum + (b.coachPayoutCents || 0),
    0
  );

  const pendingBookings = completedBookings.filter(b => !b.stripeTransferId);
  const pendingBalance = pendingBookings.reduce(
    (sum, b) => sum + (b.coachPayoutCents || 0),
    0
  );

  const availableBalance = totalEarnings - pendingBalance;

  return {
    totalEarnings: Number((totalEarnings / 100).toFixed(2)),
    availableBalance: Number((availableBalance / 100).toFixed(2)),
    pendingBalance: Number((pendingBalance / 100).toFixed(2)),
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
      client: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: (booking, { desc }) => [desc(booking.scheduledStartAt)],
    limit: 50,
  });

  return bookings.map(b => ({
    id: b.id,
    clientName: b.client.name,
    scheduledStartAt: b.scheduledStartAt,
    duration: b.duration,
    coachPayout: b.coachPayoutCents ? b.coachPayoutCents / 100 : 0,
    status: deriveUiBookingStatus({
      approvalStatus: b.approvalStatus,
      paymentStatus: b.paymentStatus,
      fulfillmentStatus: b.fulfillmentStatus,
      capacityStatus: b.capacityStatus,
    }),
    stripeTransferId: b.stripeTransferId,
  }));
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
