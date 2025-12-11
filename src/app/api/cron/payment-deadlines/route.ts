import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { and, eq, lt, isNull, lte } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/resend';
import { validateCronAuth } from '@/lib/cron/auth';

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {

    const now = new Date();
    const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

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
          
          await sendEmail({
            to: bookingRecord.client.email,
            subject: 'Booking Cancelled - Payment Not Received',
            html: `
              <h2>Booking Cancelled</h2>
              <p>Hi ${bookingRecord.client.name},</p>
              <p>Your booking for ${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} with ${bookingRecord.coach.name} has been automatically cancelled because payment was not received within 24 hours.</p>
              <p>You can book a new session anytime on the platform.</p>
              <p><a href="${process.env.NEXT_PUBLIC_URL}/coaches">Find Coaches</a></p>
            `,
            text: `Your booking has been cancelled due to non-payment. Book a new session at ${process.env.NEXT_PUBLIC_URL}/coaches`,
          });

          console.log(`[CRON] Cancelled booking ${bookingRecord.id} - payment deadline passed`);
          results.cancelled++;
          continue;
        }

        if (hoursUntilDue <= 12 && hoursUntilDue > 11.98 && !bookingRecord.paymentReminderSentAt) {
          const startDate = new Date(bookingRecord.scheduledStartAt);
          
          await sendEmail({
            to: bookingRecord.client.email,
            subject: 'Reminder: Payment Due in 12 Hours',
            html: `
              <h2>⏰ Payment Reminder</h2>
              <p>Hi ${bookingRecord.client.name},</p>
              <p>This is a friendly reminder that payment for your lesson with ${bookingRecord.coach.name} is due in <strong>12 hours</strong>.</p>
              
              <p><strong>Lesson:</strong> ${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
              <p><strong>Amount:</strong> $${parseFloat(bookingRecord.clientPaid).toFixed(2)}</p>
              <p><strong>Payment Deadline:</strong> ${paymentDueAt.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              
              <p style="margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_URL}/dashboard/bookings" 
                   style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Pay Now
                </a>
              </p>
              
              <p style="color: #666; font-size: 14px;">
                If payment is not received by the deadline, this booking will be automatically cancelled.
              </p>
            `,
            text: `Payment reminder: Your lesson payment is due in 12 hours. Amount: $${parseFloat(bookingRecord.clientPaid).toFixed(2)}. Deadline: ${paymentDueAt.toLocaleString()}. Pay now at ${process.env.NEXT_PUBLIC_URL}/dashboard/bookings`,
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
          
          await sendEmail({
            to: bookingRecord.client.email,
            subject: '🚨 URGENT: Payment Due in 30 Minutes',
            html: `
              <h2>🚨 Final Payment Reminder</h2>
              <p>Hi ${bookingRecord.client.name},</p>
              <p><strong>This is your final reminder</strong> - payment for your lesson is due in <strong>30 minutes</strong>!</p>
              
              <p><strong>Lesson:</strong> ${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
              <p><strong>Amount:</strong> $${parseFloat(bookingRecord.clientPaid).toFixed(2)}</p>
              <p><strong>Payment Deadline:</strong> ${paymentDueAt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
              
              <p style="margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_URL}/dashboard/bookings" 
                   style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Pay Now - Don't Lose Your Spot!
                </a>
              </p>
              
              <p style="color: #dc2626; font-weight: 600;">
                ⚠️ If payment is not received within 30 minutes, this booking will be cancelled.
              </p>
            `,
            text: `URGENT: Your lesson payment is due in 30 MINUTES. Amount: $${parseFloat(bookingRecord.clientPaid).toFixed(2)}. Pay immediately at ${process.env.NEXT_PUBLIC_URL}/dashboard/bookings or booking will be cancelled.`,
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

