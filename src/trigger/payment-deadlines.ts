import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Payment Deadlines Scheduled Task
 * 
 * Runs every 5 minutes to:
 * - Send 30-minute payment reminders
 * - Cancel bookings that have exceeded the 24-hour payment deadline
 * 
 * This is time-sensitive because:
 * - 30-minute reminders need precise timing
 * - Payment deadlines should be enforced promptly
 */
export const paymentDeadlinesTask = schedules.task({
    id: "payment-deadlines",
    cron: "*/5 * * * *", // Every 5 minutes
    maxDuration: 120, // 2 minutes max
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

        logger.info("Starting payment deadlines check", {
            timestamp: payload.timestamp.toISOString(),
            lastRun: payload.lastTimestamp?.toISOString(),
        });

        const response = await fetch(`${appUrl}/api/cron/payment-deadlines`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${cronSecret}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error("Payment deadlines API call failed", {
                status: response.status,
                error: errorText,
            });
            throw new Error(`API call failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        logger.info("Payment deadlines check completed", {
            reminders30m: result.results?.reminders30m || 0,
            cancelled: result.results?.cancelled || 0,
            errors: result.results?.errors?.length || 0,
        });

        return result;
    },
});
