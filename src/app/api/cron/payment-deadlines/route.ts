import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { booking, individualBookingDetails, privateGroupBookingDetails } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import type { BookingWithDetails } from '@/lib/booking-type-guards';
import { isIndividualBooking, isPrivateGroupBooking } from '@/lib/booking-type-guards';
import { sendEmail } from '@/lib/email/resend';
import {
  getBookingCancelledDueToPaymentEmailTemplate,
  getPaymentReminder1HourEmailTemplate
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
      reminders1h: 0,
      cancelled: 0,
      errors: [] as string[],
    };

    // Fetch individual and private group bookings with payment status
    const allBookings = await db.query.booking.findMany({
      where: or(
        eq(booking.bookingType, 'individual'),
        eq(booking.bookingType, 'private_group')
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

    // Filter to only bookings with awaiting_client_payment status
    const awaitingPaymentBookings = allBookings.filter(b => {
      const bookingWithDetails = b as BookingWithDetails;
      if (isIndividualBooking(bookingWithDetails)) {
        return bookingWithDetails.individualDetails.paymentStatus === 'awaiting_client_payment';
      } else if (isPrivateGroupBooking(bookingWithDetails)) {
        return bookingWithDetails.privateGroupDetails.paymentStatus === 'awaiting_client_payment';
      }
      return false;
    });

    for (const bookingRecord of awaitingPaymentBookings) {
      try {
        const bookingWithDetails = bookingRecord as BookingWithDetails;
        let paymentDueAt: Date | null = null;
        let client: { name: string; email: string; timezone: string | null } | null = null;
        let expectedGrossCents: number = 0;
        let reminderSentAt: Date | null = null;
        
        if (isIndividualBooking(bookingWithDetails)) {
          paymentDueAt = bookingWithDetails.individualDetails.paymentDueAt;
          reminderSentAt = bookingWithDetails.individualDetails.paymentFinalReminderSentAt;
          // Access client relation from query result
          const details = bookingRecord.individualDetails as typeof bookingRecord.individualDetails & {
            client?: { name: string; email: string; timezone: string | null } | null;
          };
          client = details.client ?? null;
          expectedGrossCents = bookingWithDetails.individualDetails.clientPaysCents;
        } else if (isPrivateGroupBooking(bookingWithDetails)) {
          paymentDueAt = bookingWithDetails.privateGroupDetails.paymentDueAt;
          reminderSentAt = bookingWithDetails.privateGroupDetails.paymentFinalReminderSentAt;
          // Access organizer relation from query result
          const details = bookingRecord.privateGroupDetails as typeof bookingRecord.privateGroupDetails & {
            organizer?: { name: string; email: string; timezone: string | null } | null;
          };
          client = details.organizer ?? null;
          expectedGrossCents = bookingWithDetails.privateGroupDetails.totalGrossCents;
        }

        if (!paymentDueAt || !client) {
          console.warn(`Booking ${bookingRecord.id} has no paymentDueAt or client`);
          continue;
        }

        const minutesUntilDue = (paymentDueAt.getTime() - now.getTime()) / (1000 * 60);

        if (now > paymentDueAt) {
          // Cancel booking
          await db
            .update(booking)
            .set({
              approvalStatus: 'cancelled',
              cancelledBy: null,
              cancelledAt: now,
              cancellationReason: 'Payment not received within 24 hours',
              updatedAt: now,
            })
            .where(eq(booking.id, bookingRecord.id));

          // Update payment status in detail table
          if (isIndividualBooking(bookingWithDetails)) {
            await db
              .update(individualBookingDetails)
              .set({
                paymentStatus: 'failed',
              })
              .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
          } else if (isPrivateGroupBooking(bookingWithDetails)) {
            await db
              .update(privateGroupBookingDetails)
              .set({
                paymentStatus: 'failed',
              })
              .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
          }

          const startDate = new Date(bookingRecord.scheduledStartAt);
          const clientTimezone = client.timezone || 'America/Chicago';
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

          console.log(`[CRON] Cancelled booking ${bookingRecord.id} - payment deadline passed`);
          results.cancelled++;
          continue;
        }

        // Check for 1-hour reminder
        if (minutesUntilDue <= 60 && minutesUntilDue > 45 && !reminderSentAt) {
          const startDate = new Date(bookingRecord.scheduledStartAt);
          const clientTimezone = client.timezone || 'America/Chicago';
          const lessonDate = formatDateOnly(startDate, clientTimezone);
          const lessonTime = formatTimeOnly(startDate, clientTimezone);
          const paymentDeadline = paymentDueAt.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: clientTimezone
          });

          const emailTemplate = getPaymentReminder1HourEmailTemplate(
            client.name,
            bookingRecord.coach.name,
            lessonDate,
            lessonTime,
            (expectedGrossCents / 100).toFixed(2),
            paymentDeadline
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

          console.log(`[CRON] Sent 1h payment reminder for booking ${bookingRecord.id}`);
          results.reminders1h++;
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
