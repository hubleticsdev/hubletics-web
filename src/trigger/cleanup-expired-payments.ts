import { logger, schedules } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { bookingParticipant, publicGroupLessonDetails } from "@/lib/db/schema";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "./lib/email";

/**
 * Cleanup Expired Payments Scheduled Task
 * 
 * Runs every 30 minutes to:
 * - Cancel Stripe PaymentIntents for group lesson participants whose payment authorization has expired
 * - Update participant status to cancelled
 * - Decrement participant counts in public group lesson details
 * - Send notification emails to participants
 * 
 * This is time-sensitive because:
 * - Expired authorizations should be cancelled promptly to release funds
 * - Slot availability needs to be updated for other users
 */
export const cleanupExpiredPaymentsTask = schedules.task({
    id: "cleanup-expired-payments",
    cron: "*/30 * * * *", // Every 30 minutes
    maxDuration: 120, // 2 minutes max
    run: async (payload) => {
        const now = new Date();

        logger.info("Starting cleanup expired payments", {
            timestamp: payload.timestamp.toISOString(),
            lastRun: payload.lastTimestamp?.toISOString(),
        });

        const results = {
            cancelled: 0,
            errors: [] as string[],
            skipped: 0,
        };

        try {
            // Find participants with expired payment windows
            const expiredParticipants = await db.query.bookingParticipant.findMany({
                where: and(
                    eq(bookingParticipant.paymentStatus, "authorized"),
                    eq(bookingParticipant.status, "awaiting_coach"),
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

            logger.info(`Found ${expiredParticipants.length} participants with expired payment windows`);

            for (const participant of expiredParticipants) {
                try {
                    if (!participant.stripePaymentIntentId) {
                        logger.warn(`Participant ${participant.id} has no stripePaymentIntentId`);
                        results.skipped++;
                        continue;
                    }

                    // Cancel payment intent in Stripe
                    await stripe.paymentIntents.cancel(participant.stripePaymentIntentId);

                    // Update participant status
                    await db
                        .update(bookingParticipant)
                        .set({
                            paymentStatus: "cancelled",
                            status: "cancelled",
                            cancelledAt: now,
                        })
                        .where(eq(bookingParticipant.id, participant.id));

                    // Decrement counts in publicGroupLessonDetails if applicable
                    if (participant.booking.publicGroupDetails) {
                        await db
                            .update(publicGroupLessonDetails)
                            .set({
                                currentParticipants: sql`${publicGroupLessonDetails.currentParticipants} - 1`,
                                authorizedParticipants: sql`${publicGroupLessonDetails.authorizedParticipants} - 1`,
                            })
                            .where(eq(publicGroupLessonDetails.bookingId, participant.bookingId));
                    }

                    // Email participant about expiration
                    if (participant.user?.email) {
                        await sendEmail({
                            to: participant.user.email,
                            subject: "Payment Authorization Expired",
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

                    logger.info(
                        `Cancelled PaymentIntent ${participant.stripePaymentIntentId} and updated participant ${participant.id}`
                    );
                    results.cancelled++;
                } catch (error) {
                    logger.error(`Error processing participant ${participant.id}`, { error });
                    results.errors.push(
                        `${participant.id}: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            logger.info("Cleanup expired payments completed", {
                cancelled: results.cancelled,
                skipped: results.skipped,
                errors: results.errors.length,
            });

            return {
                success: true,
                timestamp: now.toISOString(),
                results,
            };
        } catch (error) {
            logger.error("Cleanup expired payments job failed", { error });
            throw error;
        }
    },
});
