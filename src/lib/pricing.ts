/**
 * Centralized pricing logic for the Hubletics platform
 *
 * CORE PRINCIPLE: Coach sets what they want to RECEIVE, we calculate what client pays
 */

export interface PricingConfig {
  platformFeePercentage: number;
  stripePercentage: number;      // 2.9% (Stripe's fee)
  stripeFixedCents: number;      // 30 cents (Stripe's fixed fee)
}

export interface PricingBreakdown {
  coachDesiredRate: number;    // What the coach set
  sessionDurationMinutes: number;
  coachPayout: number;         // Actual amount coach receives (matches desired rate × hours)
  stripeFee: number;           // Stripe's cut (2.9% + $0.30)
  platformFee: number;         // Platform's cut (default 15% of net after Stripe)
  clientPays: number;          // Total amount client is charged
  effectiveMarkupPercentage: number; // Calculated markup percentage for transparency
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

  // Convert percentages to decimals
  const P = config.platformFeePercentage / 100;
  const S = config.stripePercentage / 100;
  const F = config.stripeFixedCents / 100;

  // Calculate coach's desired payout for this session
  const sessionHours = sessionDurationMinutes / 60;
  const coachDesiredPayout = coachHourlyRate * sessionHours;

  // Reverse-engineer client payment amount
  // Formula: C = [D + F(1 - P)] / [(1 - S)(1 - P)]
  const clientPays = (coachDesiredPayout + F * (1 - P)) / ((1 - S) * (1 - P));

  // Now calculate actual fees based on client payment
  const stripeFee = clientPays * S + F;
  const netAfterStripe = clientPays - stripeFee;
  const platformFee = netAfterStripe * P;
  const coachPayout = netAfterStripe - platformFee;

  // Calculate effective markup for transparency
  const effectiveMarkup = ((clientPays - coachDesiredPayout) / coachDesiredPayout) * 100;

  return {
    coachDesiredRate: Number(coachHourlyRate.toFixed(2)),
    sessionDurationMinutes,
    coachPayout: Number(coachPayout.toFixed(2)),
    stripeFee: Number(stripeFee.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    clientPays: Number(clientPays.toFixed(2)),
    effectiveMarkupPercentage: Number(effectiveMarkup.toFixed(2)),
  };
}

// Get the client display rate
export function getClientDisplayRate(
  coachHourlyRate: number,
  customPlatformFee?: number
): number {
  // Calculate for 1 hour to get the per-hour client rate
  const pricing = calculateBookingPricing(coachHourlyRate, 60, customPlatformFee);
  return pricing.clientPays;
}

// Calculate coach earnings breakdown from a completed booking
export function calculateCoachEarnings(
  clientPaidAmount: number,
  customPlatformFee?: number
): {
  stripeFee: number;
  platformFee: number;
  coachPayout: number;
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
  };
}

// Validate that a payment amount matches the expected amount
export function validatePaymentAmount(
  expectedAmount: number,
  receivedAmount: number,
  toleranceCents: number = 1
): boolean {
  const toleranceDollars = toleranceCents / 100;
  const difference = Math.abs(expectedAmount - receivedAmount);
  return difference <= toleranceDollars;
}

// Format pricing for display
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Calculate what coach should set as their rate to achieve a target take-home
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

// Get pricing config for a specific user
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
