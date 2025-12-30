import { logger, schedules } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { booking } from "@/lib/db/schema";
import { and, isNotNull, lt, sql } from "drizzle-orm";

/**
 * Cleanup Locks Scheduled Task
 * 
 * Runs every 10 minutes to:
 * - Clear expired `lockedUntil` timestamps on booking records
 * - This releases time slots that were locked during booking attempts
 * 
 * This is time-sensitive because:
 * - Locked slots appear unavailable to other users
 * - Prompt cleanup improves booking availability UX
 */
export const cleanupLocksTask = schedules.task({
    id: "cleanup-locks",
    cron: "*/10 * * * *", // Every 10 minutes
    maxDuration: 60, // 1 minute max
    run: async (payload) => {
        const now = new Date();

        logger.info("Starting cleanup locks", {
            timestamp: payload.timestamp.toISOString(),
            lastRun: payload.lastTimestamp?.toISOString(),
        });

        const results = {
            cleaned: 0,
            errors: [] as string[],
        };

        try {
            const expiredLocks = await db.query.booking.findMany({
                where: and(isNotNull(booking.lockedUntil), lt(booking.lockedUntil, now)),
                columns: {
                    id: true,
                    lockedUntil: true,
                },
            });

            logger.info(`Found ${expiredLocks.length} expired locks to clean up`);

            for (const bookingRecord of expiredLocks) {
                try {
                    await db
                        .update(booking)
                        .set({
                            lockedUntil: null,
                            updatedAt: now,
                        })
                        .where(and(sql`id = ${bookingRecord.id}`, lt(booking.lockedUntil, now)));

                    logger.info(`Cleared expired lock for booking ${bookingRecord.id}`);
                    results.cleaned++;
                } catch (error) {
                    logger.error(`Failed to clear lock for booking ${bookingRecord.id}`, { error });
                    results.errors.push(
                        `${bookingRecord.id}: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            logger.info("Cleanup locks completed", {
                cleaned: results.cleaned,
                errors: results.errors.length,
            });

            return {
                success: true,
                timestamp: now.toISOString(),
                results,
            };
        } catch (error) {
            logger.error("Lock cleanup job failed", { error });
            throw error;
        }
    },
});
