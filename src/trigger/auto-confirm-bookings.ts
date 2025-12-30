import { logger, schedules } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { booking, bookingParticipant, individualBookingDetails, privateGroupBookingDetails } from "@/lib/db/schema";
import { and, eq, lt, isNotNull, ne } from "drizzle-orm";
import { processCoachPayoutSafely } from "./lib/stripe";
import { sendEmail } from "./lib/email";
import {
    getAutoConfirmationClientEmailTemplate,
    getAutoConfirmationCoachEmailTemplate,
} from "@/lib/email/templates/payment-notifications";
import { incrementCoachLessonsCompleted } from "@/lib/coach-stats";
import { formatDateOnly } from "@/lib/utils/date";
import { recordStateTransition } from "@/lib/booking-audit";
import { isIndividualBooking, isPrivateGroupBooking, isPublicGroupBooking } from "@/lib/booking-type-guards";

/**
 * Auto-Confirm Bookings Scheduled Task
 *
 * Runs daily at 6am UTC to:
 * - Auto-confirm individual and private group bookings after 7 days if client hasn't confirmed
 * - Auto-complete public group lessons 7+ days after completion
 * - Transfer funds to coaches
 * - Send confirmation emails to clients and coaches
 * - Update coach stats and record state transitions
 *
 * This ensures:
 * - Coaches get paid even if clients don't manually confirm
 * - Platform doesn't hold funds indefinitely
 * - Good customer experience with automatic resolution
 */
