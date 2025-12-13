// Centralized pricing logic for the Hubletics platform
export interface PricingConfig {
  platformFeePercentage: number;
  stripePercentage: number;
  stripeFixedCents: number;
}

export interface PricingBreakdown {
  coachDesiredRate: number;
  sessionDurationMinutes: number;
  coachPayout: number;
  coachPayoutCents: number;
  stripeFee: number;
  stripeFeeCents: number;
  platformFee: number;
  platformFeeCents: number;
  clientPays: number;
  clientPaysCents: number;
  effectiveMarkupPercentage: number;
}

const DEFAULT_CONFIG: PricingConfig = {
  platformFeePercentage: 15,
  stripePercentage: 2.9,
  stripeFixedCents: 30,
};

export function calculateBookingPricing(
  coachHourlyRate: number,
  sessionDurationMinutes: number,
  customPlatformFee?: number
): PricingBreakdown {
  const config = { ...DEFAULT_CONFIG };
  if (customPlatformFee !== undefined) {
    config.platformFeePercentage = customPlatformFee;
  }

  const P = config.platformFeePercentage / 100;
  const S = config.stripePercentage / 100;
  const F = config.stripeFixedCents / 100;

  const sessionHours = sessionDurationMinutes / 60;
  const coachDesiredPayout = coachHourlyRate * sessionHours;

  const clientPays = (coachDesiredPayout + F * (1 - P)) / ((1 - S) * (1 - P));

  const stripeFee = clientPays * S + F;
  const netAfterStripe = clientPays - stripeFee;
  const platformFee = netAfterStripe * P;
  const coachPayout = netAfterStripe - platformFee;

  const effectiveMarkup = ((clientPays - coachDesiredPayout) / coachDesiredPayout) * 100;

  return {
    coachDesiredRate: Number(coachHourlyRate.toFixed(2)),
    sessionDurationMinutes,
    coachPayout: Number(coachPayout.toFixed(2)),
    coachPayoutCents: Math.round(coachPayout * 100),
    stripeFee: Number(stripeFee.toFixed(2)),
    stripeFeeCents: Math.round(stripeFee * 100),
    platformFee: Number(platformFee.toFixed(2)),
    platformFeeCents: Math.round(platformFee * 100),
    clientPays: Number(clientPays.toFixed(2)),
    clientPaysCents: Math.round(clientPays * 100),
    effectiveMarkupPercentage: Number(effectiveMarkup.toFixed(2)),
  };
}

export function getClientDisplayRate(
  coachHourlyRate: number,
  customPlatformFee?: number
): number {
  const pricing = calculateBookingPricing(coachHourlyRate, 60, customPlatformFee);
  return pricing.clientPays;
}

export function calculateCoachEarnings(
  clientPaidAmount: number,
  customPlatformFee?: number
): {
  stripeFee: number;
  platformFee: number;
  coachPayout: number;
  stripeFeeCents: number;
  platformFeeCents: number;
  coachPayoutCents: number;
} {
  const config = { ...DEFAULT_CONFIG };
  if (customPlatformFee !== undefined) {
    config.platformFeePercentage = customPlatformFee;
  }

  const S = config.stripePercentage / 100;
  const F = config.stripeFixedCents / 100;
  const P = config.platformFeePercentage / 100;

  const stripeFee = clientPaidAmount * S + F;
  const netAfterStripe = clientPaidAmount - stripeFee;
  const platformFee = netAfterStripe * P;
  const coachPayout = netAfterStripe - platformFee;

  return {
    stripeFee: Number(stripeFee.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    coachPayout: Number(coachPayout.toFixed(2)),
    stripeFeeCents: Math.round(stripeFee * 100),
    platformFeeCents: Math.round(platformFee * 100),
    coachPayoutCents: Math.round(coachPayout * 100),
  };
}

export function calculateGroupTotals(
  pricePerPerson: number,
  participants: number,
  customPlatformFee?: number
): {
  pricePerPerson: number;
  totalGrossCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  coachPayoutCents: number;
} {
  const { stripeFeeCents, platformFeeCents, coachPayoutCents } = calculateCoachEarnings(
    pricePerPerson,
    customPlatformFee
  );

  const totalGrossCents = Math.round(pricePerPerson * 100 * participants);

  return {
    pricePerPerson,
    totalGrossCents,
    platformFeeCents: platformFeeCents * participants,
    stripeFeeCents: stripeFeeCents * participants,
    coachPayoutCents: coachPayoutCents * participants,
  };
}

export function validatePaymentAmount(
  expectedAmount: number,
  receivedAmount: number,
  toleranceCents: number = 1
): boolean {
  const toleranceDollars = toleranceCents / 100;
  const difference = Math.abs(expectedAmount - receivedAmount);
  return difference <= toleranceDollars;
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function calculateRateForTakeHome(
  desiredTakeHome: number,
  customPlatformFee?: number
): {
  suggestedRate: number;
  clientWillPay: number;
  breakdown: PricingBreakdown;
} {
  const breakdown = calculateBookingPricing(desiredTakeHome, 60, customPlatformFee);

  return {
    suggestedRate: desiredTakeHome,
    clientWillPay: breakdown.clientPays,
    breakdown,
  };
}

export async function getPricingConfigForUser(
  userId?: string
): Promise<PricingConfig> {
  if (!userId) {
    return DEFAULT_CONFIG;
  }

  try {
    const { db } = await import('@/lib/db');
    const { user } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { platformFeePercentage: true },
    });

    if (userRecord?.platformFeePercentage) {
      return {
        ...DEFAULT_CONFIG,
        platformFeePercentage: parseFloat(userRecord.platformFeePercentage as unknown as string),
      };
    }
  } catch (error) {
    console.error('Error fetching user pricing config:', error);
  }

  return DEFAULT_CONFIG;
}
