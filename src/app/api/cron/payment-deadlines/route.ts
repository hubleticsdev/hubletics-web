import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/resend';
import {
  getBookingCancelledDueToPaymentEmailTemplate,
  getPaymentReminder12HoursEmailTemplate,
  getPaymentReminder30MinutesEmailTemplate
} from '@/lib/email/templates/payment-notifications';
import { validateCronAuth } from '@/lib/cron/auth';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {

    const now = new Date();

    console.log(`[CRON] Payment deadlines job started at ${now.toISOString()}`);

    const results = {
      reminders12h: 0,
      reminders30m: 0,
      cancelled: 0,
      errors: [] as string[],
    };

    const awaitingPaymentBookings = await db.query.booking.findMany({
      where: and(
        eq(booking.status, 'awaiting_payment'),
        isNull(booking.paymentCompletedAt)
      ),
      with: {
        client: {
          columns: {
            name: true,
            email: true,
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
              status: 'cancelled',
              cancelledBy: null,
              cancelledAt: now,
              cancellationReason: 'Payment not received within 24 hours',
              updatedAt: now,
            })
            .where(eq(booking.id, bookingRecord.id));

          const startDate = new Date(bookingRecord.scheduledStartAt);
          const lessonDate = startDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          });
          const lessonTime = startDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
          });

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

        if (hoursUntilDue <= 12 && hoursUntilDue > 11.98 && !bookingRecord.paymentReminderSentAt) {
          const startDate = new Date(bookingRecord.scheduledStartAt);
          const lessonDate = startDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          });
          const lessonTime = startDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
          });
          const paymentDeadline = paymentDueAt.toLocaleString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });

          const emailTemplate = getPaymentReminder12HoursEmailTemplate(
            bookingRecord.client.name,
            bookingRecord.coach.name,
            lessonDate,
            lessonTime,
            parseFloat(bookingRecord.clientPaid).toFixed(2),
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
              paymentReminderSentAt: now,
              updatedAt: now,
            })
            .where(eq(booking.id, bookingRecord.id));

          console.log(`[CRON] Sent 12h payment reminder for booking ${bookingRecord.id}`);
          results.reminders12h++;
        }

        if (minutesUntilDue <= 30 && minutesUntilDue > 25 && !bookingRecord.paymentFinalReminderSentAt) {
          const startDate = new Date(bookingRecord.scheduledStartAt);
          const lessonDate = startDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          });
          const lessonTime = startDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
          });
          const paymentDeadline = paymentDueAt.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
          });

          const emailTemplate = getPaymentReminder30MinutesEmailTemplate(
            bookingRecord.client.name,
            bookingRecord.coach.name,
            lessonDate,
            lessonTime,
            parseFloat(bookingRecord.clientPaid).toFixed(2),
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

