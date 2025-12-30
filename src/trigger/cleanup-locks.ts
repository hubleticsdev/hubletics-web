import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Cleanup Locks Scheduled Task
 * 
 * Runs every 5 minutes to:
 * - Clear expired `lockedUntil` timestamps on booking records
 * - This releases time slots that were locked during booking attempts
 * 
 * This is time-sensitive because:
 * - Locked slots appear unavailable to other users
 * - Prompt cleanup improves booking availability UX
 */
export const cleanupLocksTask = schedules.task({
    id: "cleanup-locks",
    cron: "*/5 * * * *", // Every 5 minutes
    maxDuration: 60, // 1 minute max
    run: async (payload) => {
        const appUrl = process.env.NEXT_PUBLIC_URL || process.env.APP_URL;
        const cronSecret = process.env.CRON_SECRET;

        if (!appUrl || !cronSecret) {
            logger.error("Missing required environment variables", {
                hasAppUrl: !!appUrl,
                hasCronSecret: !!cronSecret
            });
            throw new Error("Missing APP_URL or CRON_SECRET environment variable");
        }

        logger.info("Starting cleanup locks", {
            timestamp: payload.timestamp.toISOString(),
            lastRun: payload.lastTimestamp?.toISOString(),
        });

        const response = await fetch(`${appUrl}/api/cron/cleanup-locks`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${cronSecret}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error("Cleanup locks API call failed", {
                status: response.status,
                error: errorText,
            });
            throw new Error(`API call failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        logger.info("Cleanup locks completed", {
            cleared: result.results?.cleared || 0,
        });

        return result;
    },
});
