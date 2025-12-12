'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant, coachProfile } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculateCoachEarnings } from '@/lib/pricing';
import { createBookingPaymentIntent } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { revalidatePath } from 'next/cache';

export async function joinPublicLesson(lessonId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const lesson = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, lessonId),
        eq(booking.status, 'open'),
        eq(booking.groupType, 'public')
      ),
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

    if (!lesson.maxParticipants || !lesson.pricePerPerson) {
      return { success: false, error: 'Invalid lesson configuration' };
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
        eq(bookingParticipant.paymentStatus, 'paid')
      ),
    });

    if (currentParticipants.length >= lesson.maxParticipants) {
      return { success: false, error: 'This lesson is now full' };
    }

    const pricePerPerson = parseFloat(lesson.pricePerPerson);

    const userPlatformFee = parseFloat(coach.user.platformFeePercentage || '15');
    const { platformFee, stripeFee, coachPayout } = calculateCoachEarnings(pricePerPerson, userPlatformFee);

    const paymentIntent = await createBookingPaymentIntent(
      pricePerPerson,
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

    await db.insert(bookingParticipant).values({
      bookingId: lessonId,
      userId: session.user.id,
      paymentStatus: 'pending',
      amountPaid: pricePerPerson.toString(),
      stripePaymentIntentId: paymentIntent.id,
    });

    console.log(`User ${session.user.id} joined public lesson ${lessonId}`);

    // Send notification to coach about new participant request
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

      await sendEmail({
        to: coachUser.email,
        subject: `New participant request for your group lesson`,
        html: `
          <h2>New Participant Request</h2>
          <p>Hi ${coachUser.name},</p>
          <p>${session.user.name} has requested to join your group lesson and authorized payment.</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Lesson Details</h3>
            <p><strong>Date:</strong> ${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p><strong>Time:</strong> ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
            <p><strong>Amount:</strong> $${pricePerPerson.toFixed(2)}</p>
          </div>

          <p>Please review and approve or decline this participant from your dashboard.</p>
          <p><a href="${process.env.NEXT_PUBLIC_URL}/dashboard/bookings" style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Requests</a></p>
        `,
        text: `Hi ${coachUser.name}, ${session.user.name} has requested to join your group lesson on ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString()}. Amount: $${pricePerPerson.toFixed(2)}. Please review and approve/decline from your dashboard.`,
      });
    }

    revalidatePath('/dashboard/bookings');
    revalidatePath(`/coaches/${lesson.coachId}`);

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: pricePerPerson,
    };
  } catch (error) {
    console.error('Join public lesson error:', error);
    return { success: false, error: 'Failed to join lesson' };
  }
}

