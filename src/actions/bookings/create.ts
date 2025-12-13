'use server';

import crypto from 'crypto';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile } from '@/lib/db/schema';
import { eq, and, or, gte, lte, sql } from 'drizzle-orm';
import { calculateBookingPricing } from '@/lib/pricing';
import { sendEmail } from '@/lib/email/resend';
import { getBookingRequestEmailTemplate } from '@/lib/email/templates/booking-notifications';
import { z } from 'zod';
import { createBookingSchema, validateInput } from '@/lib/validations';
import { sanitizeText } from '@/lib/utils';
import { formatDateOnly, formatTimeOnly } from '@/lib/utils/date';

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export async function createBooking(input: CreateBookingInput) {
  try {
    const validatedInput = validateInput(createBookingSchema, input);

    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const idempotencyKey = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          clientId: session.user.id,
          coachId: validatedInput.coachId,
          start: validatedInput.scheduledStartAt.toISOString(),
          end: validatedInput.scheduledEndAt.toISOString(),
          location: validatedInput.location,
        })
      )
      .digest('hex');

    const existingBooking = await db.query.booking.findFirst({
      where: eq(booking.idempotencyKey, idempotencyKey),
      columns: {
        id: true,
        createdAt: true,
      },
    });

    if (existingBooking) {
      const ageHours = (Date.now() - new Date(existingBooking.createdAt).getTime()) / (1000 * 60 * 60);

      if (ageHours < 24) {
        console.log(`[IDEMPOTENCY] Returning existing booking ${existingBooking.id} (${ageHours.toFixed(1)}h old)`);
        return {
          success: true,
          bookingId: existingBooking.id,
        };
      }
    }

    const now = new Date();
    const conflicts = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, validatedInput.coachId),
        or(
          and(
            gte(booking.scheduledStartAt, validatedInput.scheduledStartAt),
            lte(booking.scheduledStartAt, validatedInput.scheduledEndAt)
          ),
          and(
            gte(booking.scheduledEndAt, validatedInput.scheduledStartAt),
            lte(booking.scheduledEndAt, validatedInput.scheduledEndAt)
          ),
          and(
            lte(booking.scheduledStartAt, validatedInput.scheduledStartAt),
            gte(booking.scheduledEndAt, validatedInput.scheduledEndAt)
          )
        ),
        or(
          sql`${booking.approvalStatus} IN ('pending_review', 'accepted')`,
          sql`${booking.paymentStatus} = 'awaiting_client_payment'`,
          sql`${booking.capacityStatus} = 'open'`,
          sql`${booking.lockedUntil} > ${now}`
        )
      ),
      columns: {
        id: true,
        lockedUntil: true,
      },
    });

    if (conflicts.length > 0) {
      console.log(`[CONFLICT] Time slot conflict for coach ${validatedInput.coachId}:`, conflicts);
      return {
        success: false,
        error: 'This time slot is no longer available. Please select a different time.',
      };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, validatedInput.coachId),
      with: {
        user: {
          columns: {
            email: true,
            platformFeePercentage: true,
            timezone: true,
          },
        },
      },
    });

    if (!coach) {
      return { success: false, error: 'Coach not found' };
    }

    if (!coach.stripeAccountId) {
      return { success: false, error: 'Coach payment setup incomplete' };
    }

    const duration = Math.round(
      (validatedInput.scheduledEndAt.getTime() - validatedInput.scheduledStartAt.getTime()) /
        (1000 * 60)
    );

    const coachRateNum = parseFloat(coach.hourlyRate);
    const platformFee = coach.user?.platformFeePercentage
      ? parseFloat(coach.user.platformFeePercentage as unknown as string)
      : 15;

    const pricing = calculateBookingPricing(coachRateNum, duration, platformFee);

    const bookingId = crypto.randomUUID();
    
    await db.insert(booking).values({
      id: bookingId,
      clientId: session.user.id,
      coachId: validatedInput.coachId,
      scheduledStartAt: validatedInput.scheduledStartAt,
      scheduledEndAt: validatedInput.scheduledEndAt,
      duration,
      location: validatedInput.location,
      clientMessage: validatedInput.clientMessage ? sanitizeText(validatedInput.clientMessage) : validatedInput.clientMessage,
      coachRate: pricing.coachDesiredRate.toString(),
      expectedGrossCents: pricing.clientPaysCents,
      platformFeeCents: pricing.platformFeeCents,
      stripeFeeCents: pricing.stripeFeeCents,
      coachPayoutCents: pricing.coachPayoutCents,
      approvalStatus: 'pending_review',
      paymentStatus: 'not_required',
      fulfillmentStatus: 'scheduled',
      idempotencyKey,
      lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
    });

    console.log(`Booking created (deferred payment): ${bookingId}`);

    const emailTemplate = getBookingRequestEmailTemplate(
      coach.fullName,
      session.user.name,
      {
        date: formatDateOnly(validatedInput.scheduledStartAt, coach.user.timezone || 'America/Chicago'),
        time: `${formatTimeOnly(validatedInput.scheduledStartAt, coach.user.timezone || 'America/Chicago')} - ${formatTimeOnly(validatedInput.scheduledEndAt, coach.user.timezone || 'America/Chicago')}`,
        duration,
        location: `${validatedInput.location.name}, ${validatedInput.location.address}`,
        amountCents: pricing.clientPaysCents,
      }
    );

    await sendEmail({
      to: coach.user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`Booking request email sent to: ${coach.user.email}`);

    return {
      success: true,
      bookingId,
    };
  } catch (error) {
    console.error('Create booking error:', error);
    return { success: false, error: 'Failed to create booking' };
  }
}
