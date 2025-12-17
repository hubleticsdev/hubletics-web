import Stripe from 'stripe';

export function getStripeErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeCardError) {
    return error.message;
  }

  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    console.error('Stripe Invalid Request:', error.message);
    return 'Payment request was invalid. Please contact support.';
  }

  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    console.error('Stripe Authentication Error:', error.message);
    return 'Payment service configuration error. Please contact support.';
  }

  if (error instanceof Stripe.errors.StripeConnectionError) {
    console.error('Stripe Connection Error:', error.message);
    return 'Payment service temporarily unavailable. Please try again.';
  }

  if (error instanceof Stripe.errors.StripeRateLimitError) {
    console.error('Stripe Rate Limit Error:', error.message);
    return 'Payment service is busy. Please wait a moment and try again.';
  }

  if (error instanceof Stripe.errors.StripeAPIError) {
    console.error('Stripe API Error:', error.message);
    return 'Payment service error. Please try again.';
  }

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

export async function isAccountOnboarded(accountId: string): Promise<boolean> {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return account.charges_enabled && account.payouts_enabled;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

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
      amount: Math.round(amount * 100),
      currency: 'usd',
      capture_method: 'manual',
      on_behalf_of: coachStripeAccountId,
      transfer_data: {
        destination: coachStripeAccountId,
      },
      metadata: {
        ...metadata,
        coachStripeAccountId,
      },
    });

    return paymentIntent;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

export async function captureBookingPayment(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

export async function transferToCoach(
  amount: number,
  coachStripeAccountId: string,
  metadata: {
    bookingId: string;
    paymentIntentId: string;
    coachId: string;
  }
) {
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination: coachStripeAccountId,
      description: `Payout for booking ${metadata.bookingId}`,
      metadata,
    });

    return transfer;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

export async function cancelBookingPayment(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new Error(getStripeErrorMessage(error));
  }
}

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

