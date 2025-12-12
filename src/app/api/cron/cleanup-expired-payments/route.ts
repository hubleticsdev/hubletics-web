import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookingParticipant } from '@/lib/db/schema';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { validateCronAuth } from '@/lib/cron/auth';
import { stripe } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log(`[CRON] Cleanup expired payments job started at ${now.toISOString()}`);

    const results = {
      cancelled: 0,
      errors: [] as string[],
      skipped: 0,
    };

    // Find participants with pending payments older than 24 hours
    const expiredParticipants = await db.query.bookingParticipant.findMany({
      where: and(
        eq(bookingParticipant.paymentStatus, 'pending'),
        isNotNull(bookingParticipant.stripePaymentIntentId),
        lt(bookingParticipant.joinedAt, twentyFourHoursAgo)
      ),
      with: {
        user: {
          columns: {
            name: true,
            email: true,
          },
        },
        booking: {
          columns: {
            id: true,
            scheduledStartAt: true,
          },
        },
      },
    });

    console.log(`[CRON] Found ${expiredParticipants.length} participants with pending payments older than 24 hours`);

    for (const participant of expiredParticipants) {
      try {
        if (!participant.stripePaymentIntentId) {
          console.warn(`Participant ${participant.id} has no stripePaymentIntentId`);
          results.skipped++;
          continue;
        }

        // Check PaymentIntent status in Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(participant.stripePaymentIntentId);

        // Only cancel if still in requires_capture state (not yet captured/cancelled)
        if (paymentIntent.status === 'requires_capture') {
          // Cancel the PaymentIntent to release the authorization
          await stripe.paymentIntents.cancel(participant.stripePaymentIntentId);

          // Remove the participant from the booking
          await db
            .delete(bookingParticipant)
            .where(eq(bookingParticipant.id, participant.id));

          console.log(`[CRON] Cancelled PaymentIntent ${participant.stripePaymentIntentId} and removed participant ${participant.id}`);
          results.cancelled++;
        } else {
          console.log(`[CRON] Skipping PaymentIntent ${participant.stripePaymentIntentId} - status: ${paymentIntent.status}`);
          results.skipped++;
        }

      } catch (error) {
        console.error(`[CRON] Error processing participant ${participant.id}:`, error);
        results.errors.push(`${participant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`[CRON] Cleanup expired payments job completed. Results:`, results);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    });

  } catch (error) {
    console.error('[CRON] Cleanup expired payments job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
