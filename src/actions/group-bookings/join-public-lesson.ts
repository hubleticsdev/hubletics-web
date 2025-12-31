'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant, coachProfile } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createBookingPaymentIntent } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { getNewParticipantRequestEmailTemplate } from '@/lib/email/templates/group-booking-notifications';
import { revalidatePath } from 'next/cache';
import { formatDateOnly, formatTimeOnly } from '@/lib/utils/date';
import { recordPaymentEvent } from '@/lib/payment-audit';

export async function joinPublicLesson(lessonId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const lesson = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, lessonId),
        eq(booking.bookingType, 'public_group')
      ),
      with: {
        publicGroupDetails: true,
      },
    });

    if (!lesson) {
      return { success: false, error: 'Lesson not found or no longer available' };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, lesson.coachId),
      columns: {
        stripeAccountId: true,
      },
      with: {
        user: {
          columns: {
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
      return { success: false, error: 'Coach has not completed Stripe setup' };
    }

    if (!lesson.publicGroupDetails || !lesson.publicGroupDetails.maxParticipants || !lesson.publicGroupDetails.pricePerPerson) {
      return { success: false, error: 'Invalid lesson configuration' };
    }

    if (lesson.publicGroupDetails.capacityStatus !== 'open') {
      return { success: false, error: 'Lesson is no longer available' };
    }

    const existingParticipant = await db.query.bookingParticipant.findFirst({
      where: and(
        eq(bookingParticipant.bookingId, lessonId),
        eq(bookingParticipant.userId, session.user.id)
      ),
    });

    if (existingParticipant) {
      return { success: false, error: 'You have already joined this lesson' };
    }

    const currentParticipants = await db.query.bookingParticipant.findMany({
      where: and(
        eq(bookingParticipant.bookingId, lessonId),
        eq(bookingParticipant.paymentStatus, 'captured')
      ),
    });

    if (currentParticipants.length >= lesson.publicGroupDetails.maxParticipants) {
      return { success: false, error: 'This lesson is now full' };
    }

    const coachRatePerPerson = parseFloat(lesson.publicGroupDetails.pricePerPerson);

    const platformFee = coach.user?.platformFeePercentage
      ? parseFloat(coach.user.platformFeePercentage as unknown as string)
      : 15;

    // use calculateGroupTotals to get the marked-up client price
    const { calculateGroupTotals } = await import('@/lib/pricing');
    const groupPricing = calculateGroupTotals(coachRatePerPerson, 1, platformFee);

    const clientPaysPerPerson = groupPricing.pricePerPerson;
    const stripeFeeCentsPerPerson = Math.round(groupPricing.stripeFeeCents);

    const paymentIntent = await createBookingPaymentIntent(
      clientPaysPerPerson,
      coach.stripeAccountId,
      {
        bookingId: lessonId,
        clientId: session.user.id,
        coachId: lesson.coachId,
      }
    );

    if (!paymentIntent) {
      throw new Error('Failed to create payment intent');
    }

    const [insertedParticipant] = await db.insert(bookingParticipant).values({
      bookingId: lessonId,
      userId: session.user.id,
      role: 'participant',
      status: 'awaiting_payment',
      paymentStatus: 'requires_payment_method',
      amountPaid: clientPaysPerPerson.toString(),
      amountCents: Math.round(clientPaysPerPerson * 100),
      stripeFeeCents: stripeFeeCentsPerPerson,
      stripePaymentIntentId: paymentIntent.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).returning({ id: bookingParticipant.id });

    await recordPaymentEvent({
      bookingId: lessonId,
      participantId: insertedParticipant.id,
      stripePaymentIntentId: paymentIntent.id,
      amountCents: Math.round(clientPaysPerPerson * 100),
      status: 'created',
      captureMethod: 'manual',
    });

    console.log(`User ${session.user.id} requested to join public lesson ${lessonId}`);

    const { user } = await import('@/lib/db/schema');
    const coachUser = await db.query.user.findFirst({
      where: eq(user.id, lesson.coachId),
      columns: {
        email: true,
        name: true,
      },
    });

    if (coachUser) {
      const startDate = new Date(lesson.scheduledStartAt);
      const endDate = new Date(lesson.scheduledEndAt);

      const coachTimezone = coach.user.timezone || 'America/Chicago';
      const lessonDate = formatDateOnly(startDate, coachTimezone);
      const startTime = formatTimeOnly(startDate, coachTimezone);
      const endTime = formatTimeOnly(endDate, coachTimezone);
      const lessonTime = `${startTime} - ${endTime}`;

      const emailTemplate = getNewParticipantRequestEmailTemplate(
        coachUser.name,
        session.user.name,
        lessonDate,
        lessonTime,
        Math.round(clientPaysPerPerson * 100)
      );

      await sendEmail({
        to: coachUser.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });

      console.log(`Coach ${coachUser.name} notified of participant request from ${session.user.name}`);
    }

    revalidatePath('/dashboard/bookings');
    revalidatePath(`/coaches/${lesson.coachId}`);

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: clientPaysPerPerson,
    };
  } catch (error) {
    console.error('Join public lesson error:', error);
    return { success: false, error: 'Failed to join lesson' };
  }
}
