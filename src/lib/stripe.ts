/**
 * Stripe configuration and utilities
 */

import Stripe from 'stripe';

/**
 * Convert Stripe errors to user-friendly messages
 * Based on Stripe's recommended error handling patterns
 */
export function getStripeErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeCardError) {
    // Card was declined - show the specific error message from Stripe
    return error.message;
  }

  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    // Invalid parameters - this usually indicates a bug in our code
    console.error('Stripe Invalid Request:', error.message);
    return 'Payment request was invalid. Please contact support.';
  }

  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    // API key is wrong - this is a server configuration issue
    console.error('Stripe Authentication Error:', error.message);
    return 'Payment service configuration error. Please contact support.';
  }

  if (error instanceof Stripe.errors.StripeConnectionError) {
    // Network error - temporary issue
    console.error('Stripe Connection Error:', error.message);
    return 'Payment service temporarily unavailable. Please try again.';
  }

  if (error instanceof Stripe.errors.StripeRateLimitError) {
    // Too many requests - temporary issue
    console.error('Stripe Rate Limit Error:', error.message);
    return 'Payment service is busy. Please wait a moment and try again.';
  }

  if (error instanceof Stripe.errors.StripeAPIError) {
    // Generic API error - temporary issue
    console.error('Stripe API Error:', error.message);
    return 'Payment service error. Please try again.';
  }

  // Unknown error
  console.error('Unknown Stripe error:', error);
  return 'An unexpected payment error occurred. Please try again.';
}

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
  try {
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
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

/**
 * Generate Stripe Connect onboarding link
 */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
) {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

/**
 * Check if a Stripe Connect account is fully onboarded
 */
export async function isAccountOnboarded(accountId: string): Promise<boolean> {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return account.charges_enabled && account.payouts_enabled;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
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
  try {
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
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

/**
 * Capture a held payment intent (when coach accepts booking)
 */
export async function captureBookingPayment(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

/**
 * Cancel a payment intent (when booking is declined/cancelled before acceptance)
 */
export async function cancelBookingPayment(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

/**
 * Refund a captured payment (when booking is cancelled after acceptance)
 */
export async function refundBookingPayment(
  paymentIntentId: string,
  amount?: number
) {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount && { amount: Math.round(amount * 100) }),
    });
    return refund;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

