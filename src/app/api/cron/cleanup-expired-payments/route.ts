import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookingParticipant, publicGroupLessonDetails } from '@/lib/db/schema';
import { and, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { validateCronAuth } from '@/lib/cron/auth';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {
    const now = new Date();

    console.log(`[CRON] Cleanup expired payments job started at ${now.toISOString()}`);

    const results = {
      cancelled: 0,
      errors: [] as string[],
      skipped: 0,
    };

    // Find participants with expired payment windows
    const expiredParticipants = await db.query.bookingParticipant.findMany({
      where: and(
        eq(bookingParticipant.paymentStatus, 'authorized'),
        eq(bookingParticipant.status, 'awaiting_coach'),
        isNotNull(bookingParticipant.expiresAt),
        lte(bookingParticipant.expiresAt, now)
      ),
      with: {
        user: {
          columns: {
            name: true,
            email: true,
          },
        },
        booking: {
          with: {
            publicGroupDetails: {
              columns: {
                bookingId: true,
              },
            },
          },
        },
      },
    });

    console.log(`[CRON] Found ${expiredParticipants.length} participants with expired payment windows`);

    for (const participant of expiredParticipants) {
      try {
        if (!participant.stripePaymentIntentId) {
          console.warn(`Participant ${participant.id} has no stripePaymentIntentId`);
          results.skipped++;
          continue;
        }

        // Cancel payment intent
        await stripe.paymentIntents.cancel(participant.stripePaymentIntentId);

        // Update participant status
        await db
          .update(bookingParticipant)
          .set({
            paymentStatus: 'cancelled',
            status: 'cancelled',
            cancelledAt: now,
          })
          .where(eq(bookingParticipant.id, participant.id));

        // Decrement counts in publicGroupLessonDetails
        if (participant.booking.publicGroupDetails) {
          await db
            .update(publicGroupLessonDetails)
            .set({
              currentParticipants: sql`${publicGroupLessonDetails.currentParticipants} - 1`,
              authorizedParticipants: sql`${publicGroupLessonDetails.authorizedParticipants} - 1`,
            })
            .where(eq(publicGroupLessonDetails.bookingId, participant.bookingId));
        }

        // Email participant
        if (participant.user?.email) {
          await sendEmail({
            to: participant.user.email,
            subject: 'Payment Authorization Expired',
            html: `
              <h2>Payment Authorization Expired</h2>
              <p>Hi ${participant.user.name},</p>
              <p>Your payment authorization for the group lesson has expired because the coach did not accept your request within 24 hours.</p>
              <p>The funds have been released back to your payment method.</p>
              <p>You can join another lesson if you're still interested.</p>
            `,
            text: `Your payment authorization for the group lesson has expired. The funds have been released back to your payment method.`,
          });
        }

        console.log(`[CRON] Cancelled PaymentIntent ${participant.stripePaymentIntentId} and updated participant ${participant.id}`);
        results.cancelled++;
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
