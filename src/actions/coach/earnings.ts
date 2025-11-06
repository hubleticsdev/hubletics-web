'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';

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

  // Get coach profile for Stripe info
  const profile = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, coachId),
    columns: {
      stripeAccountId: true,
      stripeOnboardingComplete: true,
    },
  });

  // Get all completed bookings
  const completedBookings = await db.query.booking.findMany({
    where: and(
      eq(booking.coachId, coachId),
      eq(booking.status, 'completed')
    ),
    columns: {
      coachPayout: true,
      stripeTransferId: true,
    },
  });

  // Get upcoming accepted bookings
  const upcomingBookings = await db.query.booking.findMany({
    where: and(
      eq(booking.coachId, coachId),
      eq(booking.status, 'accepted')
    ),
    columns: {
      id: true,
    },
  });

  // Calculate earnings
  const totalEarnings = completedBookings.reduce(
    (sum, b) => sum + parseFloat(b.coachPayout as unknown as string),
    0
  );

  // Pending = completed but not yet transferred
  const pendingBookings = completedBookings.filter(b => !b.stripeTransferId);
  const pendingBalance = pendingBookings.reduce(
    (sum, b) => sum + parseFloat(b.coachPayout as unknown as string),
    0
  );

  // Available = transferred to Stripe Connect account
  const availableBalance = totalEarnings - pendingBalance;

  return {
    totalEarnings: Number(totalEarnings.toFixed(2)),
    availableBalance: Number(availableBalance.toFixed(2)),
    pendingBalance: Number(pendingBalance.toFixed(2)),
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
    where: and(
      eq(booking.coachId, coachId),
      inArray(booking.status, ['completed', 'accepted', 'pending'])
    ),
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
    coachPayout: parseFloat(b.coachPayout as unknown as string),
    status: b.status,
    stripeTransferId: b.stripeTransferId,
  }));
}

export async function getStripeLoginLink(): Promise<{ url: string } | { error: string }> {
  try {
    const session = await requireRole('coach');
    const coachId = session.user.id;

    // Get coach's Stripe account
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

    // Create login link for Stripe Express Dashboard
    const loginLink = await stripe.accounts.createLoginLink(profile.stripeAccountId);

    return { url: loginLink.url };
  } catch (error) {
    console.error('Error creating Stripe login link:', error);
    return { error: 'Failed to create Stripe dashboard link' };
  }
}