import { logger, schedules } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { booking, individualBookingDetails, privateGroupBookingDetails } from "@/lib/db/schema";
import { eq, or, and, lte, gte, isNull } from "drizzle-orm";
import type { BookingWithDetails } from "@/lib/booking-type-guards";
import { isIndividualBooking, isPrivateGroupBooking } from "@/lib/booking-type-guards";
import { sendEmail } from "./lib/email";
import {
    getBookingCancelledDueToPaymentEmailTemplate,
    getPaymentReminder1HourEmailTemplate,
} from "@/lib/email/templates/payment-notifications";
import { formatDateOnly, formatTimeOnly } from "@/lib/utils/date";

/**
 * Payment Deadlines Scheduled Task
 * 
 * Runs every 30 minutes to:
 * - Send 1-hour payment reminders (when 30-90 mins remain)
 * - Cancel bookings that have exceeded the 24-hour payment deadline
 * 
 * This is time-sensitive because:
 * - Payment deadlines should be enforced promptly
 * - Runs at 30-min intervals to balance accuracy with cost
 */
export const paymentDeadlinesTask = schedules.task({
    id: "payment-deadlines",
    cron: "*/30 * * * *", // Every 30 minutes
    maxDuration: 120, // 2 minutes max
    run: async (payload) => {
        const now = new Date();
        const reminderWindowEnd = new Date(now.getTime() + 90 * 60 * 1000);
        const reminderWindowStart = new Date(now.getTime() + 30 * 60 * 1000);

        logger.info("Starting payment deadlines check", {
            timestamp: payload.timestamp.toISOString(),
            lastRun: payload.lastTimestamp?.toISOString(),
        });

        const results = {
            reminders1h: 0,
            cancelled: 0,
            errors: [] as string[],
        };

        try {
            const awaitingPaymentBookings = await db.query.booking.findMany({
                where: and(
                    or(
                        eq(booking.bookingType, "individual"),
                        eq(booking.bookingType, "private_group")
                    ),
                    eq(booking.approvalStatus, "accepted")
                ),
                with: {
                    coach: {
                        columns: {
                            name: true,
                        },
                    },
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
                },
            });

            const filteredBookings = awaitingPaymentBookings.filter((b) => {
                const bookingWithDetails = b as BookingWithDetails;

                if (isIndividualBooking(bookingWithDetails)) {
                    const details = bookingWithDetails.individualDetails;
                    if (details.paymentStatus !== "awaiting_client_payment") return false;
                    if (!details.paymentDueAt) return false;

                    const dueAt = new Date(details.paymentDueAt);
                    return dueAt <= now ||
                        (dueAt >= reminderWindowStart && dueAt <= reminderWindowEnd && !details.paymentFinalReminderSentAt);

                } else if (isPrivateGroupBooking(bookingWithDetails)) {
                    const details = bookingWithDetails.privateGroupDetails;
                    if (details.paymentStatus !== "awaiting_client_payment") return false;
                    if (!details.paymentDueAt) return false;

                    const dueAt = new Date(details.paymentDueAt);
                    return dueAt <= now ||
                        (dueAt >= reminderWindowStart && dueAt <= reminderWindowEnd && !details.paymentFinalReminderSentAt);
                }

                return false;
            });

            logger.info(`Found ${filteredBookings.length} bookings requiring action`);

            for (const bookingRecord of filteredBookings) {
                try {
                    const bookingWithDetails = bookingRecord as BookingWithDetails;
                    let paymentDueAt: Date | null = null;
                    let client: { name: string; email: string; timezone: string | null } | null = null;
                    let expectedGrossCents: number = 0;
                    let reminderSentAt: Date | null = null;

                    if (isIndividualBooking(bookingWithDetails)) {
                        paymentDueAt = bookingWithDetails.individualDetails.paymentDueAt;
                        reminderSentAt = bookingWithDetails.individualDetails.paymentFinalReminderSentAt;
                        const details = bookingRecord.individualDetails as typeof bookingRecord.individualDetails & {
                            client?: { name: string; email: string; timezone: string | null } | null;
                        };
                        client = details.client ?? null;
                        expectedGrossCents = bookingWithDetails.individualDetails.clientPaysCents;
                    } else if (isPrivateGroupBooking(bookingWithDetails)) {
                        paymentDueAt = bookingWithDetails.privateGroupDetails.paymentDueAt;
                        reminderSentAt = bookingWithDetails.privateGroupDetails.paymentFinalReminderSentAt;
                        const details = bookingRecord.privateGroupDetails as typeof bookingRecord.privateGroupDetails & {
                            organizer?: { name: string; email: string; timezone: string | null } | null;
                        };
                        client = details.organizer ?? null;
                        expectedGrossCents = bookingWithDetails.privateGroupDetails.totalGrossCents;
                    }

                    if (!paymentDueAt || !client) {
                        logger.warn(`Booking ${bookingRecord.id} has no paymentDueAt or client`);
                        continue;
                    }

                    const minutesUntilDue = (paymentDueAt.getTime() - now.getTime()) / (1000 * 60);

                    // Cancel booking if deadline passed
                    if (now > paymentDueAt) {
                        await db
                            .update(booking)
                            .set({
                                approvalStatus: "cancelled",
                                cancelledBy: null,
                                cancelledAt: now,
                                cancellationReason: "Payment not received within 24 hours",
                                updatedAt: now,
                            })
                            .where(eq(booking.id, bookingRecord.id));

                        // Update payment status in detail table
                        if (isIndividualBooking(bookingWithDetails)) {
                            await db
                                .update(individualBookingDetails)
                                .set({
                                    paymentStatus: "failed",
                                })
                                .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
                        } else if (isPrivateGroupBooking(bookingWithDetails)) {
                            await db
                                .update(privateGroupBookingDetails)
                                .set({
                                    paymentStatus: "failed",
                                })
                                .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
                        }

                        const startDate = new Date(bookingRecord.scheduledStartAt);
                        const clientTimezone = client.timezone || "America/Chicago";
                        const lessonDate = formatDateOnly(startDate, clientTimezone);
                        const lessonTime = formatTimeOnly(startDate, clientTimezone);

                        const emailTemplate = getBookingCancelledDueToPaymentEmailTemplate(
                            client.name,
                            bookingRecord.coach.name,
                            lessonDate,
                            lessonTime
                        );

                        await sendEmail({
                            to: client.email,
                            subject: emailTemplate.subject,
                            html: emailTemplate.html,
                            text: emailTemplate.text,
                        });

                        logger.info(`Cancelled booking ${bookingRecord.id} - payment deadline passed`);
                        results.cancelled++;
                        continue;
                    }

                    // Check for 1-hour reminder (30-90 minute window to account for 30-min cron frequency)
                    if (minutesUntilDue <= 90 && minutesUntilDue > 30 && !reminderSentAt) {
                        const startDate = new Date(bookingRecord.scheduledStartAt);
                        const clientTimezone = client.timezone || "America/Chicago";
                        const lessonDate = formatDateOnly(startDate, clientTimezone);
                        const lessonTime = formatTimeOnly(startDate, clientTimezone);
                        const paymentDeadline = paymentDueAt.toLocaleString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: clientTimezone,
                        });

                        const emailTemplate = getPaymentReminder1HourEmailTemplate(
                            client.name,
                            bookingRecord.coach.name,
                            lessonDate,
                            lessonTime,
                            (expectedGrossCents / 100).toFixed(2),
                            paymentDeadline,
                            Math.round(minutesUntilDue)
                        );

                        await sendEmail({
                            to: client.email,
                            subject: emailTemplate.subject,
                            html: emailTemplate.html,
                            text: emailTemplate.text,
                        });

                        // Update paymentFinalReminderSentAt in detail table
                        if (isIndividualBooking(bookingWithDetails)) {
                            await db
                                .update(individualBookingDetails)
                                .set({
                                    paymentFinalReminderSentAt: now,
                                })
                                .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
                        } else if (isPrivateGroupBooking(bookingWithDetails)) {
                            await db
                                .update(privateGroupBookingDetails)
                                .set({
                                    paymentFinalReminderSentAt: now,
                                })
                                .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
                        }

                        logger.info(`Sent 1h payment reminder for booking ${bookingRecord.id}`);
                        results.reminders1h++;
                    }
                } catch (error) {
                    logger.error(`Error processing booking ${bookingRecord.id}`, { error });
                    results.errors.push(
                        `${bookingRecord.id}: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            logger.info("Payment deadlines check completed", {
                reminders1h: results.reminders1h,
                cancelled: results.cancelled,
                errors: results.errors.length,
            });

            return {
                success: true,
                timestamp: now.toISOString(),
                results,
            };
        } catch (error) {
            logger.error("Payment deadlines job failed", { error });
            throw error;
        }
    },
});
