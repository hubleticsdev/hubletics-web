import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { and, isNotNull, lt, sql } from 'drizzle-orm';
import { validateCronAuth } from '@/lib/cron/auth';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {

    const now = new Date();
    console.log(`[CRON] Lock cleanup job started at ${now.toISOString()}`);

    const expiredLocks = await db.query.booking.findMany({
      where: and(
        isNotNull(booking.lockedUntil),
        lt(booking.lockedUntil, now)
      ),
      columns: {
        id: true,
        status: true,
        lockedUntil: true,
      },
    });

    console.log(`[CRON] Found ${expiredLocks.length} expired locks to clean up`);

    const results = {
      cleaned: 0,
      errors: [] as string[],
    };

    for (const bookingRecord of expiredLocks) {
      try {
        await db
          .update(booking)
          .set({
            lockedUntil: null,
            updatedAt: now,
          })
          .where(
            and(
              sql`id = ${bookingRecord.id}`,
              lt(booking.lockedUntil, now)
            )
          );

        console.log(`[CRON] Cleared expired lock for booking ${bookingRecord.id}`);
        results.cleaned++;
      } catch (error) {
        console.error(`[CRON] Failed to clear lock for booking ${bookingRecord.id}:`, error);
        results.errors.push(`${bookingRecord.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`[CRON] Lock cleanup job completed. Results:`, results);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    });

  } catch (error) {
    console.error('[CRON] Lock cleanup job failed:', error);
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
