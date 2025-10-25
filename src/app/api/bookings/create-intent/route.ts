import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { coachId, amount } = await req.json();

    if (!coachId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get coach's Stripe account
    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, coachId),
    });

    if (!coach || !coach.stripeAccountId) {
      return NextResponse.json(
        { error: 'Coach not found or payment setup incomplete' },
        { status: 404 }
      );
    }

    // Create PaymentIntent with manual capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      capture_method: 'manual',
      metadata: {
        clientId: session.user.id,
        coachId,
      },
      transfer_data: {
        destination: coach.stripeAccountId,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

