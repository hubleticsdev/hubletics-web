import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { booking, bookingParticipant, individualBookingDetails, privateGroupBookingDetails } from '@/lib/db/schema';
import { and, eq, lt, isNotNull, ne } from 'drizzle-orm';
import { processCoachPayoutSafely } from '@/actions/bookings/manage';
import { sendEmail } from '@/lib/email/resend';
import { getAutoConfirmationClientEmailTemplate, getAutoConfirmationCoachEmailTemplate } from '@/lib/email/templates/payment-notifications';
import { validateCronAuth } from '@/lib/cron/auth';
import { incrementCoachLessonsCompleted } from '@/lib/coach-stats';
import { formatDateOnly } from '@/lib/utils/date';
import { recordStateTransition } from '@/lib/booking-audit';
import { isIndividualBooking, isPrivateGroupBooking, isPublicGroupBooking } from '@/lib/booking-type-guards';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    console.log(`[CRON] Auto-confirm job started at ${new Date().toISOString()}`);
    console.log(`[CRON] Looking for bookings marked complete before: ${sevenDaysAgo.toISOString()}`);

    // Find individual bookings that need auto-confirmation
    const eligibleIndividualBookings = await db.query.booking.findMany({
      where: and(
        eq(booking.bookingType, 'individual'),
        eq(booking.approvalStatus, 'accepted'),
        eq(booking.fulfillmentStatus, 'scheduled'),
        isNotNull(booking.coachConfirmedAt),
        lt(booking.coachConfirmedAt, sevenDaysAgo)
      ),
      with: {
        individualDetails: {
          with: {
            client: {
              columns: {
                name: true,
                email: true,
                timezone: true,
              },
            },
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

    // Filter to only those without client confirmation
    const individualToAutoConfirm = eligibleIndividualBookings.filter(
      b => !b.individualDetails?.clientConfirmedAt
    );

    // Find private group bookings that need auto-confirmation
    const eligiblePrivateGroupBookings = await db.query.booking.findMany({
      where: and(
        eq(booking.bookingType, 'private_group'),
        eq(booking.approvalStatus, 'accepted'),
        eq(booking.fulfillmentStatus, 'scheduled'),
        isNotNull(booking.coachConfirmedAt),
        lt(booking.coachConfirmedAt, sevenDaysAgo)
      ),
      with: {
        privateGroupDetails: {
          with: {
            organizer: {
              columns: {
                name: true,
                email: true,
                timezone: true,
              },
            },
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

    // Filter to only those without organizer confirmation
    const privateGroupToAutoConfirm = eligiblePrivateGroupBookings.filter(
      b => !b.privateGroupDetails?.organizerConfirmedAt
    );

    const eligibleBookings = [...individualToAutoConfirm, ...privateGroupToAutoConfirm];

    console.log(`[CRON] Found ${eligibleBookings.length} bookings to auto-confirm (${individualToAutoConfirm.length} individual, ${privateGroupToAutoConfirm.length} private group)`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const bookingRecord of eligibleBookings) {
      results.processed++;
      
      try {
        console.log(`[CRON] Processing booking: ${bookingRecord.id} (${bookingRecord.bookingType})`);

        // Auto-confirm in appropriate detail table
        if (isIndividualBooking(bookingRecord)) {
          await db
            .update(individualBookingDetails)
            .set({
              clientConfirmedAt: new Date(),
            })
            .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
        } else if (isPrivateGroupBooking(bookingRecord)) {
          await db
            .update(privateGroupBookingDetails)
            .set({
              organizerConfirmedAt: new Date(),
            })
            .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
        }

        // Update booking fulfillment status
        await db
          .update(booking)
          .set({
            fulfillmentStatus: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(booking.id, bookingRecord.id));

        await incrementCoachLessonsCompleted(bookingRecord.coachId);

        // Transfer funds to coach
        const transferResult = await processCoachPayoutSafely(bookingRecord.id);
        if (!transferResult.success) {
          console.error(`[CRON] Transfer failed for booking ${bookingRecord.id}: ${transferResult.error}`);
          results.errors.push(`${bookingRecord.id}: Transfer failed - ${transferResult.error}`);
        }

        // Send emails
        const startDate = new Date(bookingRecord.scheduledStartAt);
        
        if (isIndividualBooking(bookingRecord) && bookingRecord.individualDetails) {
          const clientTimezone = bookingRecord.individualDetails.client.timezone || 'America/Chicago';
          const clientEmailTemplate = getAutoConfirmationClientEmailTemplate(
            bookingRecord.individualDetails.client.name,
            bookingRecord.coach.name,
            formatDateOnly(startDate, clientTimezone)
          );

          await sendEmail({
            to: bookingRecord.individualDetails.client.email,
            subject: clientEmailTemplate.subject,
            html: clientEmailTemplate.html,
            text: clientEmailTemplate.text,
          });

          const coachTimezone = bookingRecord.coach.timezone || 'America/Chicago';
          const coachPayoutCents = bookingRecord.individualDetails.coachPayoutCents;
          const coachEmailTemplate = getAutoConfirmationCoachEmailTemplate(
            bookingRecord.coach.name,
            bookingRecord.individualDetails.client.name,
            formatDateOnly(startDate, coachTimezone),
            (coachPayoutCents / 100).toFixed(2)
          );

          await sendEmail({
            to: bookingRecord.coach.email,
            subject: coachEmailTemplate.subject,
            html: coachEmailTemplate.html,
            text: coachEmailTemplate.text,
          });
        } else if (isPrivateGroupBooking(bookingRecord) && bookingRecord.privateGroupDetails) {
          const organizerTimezone = bookingRecord.privateGroupDetails.organizer.timezone || 'America/Chicago';
          const organizerEmailTemplate = getAutoConfirmationClientEmailTemplate(
            bookingRecord.privateGroupDetails.organizer.name,
            bookingRecord.coach.name,
            formatDateOnly(startDate, organizerTimezone)
          );

          await sendEmail({
            to: bookingRecord.privateGroupDetails.organizer.email,
            subject: organizerEmailTemplate.subject,
            html: organizerEmailTemplate.html,
            text: organizerEmailTemplate.text,
          });

          const coachTimezone = bookingRecord.coach.timezone || 'America/Chicago';
          const coachPayoutCents = bookingRecord.privateGroupDetails.coachPayoutCents;
          const coachEmailTemplate = getAutoConfirmationCoachEmailTemplate(
            bookingRecord.coach.name,
            bookingRecord.privateGroupDetails.organizer.name,
            formatDateOnly(startDate, coachTimezone),
            (coachPayoutCents / 100).toFixed(2)
          );

          await sendEmail({
            to: bookingRecord.coach.email,
            subject: coachEmailTemplate.subject,
            html: coachEmailTemplate.html,
            text: coachEmailTemplate.text,
          });
        }

        // Record state transition
        await recordStateTransition({
          bookingId: bookingRecord.id,
          field: 'fulfillmentStatus',
          oldStatus: 'scheduled',
          newStatus: 'completed',
          reason: 'Auto-confirmed after 7 days',
        });

        console.log(`[CRON] Booking ${bookingRecord.id} auto-confirmed successfully`);
        results.succeeded++;

      } catch (error) {
        console.error(`[CRON] Failed to process booking ${bookingRecord.id}:`, error);
        results.failed++;
        results.errors.push(`${bookingRecord.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Auto-complete 7+ day-old public group lessons (coach-only confirmation)
    const publicGroupCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const eligiblePublicGroups = await db.query.booking.findMany({
      where: and(
        eq(booking.bookingType, 'public_group'),
        eq(booking.approvalStatus, 'accepted'),
        ne(booking.fulfillmentStatus, 'completed'),
        lt(booking.scheduledEndAt, publicGroupCutoff)
      ),
      with: {
        publicGroupDetails: true,
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

        if (!isPublicGroupBooking(lesson) || !lesson.publicGroupDetails) {
          console.error(`[CRON] Invalid public group booking ${lesson.id}`);
          results.errors.push(`${lesson.id}: Invalid booking structure`);
          results.failed++;
          continue;
        }

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

        // Transfer funds to coach
        const transferResult = await processCoachPayoutSafely(lesson.id);
        if (!transferResult.success) {
          console.error(`[CRON] Transfer failed for public group ${lesson.id}: ${transferResult.error}`);
          results.errors.push(`${lesson.id}: Transfer failed - ${transferResult.error}`);
          results.failed++;
          continue;
        }

        const oldFulfillmentStatus = lesson.fulfillmentStatus;

        await db
          .update(booking)
          .set({
            fulfillmentStatus: 'completed',
            coachConfirmedAt: new Date(),
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
              <p>The payment has been transferred to your connected Stripe account.</p>
            </div>
          `,
          text: `Hi ${lesson.coach.name}, your group lesson on ${lessonDateForCoach} has been automatically completed. ${capturedParticipants.length} participants.`,
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
