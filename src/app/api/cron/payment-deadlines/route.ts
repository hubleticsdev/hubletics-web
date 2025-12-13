import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/resend';
import {
  getBookingCancelledDueToPaymentEmailTemplate,
  getPaymentReminder12HoursEmailTemplate,
  getPaymentReminder30MinutesEmailTemplate
} from '@/lib/email/templates/payment-notifications';
import { validateCronAuth } from '@/lib/cron/auth';
import { formatDateOnly, formatTimeOnly } from '@/lib/utils/date';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {

    const now = new Date();

    console.log(`[CRON] Payment deadlines job started at ${now.toISOString()}`);

    const results = {
      reminders30m: 0,
      cancelled: 0,
      errors: [] as string[],
    };

    const awaitingPaymentBookings = await db.query.booking.findMany({
      where: eq(booking.paymentStatus, 'awaiting_client_payment'),
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
          },
        },
      },
    });

    for (const bookingRecord of awaitingPaymentBookings) {
      try {
        if (!bookingRecord.paymentDueAt) {
          console.warn(`Booking ${bookingRecord.id} has no paymentDueAt`);
          continue;
        }

        const paymentDueAt = new Date(bookingRecord.paymentDueAt);
        const hoursUntilDue = (paymentDueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
        const minutesUntilDue = (paymentDueAt.getTime() - now.getTime()) / (1000 * 60);

        if (now > paymentDueAt) {
          await db
            .update(booking)
            .set({
              approvalStatus: 'cancelled',
              paymentStatus: 'failed',
              cancelledBy: null,
              cancelledAt: now,
              cancellationReason: 'Payment not received within 24 hours',
              updatedAt: now,
            })
            .where(eq(booking.id, bookingRecord.id));

          const startDate = new Date(bookingRecord.scheduledStartAt);
          const clientTimezone = bookingRecord.client.timezone || 'America/Chicago';
          const lessonDate = formatDateOnly(startDate, clientTimezone);
          const lessonTime = formatTimeOnly(startDate, clientTimezone);

          const emailTemplate = getBookingCancelledDueToPaymentEmailTemplate(
            bookingRecord.client.name,
            bookingRecord.coach.name,
            lessonDate,
            lessonTime
          );

          await sendEmail({
            to: bookingRecord.client.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text,
          });

          console.log(`[CRON] Cancelled booking ${bookingRecord.id} - payment deadline passed`);
          results.cancelled++;
          continue;
        }

        if (minutesUntilDue <= 30 && minutesUntilDue > 25 && !bookingRecord.paymentFinalReminderSentAt) {
          const startDate = new Date(bookingRecord.scheduledStartAt);
          const clientTimezone = bookingRecord.client.timezone || 'America/Chicago';
          const lessonDate = formatDateOnly(startDate, clientTimezone);
          const lessonTime = formatTimeOnly(startDate, clientTimezone);
          const paymentDeadline = paymentDueAt.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: clientTimezone
          });

          const emailTemplate = getPaymentReminder30MinutesEmailTemplate(
            bookingRecord.client.name,
            bookingRecord.coach.name,
            lessonDate,
            lessonTime,
            bookingRecord.expectedGrossCents ? (bookingRecord.expectedGrossCents / 100).toFixed(2) : '0.00',
            paymentDeadline
          );

          await sendEmail({
            to: bookingRecord.client.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text,
          });

          await db
            .update(booking)
            .set({
              paymentFinalReminderSentAt: now,
              updatedAt: now,
            })
            .where(eq(booking.id, bookingRecord.id));

          console.log(`[CRON] Sent 30m payment reminder for booking ${bookingRecord.id}`);
          results.reminders30m++;
        }

      } catch (error) {
        console.error(`[CRON] Error processing booking ${bookingRecord.id}:`, error);
        results.errors.push(`${bookingRecord.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`[CRON] Payment deadlines job completed. Results:`, results);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    });

  } catch (error) {
    console.error('[CRON] Payment deadlines job failed:', error);
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
