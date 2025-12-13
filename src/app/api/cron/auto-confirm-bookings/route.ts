import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { booking, bookingParticipant, coachProfile } from '@/lib/db/schema';
import { and, eq, lt, isNull, ne } from 'drizzle-orm';
import { transferToCoach, stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { getAutoConfirmationClientEmailTemplate, getAutoConfirmationCoachEmailTemplate } from '@/lib/email/templates/payment-notifications';
import { validateCronAuth } from '@/lib/cron/auth';
import { incrementCoachLessonsCompleted } from '@/lib/coach-stats';
import { formatDateOnly } from '@/lib/utils/date';
import { recordStateTransition } from '@/lib/booking-audit';
import { calculateCoachEarnings } from '@/lib/pricing';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    console.log(`[CRON] Auto-confirm job started at ${new Date().toISOString()}`);
    console.log(`[CRON] Looking for bookings marked complete before: ${sevenDaysAgo.toISOString()}`);

    const eligibleBookings = await db.query.booking.findMany({
      where: and(
        eq(booking.approvalStatus, 'accepted'),
        eq(booking.fulfillmentStatus, 'scheduled'),
        lt(booking.coachConfirmedAt, sevenDaysAgo),
        isNull(booking.clientConfirmedAt)
      ),
      with: {
        client: {
          columns: {
            name: true,
            email: true,
            timezone: true,
          },
        },
        coach: {
          columns: {
            name: true,
            email: true,
            timezone: true,
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
            clientConfirmedAt: new Date(),
            fulfillmentStatus: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(booking.id, bookingRecord.id));

        await incrementCoachLessonsCompleted(bookingRecord.coachId);

        if (bookingRecord.primaryStripePaymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            bookingRecord.primaryStripePaymentIntentId
          );

          if (paymentIntent.status !== 'succeeded') {
            console.error(
              `[CRON] Cannot transfer - PaymentIntent status is '${paymentIntent.status}' for booking ${bookingRecord.id}`
            );
            results.errors.push(`${bookingRecord.id}: Payment not succeeded (status: ${paymentIntent.status})`);
            continue;
          }

          const charges = await stripe.charges.list({
            payment_intent: bookingRecord.primaryStripePaymentIntentId,
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
            const coachPayoutAmount = bookingRecord.coachPayoutCents
              ? bookingRecord.coachPayoutCents / 100
              : 0;

            const transfer = await transferToCoach(
              coachPayoutAmount,
              coach.stripeAccountId,
              {
                bookingId: bookingRecord.id,
                paymentIntentId: bookingRecord.primaryStripePaymentIntentId,
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

        const clientTimezone = bookingRecord.client.timezone || 'America/Chicago';
        const clientEmailTemplate = getAutoConfirmationClientEmailTemplate(
          bookingRecord.client.name,
          bookingRecord.coach.name,
          formatDateOnly(startDate, clientTimezone)
        );

        await sendEmail({
          to: bookingRecord.client.email,
          subject: clientEmailTemplate.subject,
          html: clientEmailTemplate.html,
          text: clientEmailTemplate.text,
        });

        const coachTimezone = bookingRecord.coach.timezone || 'America/Chicago';
        const coachEmailTemplate = getAutoConfirmationCoachEmailTemplate(
          bookingRecord.coach.name,
          bookingRecord.client.name,
          formatDateOnly(startDate, coachTimezone),
          bookingRecord.coachPayoutCents ? (bookingRecord.coachPayoutCents / 100).toFixed(2) : '0.00'
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


    // auto-conplete 7+ day-old public group lessons
    const publicGroupCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const eligiblePublicGroups = await db.query.booking.findMany({
      where: and(
        eq(booking.isGroupBooking, true),
        eq(booking.groupType, 'public'),
        eq(booking.approvalStatus, 'accepted'),
        ne(booking.fulfillmentStatus, 'completed'),
        lt(booking.scheduledEndAt, publicGroupCutoff)
      ),
      with: {
        coach: {
          columns: {
            name: true,
            email: true,
            timezone: true,
          },
        },
      },
    });

    console.log(`[CRON] Found ${eligiblePublicGroups.length} public group lessons to auto-complete`);

    for (const lesson of eligiblePublicGroups) {
      results.processed++;

      try {
        console.log(`[CRON] Processing public group lesson: ${lesson.id}`);

        const capturedParticipants = await db.query.bookingParticipant.findMany({
          where: and(
            eq(bookingParticipant.bookingId, lesson.id),
            eq(bookingParticipant.paymentStatus, 'captured')
          ),
          with: {
            user: {
              columns: {
                name: true,
                email: true,
                timezone: true,
              },
            },
          },
        });

        if (capturedParticipants.length === 0) {
          console.log(`[CRON] No captured participants for public group ${lesson.id}, marking as completed`);
          await db
            .update(booking)
            .set({
              fulfillmentStatus: 'completed',
              coachConfirmedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(booking.id, lesson.id));

          await recordStateTransition({
            bookingId: lesson.id,
            field: 'fulfillmentStatus',
            oldStatus: lesson.fulfillmentStatus,
            newStatus: 'completed',
            reason: 'Auto-completed by cron (no participants)',
          });

          results.succeeded++;
          continue;
        }

        const coach = await db.query.coachProfile.findFirst({
          where: eq(coachProfile.userId, lesson.coachId),
          columns: {
            stripeAccountId: true,
          },
          with: {
            user: {
              columns: {
                platformFeePercentage: true,
              },
            },
          },
        });

        if (!coach?.stripeAccountId) {
          console.warn(`[CRON] Coach has no Stripe account for public group ${lesson.id}`);
          results.errors.push(`${lesson.id}: Coach has no Stripe account`);
          results.failed++;
          continue;
        }

        const platformFeePercentage = coach.user?.platformFeePercentage
          ? parseFloat(coach.user.platformFeePercentage as unknown as string)
          : 15;

        let totalCoachPayoutCents = 0;
        for (const participant of capturedParticipants) {
          const amountDollars = (participant.amountCents ?? 0) / 100;
          const earnings = calculateCoachEarnings(amountDollars, platformFeePercentage);
          totalCoachPayoutCents += earnings.coachPayoutCents;
        }

        const coachPayoutCents = totalCoachPayoutCents;

        const transfer = await transferToCoach(
          coachPayoutCents / 100,
          coach.stripeAccountId,
          {
            bookingId: lesson.id,
            paymentIntentId: `auto_aggregate_${capturedParticipants.length}_participants`,
            coachId: lesson.coachId,
          }
        );

        console.log(`[CRON] Aggregate transfer ${transfer.id}: $${coachPayoutCents / 100} for ${capturedParticipants.length} participants`);

        const oldFulfillmentStatus = lesson.fulfillmentStatus;

        await db
          .update(booking)
          .set({
            fulfillmentStatus: 'completed',
            coachConfirmedAt: new Date(),
            stripeTransferId: transfer.id,
            coachPayoutCents,
            updatedAt: new Date(),
          })
          .where(eq(booking.id, lesson.id));

        await db
          .update(bookingParticipant)
          .set({
            status: 'completed',
          })
          .where(
            and(
              eq(bookingParticipant.bookingId, lesson.id),
              eq(bookingParticipant.paymentStatus, 'captured')
            )
          );

        await incrementCoachLessonsCompleted(lesson.coachId);

        await recordStateTransition({
          bookingId: lesson.id,
          field: 'fulfillmentStatus',
          oldStatus: oldFulfillmentStatus,
          newStatus: 'completed',
          reason: 'Auto-completed by cron',
        });

        const startDate = new Date(lesson.scheduledStartAt);

        for (const participant of capturedParticipants) {
          const participantTimezone = participant.user.timezone || 'America/Chicago';
          const lessonDate = formatDateOnly(startDate, participantTimezone);

          await sendEmail({
            to: participant.user.email,
            subject: `Lesson Completed - Thank you!`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #FF6B4A;">Lesson Completed</h2>
                <p>Hi ${participant.user.name},</p>
                <p>Your group lesson on <strong>${lessonDate}</strong> with ${lesson.coach.name} has been automatically confirmed as complete.</p>
                <p>Thank you for using Hubletics!</p>
              </div>
            `,
            text: `Hi ${participant.user.name}, your group lesson on ${lessonDate} with ${lesson.coach.name} has been automatically confirmed as complete. Thank you for using Hubletics!`,
          });
        }

        const coachTimezone = lesson.coach.timezone || 'America/Chicago';
        const lessonDateForCoach = formatDateOnly(startDate, coachTimezone);

        await sendEmail({
          to: lesson.coach.email,
          subject: `Auto-Completed: Group Lesson on ${lessonDateForCoach}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #FF6B4A;">Group Lesson Auto-Completed</h2>
              <p>Hi ${lesson.coach.name},</p>
              <p>Your group lesson on <strong>${lessonDateForCoach}</strong> has been automatically completed.</p>
              <p><strong>Participants:</strong> ${capturedParticipants.length}</p>
              <p><strong>Payout:</strong> $${(coachPayoutCents / 100).toFixed(2)}</p>
              <p>The payment has been transferred to your connected Stripe account.</p>
            </div>
          `,
          text: `Hi ${lesson.coach.name}, your group lesson on ${lessonDateForCoach} has been automatically completed. ${capturedParticipants.length} participants, payout: $${(coachPayoutCents / 100).toFixed(2)}.`,
        });

        console.log(`[CRON] Public group lesson ${lesson.id} auto-completed successfully`);
        results.succeeded++;

      } catch (error) {
        console.error(`[CRON] Failed to process public group lesson ${lesson.id}:`, error);
        results.failed++;
        results.errors.push(`${lesson.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
