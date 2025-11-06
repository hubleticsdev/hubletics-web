'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createBookingPaymentIntent } from '@/lib/stripe';
import { calculateBookingPricing } from '@/lib/pricing';
import { sendEmail } from '@/lib/email/resend';
import { getBookingRequestEmailTemplate } from '@/lib/email/templates/booking-notifications';
import { z } from 'zod';
import { createBookingSchema, validateInput } from '@/lib/validations';

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export async function createBooking(input: CreateBookingInput) {
  try {
    // Validate input
    const validatedInput = validateInput(createBookingSchema, input);

    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    // Get coach details including user platform fee
    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, validatedInput.coachId),
      with: {
        user: {
          columns: {
            email: true,
            platformFeePercentage: true,
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

    // Calculate duration in minutes
    const duration = Math.round(
      (validatedInput.scheduledEndAt.getTime() - validatedInput.scheduledStartAt.getTime()) /
        (1000 * 60)
    );

    // Calculate pricing with proper formula
    const coachRateNum = parseFloat(coach.hourlyRate);
    const platformFee = coach.user?.platformFeePercentage
      ? parseFloat(coach.user.platformFeePercentage as unknown as string)
      : 15;

    const pricing = calculateBookingPricing(coachRateNum, duration, platformFee);

    // Create booking record
    const bookingId = crypto.randomUUID();
    
    let paymentIntentId: string;

    // If paymentIntentId provided, use it (payment already confirmed)
    // Otherwise, create a new PaymentIntent (backward compatibility)
    if (validatedInput.paymentIntentId) {
      paymentIntentId = validatedInput.paymentIntentId;
    } else {
      const paymentIntent = await createBookingPaymentIntent(
        pricing.clientPays,
        coach.stripeAccountId,
        {
          bookingId,
          clientId: session.user.id,
          coachId: input.coachId,
        }
      );
      paymentIntentId = paymentIntent.id;
    }
    
    await db.insert(booking).values({
      id: bookingId,
      clientId: session.user.id,
      coachId: validatedInput.coachId,
      scheduledStartAt: validatedInput.scheduledStartAt,
      scheduledEndAt: validatedInput.scheduledEndAt,
      duration,
      location: validatedInput.location,
      clientMessage: validatedInput.clientMessage,
      coachRate: pricing.coachDesiredRate.toString(), // What coach set (what they receive)
      clientPaid: pricing.clientPays.toString(),
      platformFee: pricing.platformFee.toString(),
      stripeFee: pricing.stripeFee.toString(),
      coachPayout: pricing.coachPayout.toString(),
      stripePaymentIntentId: paymentIntentId,
      status: 'pending',
    });

    console.log(`Booking created: ${bookingId}`);
    console.log(`Payment intent: ${paymentIntentId}`);

    // Send email notification to coach
    const emailTemplate = getBookingRequestEmailTemplate(
      coach.fullName,
      session.user.name,
      {
        date: validatedInput.scheduledStartAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        time: `${validatedInput.scheduledStartAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${validatedInput.scheduledEndAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        duration,
        location: `${validatedInput.location.name}, ${validatedInput.location.address}`,
        amount: pricing.clientPays.toFixed(2),
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

