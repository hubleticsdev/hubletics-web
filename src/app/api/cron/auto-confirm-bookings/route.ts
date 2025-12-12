import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { booking, coachProfile } from '@/lib/db/schema';
import { and, eq, lt } from 'drizzle-orm';
import { transferToCoach, stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { getAutoConfirmationClientEmailTemplate, getAutoConfirmationCoachEmailTemplate } from '@/lib/email/templates/payment-notifications';
import { validateCronAuth } from '@/lib/cron/auth';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    console.log(`[CRON] Auto-confirm job started at ${new Date().toISOString()}`);
    console.log(`[CRON] Looking for bookings marked complete before: ${sevenDaysAgo.toISOString()}`);

    const eligibleBookings = await db.query.booking.findMany({
      where: and(
        eq(booking.status, 'accepted'),
        eq(booking.markedCompleteByCoach, true),
        eq(booking.confirmedByClient, false),
        lt(booking.markedCompleteByCoachAt, sevenDaysAgo)
      ),
      with: {
        client: {
          columns: {
            name: true,
            email: true,
          },
        },
        coach: {
          columns: {
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`[CRON] Found ${eligibleBookings.length} bookings to auto-confirm`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const bookingRecord of eligibleBookings) {
      results.processed++;
      
      try {
        console.log(`[CRON] Processing booking: ${bookingRecord.id}`);

        await db
          .update(booking)
          .set({
            confirmedByClient: true,
            confirmedByClientAt: new Date(),
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(booking.id, bookingRecord.id));

        if (bookingRecord.stripePaymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            bookingRecord.stripePaymentIntentId
          );

          if (paymentIntent.status !== 'succeeded') {
            console.error(
              `[CRON] Cannot transfer - PaymentIntent status is '${paymentIntent.status}' for booking ${bookingRecord.id}`
            );
            results.errors.push(`${bookingRecord.id}: Payment not succeeded (status: ${paymentIntent.status})`);
            continue;
          }

          const charges = await stripe.charges.list({
            payment_intent: bookingRecord.stripePaymentIntentId,
            limit: 1,
          });
          const charge = charges.data[0];
          
          if (charge?.disputed) {
            console.error(
              `[CRON] Cannot transfer - Payment disputed for booking ${bookingRecord.id}`
            );
            results.errors.push(`${bookingRecord.id}: Payment disputed`);
            continue;
          }

          if (charge?.refunded) {
            console.error(
              `[CRON] Cannot transfer - Payment refunded for booking ${bookingRecord.id}`
            );
            results.errors.push(`${bookingRecord.id}: Payment refunded`);
            continue;
          }

          const coach = await db.query.coachProfile.findFirst({
            where: eq(coachProfile.userId, bookingRecord.coachId),
            columns: {
              stripeAccountId: true,
            },
          });

          if (coach?.stripeAccountId) {
            const coachPayoutAmount = parseFloat(bookingRecord.coachPayout);

            const transfer = await transferToCoach(
              coachPayoutAmount,
              coach.stripeAccountId,
              {
                bookingId: bookingRecord.id,
                paymentIntentId: bookingRecord.stripePaymentIntentId,
                coachId: bookingRecord.coachId,
              }
            );

            console.log(`[CRON] Transfer to coach successful: ${transfer.id}`);

            await db
              .update(booking)
              .set({
                stripeTransferId: transfer.id,
                updatedAt: new Date(),
              })
              .where(eq(booking.id, bookingRecord.id));
          } else {
            console.warn(`[CRON] Coach has no Stripe account for booking ${bookingRecord.id}`);
            results.errors.push(`${bookingRecord.id}: Coach has no Stripe account`);
            continue;
          }
        }

        const startDate = new Date(bookingRecord.scheduledStartAt);

        const clientEmailTemplate = getAutoConfirmationClientEmailTemplate(
          bookingRecord.client.name,
          bookingRecord.coach.name,
          startDate.toLocaleDateString()
        );

        await sendEmail({
          to: bookingRecord.client.email,
          subject: clientEmailTemplate.subject,
          html: clientEmailTemplate.html,
          text: clientEmailTemplate.text,
        });

        const coachEmailTemplate = getAutoConfirmationCoachEmailTemplate(
          bookingRecord.coach.name,
          bookingRecord.client.name,
          startDate.toLocaleDateString(),
          parseFloat(bookingRecord.coachPayout).toFixed(2)
        );

        await sendEmail({
          to: bookingRecord.coach.email,
          subject: coachEmailTemplate.subject,
          html: coachEmailTemplate.html,
          text: coachEmailTemplate.text,
        });

        console.log(`[CRON] Booking ${bookingRecord.id} auto-confirmed successfully`);
        results.succeeded++;

      } catch (error) {
        console.error(`[CRON] Failed to process booking ${bookingRecord.id}:`, error);
        results.failed++;
        results.errors.push(`${bookingRecord.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`[CRON] Job completed. Results:`, results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });

  } catch (error) {
    console.error('[CRON] Auto-confirm job failed:', error);
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

