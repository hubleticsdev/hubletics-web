'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { calculatePricing, createBookingPaymentIntent } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { getBookingRequestEmailTemplate } from '@/lib/email/templates/booking-notifications';

interface CreateBookingInput {
  coachId: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  location: {
    name: string;
    address: string;
    notes?: string;
  };
  clientMessage?: string;
  paymentIntentId?: string; // Optional: if provided, use existing PI; otherwise create new one
}

export async function createBooking(input: CreateBookingInput) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    // Get coach details
    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, input.coachId),
      with: {
        user: {
          columns: {
            email: true,
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
      (input.scheduledEndAt.getTime() - input.scheduledStartAt.getTime()) /
        (1000 * 60)
    );

    // Calculate pricing
    const coachRateNum = parseFloat(coach.hourlyRate);
    const pricing = calculatePricing(coachRateNum);

    // Create booking record
    const bookingId = crypto.randomUUID();
    
    let paymentIntentId: string;

    // If paymentIntentId provided, use it (payment already confirmed)
    // Otherwise, create a new PaymentIntent (backward compatibility)
    if (input.paymentIntentId) {
      paymentIntentId = input.paymentIntentId;
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
      coachId: input.coachId,
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      duration,
      location: input.location,
      clientMessage: input.clientMessage,
      coachRate: coach.hourlyRate,
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
        date: input.scheduledStartAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        time: `${input.scheduledStartAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${input.scheduledEndAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        duration,
        location: `${input.location.name}, ${input.location.address}`,
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

