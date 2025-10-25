/**
 * Stripe configuration and utilities
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-09-30.clover',
  typescript: true,
});

/**
 * Create a Stripe Connect Express account for a coach
 */
export async function createConnectAccount(email: string, userId: string) {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: {
      userId,
    },
  });

  return account;
}

/**
 * Generate Stripe Connect onboarding link
 */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return accountLink;
}

/**
 * Check if a Stripe Connect account is fully onboarded
 */
export async function isAccountOnboarded(accountId: string): Promise<boolean> {
  const account = await stripe.accounts.retrieve(accountId);
  return account.charges_enabled && account.payouts_enabled;
}

/**
 * Calculate pricing breakdown for a booking
 * Coach sets their desired hourly rate
 * Client pays: coach rate + 18% markup (covers Stripe fees + platform commission)
 */
export function calculatePricing(coachRate: number) {
  const markup = coachRate * 0.18; // 18% markup
  const clientPays = coachRate + markup;

  // Stripe fee: 2.9% + $0.30
  const stripeFee = clientPays * 0.029 + 0.3;

  // Net after Stripe fee
  const netAmount = clientPays - stripeFee;

  // Platform takes 15% of net
  const platformFee = netAmount * 0.15;

  // Coach receives 85% of net
  const coachPayout = netAmount * 0.85;

  return {
    coachRate: Number(coachRate.toFixed(2)),
    clientPays: Number(clientPays.toFixed(2)),
    stripeFee: Number(stripeFee.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    coachPayout: Number(coachPayout.toFixed(2)),
  };
}

/**
 * Create a payment intent for a booking
 * Amount is held (not captured) until coach accepts
 */
export async function createBookingPaymentIntent(
  amount: number,
  coachStripeAccountId: string,
  metadata: {
    bookingId: string;
    clientId: string;
    coachId: string;
  }
) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    capture_method: 'manual', // Hold the payment until coach accepts
    metadata,
    transfer_data: {
      destination: coachStripeAccountId,
    },
  });

  return paymentIntent;
}

/**
 * Capture a held payment intent (when coach accepts booking)
 */
export async function captureBookingPayment(paymentIntentId: string) {
  const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
  return paymentIntent;
}

/**
 * Cancel a payment intent (when booking is declined/cancelled before acceptance)
 */
export async function cancelBookingPayment(paymentIntentId: string) {
  const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
  return paymentIntent;
}

/**
 * Refund a captured payment (when booking is cancelled after acceptance)
 */
export async function refundBookingPayment(
  paymentIntentId: string,
  amount?: number
) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amount && { amount: Math.round(amount * 100) }),
  });
  return refund;
}

