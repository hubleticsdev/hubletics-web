import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { calculateBookingPricing } from '@/lib/pricing';
import { uuidSchema, validateInput } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { coachId, sessionDuration } = await req.json();

    if (!coachId || !sessionDuration) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const validatedCoachId = validateInput(uuidSchema, coachId);
    if (typeof sessionDuration !== 'number' || sessionDuration < 30 || sessionDuration > 480) {
      return NextResponse.json(
        { error: 'Invalid session duration (must be 30-480 minutes)' },
        { status: 400 }
      );
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, validatedCoachId),
      with: {
        user: {
          columns: {
            platformFeePercentage: true,
          },
        },
      },
    });

    if (!coach || !coach.stripeAccountId) {
      return NextResponse.json(
        { error: 'Coach not found or payment setup incomplete' },
        { status: 404 }
      );
    }

    const coachRate = parseFloat(coach.hourlyRate);
    const platformFee = coach.user?.platformFeePercentage
      ? parseFloat(coach.user.platformFeePercentage as unknown as string)
      : 15;

    const pricing = calculateBookingPricing(
      coachRate,
      sessionDuration,
      platformFee
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pricing.clientPays * 100),
      currency: 'usd',
      capture_method: 'manual',
      metadata: {
        clientId: session.user.id,
        coachId,
        coachRate: pricing.coachDesiredRate.toString(),
        sessionDuration: sessionDuration.toString(),
      },
      transfer_data: {
        destination: coach.stripeAccountId,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      pricing: {
        clientPays: pricing.clientPays,
        coachReceives: pricing.coachPayout,
      },
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