export const autoConfirmBookingsTask = schedules.task({
    id: "auto-confirm-bookings",
    cron: "0 6 * * *", // Daily at 6am UTC
    maxDuration: 300, // 5 minutes max
    run: async (payload) => {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        logger.info("Starting auto-confirm bookings", {
            timestamp: payload.timestamp.toISOString(),
            lastRun: payload.lastTimestamp?.toISOString(),
            sevenDaysAgo: sevenDaysAgo.toISOString(),
        });

        const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            errors: [] as string[],
        };

        try {
            // ===== INDIVIDUAL BOOKINGS =====
            const eligibleIndividualBookings = await db.query.booking.findMany({
                where: and(
                    eq(booking.bookingType, "individual"),
                    eq(booking.approvalStatus, "accepted"),
                    eq(booking.fulfillmentStatus, "scheduled"),
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

            const individualToAutoConfirm = eligibleIndividualBookings.filter(
                (b) => !b.individualDetails?.clientConfirmedAt
            );

            // ===== PRIVATE GROUP BOOKINGS =====
            const eligiblePrivateGroupBookings = await db.query.booking.findMany({
                where: and(
                    eq(booking.bookingType, "private_group"),
                    eq(booking.approvalStatus, "accepted"),
                    eq(booking.fulfillmentStatus, "scheduled"),
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

            const privateGroupToAutoConfirm = eligiblePrivateGroupBookings.filter(
                (b) => !b.privateGroupDetails?.organizerConfirmedAt
            );

            const eligibleBookings = [...individualToAutoConfirm, ...privateGroupToAutoConfirm];

            logger.info(
                `Found ${eligibleBookings.length} bookings to auto-confirm (${individualToAutoConfirm.length} individual, ${privateGroupToAutoConfirm.length} private group)`
            );

            // ===== PROCESS INDIVIDUAL AND PRIVATE GROUP BOOKINGS =====
            for (const bookingRecord of eligibleBookings) {
                results.processed++;

                try {
                    logger.info(`Processing booking: ${bookingRecord.id} (${bookingRecord.bookingType})`);

                    // Auto-confirm in appropriate detail table
                    if (isIndividualBooking(bookingRecord)) {
                        await db
                            .update(individualBookingDetails)
                            .set({
                                clientConfirmedAt: now,
                            })
                            .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
                    } else if (isPrivateGroupBooking(bookingRecord)) {
                        await db
                            .update(privateGroupBookingDetails)
                            .set({
                                organizerConfirmedAt: now,
                            })
                            .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
                    }

                    // Update booking fulfillment status
                    await db
                        .update(booking)
                        .set({
                            fulfillmentStatus: "completed",
                            updatedAt: now,
                        })
                        .where(eq(booking.id, bookingRecord.id));

                    // Increment coach stats
                    await incrementCoachLessonsCompleted(bookingRecord.coachId);

                    // Transfer funds to coach
                    const transferResult = await processCoachPayoutSafely(bookingRecord.id);
                    if (!transferResult.success) {
                        logger.error(`Transfer failed for booking ${bookingRecord.id}: ${transferResult.error}`);
                        results.errors.push(`${bookingRecord.id}: Transfer failed - ${transferResult.error}`);
                    }

                    // Send emails
                    const startDate = new Date(bookingRecord.scheduledStartAt);

                    if (isIndividualBooking(bookingRecord) && bookingRecord.individualDetails) {
                        const clientTimezone = bookingRecord.individualDetails.client.timezone || "America/Chicago";
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

                        const coachTimezone = bookingRecord.coach.timezone || "America/Chicago";
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
                        const organizerTimezone =
                            bookingRecord.privateGroupDetails.organizer.timezone || "America/Chicago";
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

                        const coachTimezone = bookingRecord.coach.timezone || "America/Chicago";
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
                        field: "fulfillmentStatus",
                        oldStatus: "scheduled",
                        newStatus: "completed",
                        reason: "Auto-confirmed after 7 days",
                    });

                    logger.info(`Booking ${bookingRecord.id} auto-confirmed successfully`);
                    results.succeeded++;
                } catch (error) {
                    logger.error(`Failed to process booking ${bookingRecord.id}`, { error });
                    results.failed++;
                    results.errors.push(
                        `${bookingRecord.id}: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            // ===== PUBLIC GROUP LESSONS =====
            const publicGroupCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            const eligiblePublicGroups = await db.query.booking.findMany({
                where: and(
                    eq(booking.bookingType, "public_group"),
                    eq(booking.approvalStatus, "accepted"),
                    ne(booking.fulfillmentStatus, "completed"),
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

            logger.info(`Found ${eligiblePublicGroups.length} public group lessons to auto-complete`);

            for (const lesson of eligiblePublicGroups) {
                results.processed++;

                try {
                    logger.info(`Processing public group lesson: ${lesson.id}`);

                    if (!isPublicGroupBooking(lesson) || !lesson.publicGroupDetails) {
                        logger.error(`Invalid public group booking ${lesson.id}`);
                        results.errors.push(`${lesson.id}: Invalid booking structure`);
                        results.failed++;
                        continue;
                    }

                    const capturedParticipants = await db.query.bookingParticipant.findMany({
                        where: and(
                            eq(bookingParticipant.bookingId, lesson.id),
                            eq(bookingParticipant.paymentStatus, "captured")
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
                        logger.info(`No captured participants for public group ${lesson.id}, marking as completed`);
                        await db
                            .update(booking)
                            .set({
                                fulfillmentStatus: "completed",
                                coachConfirmedAt: now,
                                updatedAt: now,
                            })
                            .where(eq(booking.id, lesson.id));

                        await recordStateTransition({
                            bookingId: lesson.id,
                            field: "fulfillmentStatus",
                            oldStatus: lesson.fulfillmentStatus,
                            newStatus: "completed",
                            reason: "Auto-completed by cron (no participants)",
                        });

                        results.succeeded++;
                        continue;
                    }

                    // Transfer funds to coach
                    const transferResult = await processCoachPayoutSafely(lesson.id);
                    if (!transferResult.success) {
                        logger.error(`Transfer failed for public group ${lesson.id}: ${transferResult.error}`);
                        results.errors.push(`${lesson.id}: Transfer failed - ${transferResult.error}`);
                        results.failed++;
                        continue;
                    }

                    const oldFulfillmentStatus = lesson.fulfillmentStatus;

                    await db
                        .update(booking)
                        .set({
                            fulfillmentStatus: "completed",
                            coachConfirmedAt: now,
                            updatedAt: now,
                        })
                        .where(eq(booking.id, lesson.id));

                    await db
                        .update(bookingParticipant)
                        .set({
                            status: "completed",
                        })
                        .where(
                            and(
                                eq(bookingParticipant.bookingId, lesson.id),
                                eq(bookingParticipant.paymentStatus, "captured")
                            )
                        );

                    await incrementCoachLessonsCompleted(lesson.coachId);

                    await recordStateTransition({
                        bookingId: lesson.id,
                        field: "fulfillmentStatus",
                        oldStatus: oldFulfillmentStatus,
                        newStatus: "completed",
                        reason: "Auto-completed by cron",
                    });

                    const startDate = new Date(lesson.scheduledStartAt);

                    // Email all participants
                    for (const participant of capturedParticipants) {
                        const participantTimezone = participant.user.timezone || "America/Chicago";
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

                    // Email coach
                    const coachTimezone = lesson.coach.timezone || "America/Chicago";
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

                    logger.info(`Public group lesson ${lesson.id} auto-completed successfully`);
                    results.succeeded++;
                } catch (error) {
                    logger.error(`Failed to process public group lesson ${lesson.id}`, { error });
                    results.failed++;
                    results.errors.push(
                        `${lesson.id}: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            logger.info("Auto-confirm bookings completed", {
                processed: results.processed,
                succeeded: results.succeeded,
                failed: results.failed,
                errors: results.errors.length,
            });

            return {
                success: true,
                timestamp: now.toISOString(),
                results,
            };
        } catch (error) {
            logger.error("Auto-confirm bookings job failed", { error });
            throw error;
        }
    },
});
