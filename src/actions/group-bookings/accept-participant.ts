'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant, coachProfile } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { revalidatePath } from 'next/cache';

export async function acceptParticipant(bookingId: string, participantId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.coachId, session.user.id)
      ),
      with: {
        coach: {
          columns: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found or unauthorized' };
    }

    if (!bookingRecord.isGroupBooking || bookingRecord.groupType !== 'public') {
      return { success: false, error: 'Not a public group lesson' };
    }

    const participant = await db.query.bookingParticipant.findFirst({
      where: and(
        eq(bookingParticipant.id, participantId),
        eq(bookingParticipant.bookingId, bookingId)
      ),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!participant) {
      return { success: false, error: 'Participant not found' };
    }

    if (participant.paymentStatus === 'paid') {
      return { success: false, error: 'Participant already accepted' };
    }

    if (!participant.stripePaymentIntentId) {
      return { success: false, error: 'No payment intent found for this participant' };
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(participant.stripePaymentIntentId);

      if (paymentIntent.status !== 'requires_capture') {
        console.error(`[ACCEPT_PARTICIPANT] Invalid PaymentIntent status: ${paymentIntent.status} for ${participant.stripePaymentIntentId}`);
        return {
          success: false,
          error: `Cannot capture payment - status is '${paymentIntent.status}'. Client may not have completed payment.`
        };
      }
    } catch (stripeError: any) {
      console.error('[ACCEPT_PARTICIPANT] Failed to retrieve PaymentIntent:', stripeError);
      return { success: false, error: `Failed to verify payment status: ${stripeError.message}` };
    }

    try {
      await stripe.paymentIntents.capture(participant.stripePaymentIntentId);
      console.log(`[ACCEPT_PARTICIPANT] Captured payment ${participant.stripePaymentIntentId} for participant ${participantId}`);
    } catch (stripeError: any) {
      console.error('[ACCEPT_PARTICIPANT] Stripe capture error:', stripeError);
      return { success: false, error: `Payment capture failed: ${stripeError.message}` };
    }

    await db
      .update(bookingParticipant)
      .set({
        paymentStatus: 'paid',
      })
      .where(eq(bookingParticipant.id, participantId));

    await db
      .update(booking)
      .set({
        currentParticipants: sql`${booking.currentParticipants} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    const updatedBooking = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
      columns: {
        currentParticipants: true,
        maxParticipants: true,
      },
    });

    if (
      updatedBooking &&
      updatedBooking.currentParticipants !== null &&
      updatedBooking.currentParticipants >= (updatedBooking.maxParticipants || 0)
    ) {
      await db
        .update(booking)
        .set({
          status: 'accepted',
          updatedAt: new Date(),
        })
        .where(eq(booking.id, bookingId));

      console.log(`[ACCEPT_PARTICIPANT] Lesson ${bookingId} is now full (${updatedBooking.currentParticipants}/${updatedBooking.maxParticipants})`);
    }

    const startDate = new Date(bookingRecord.scheduledStartAt);
    const endDate = new Date(bookingRecord.scheduledEndAt);
    const participantUser = participant.user as { id: string; name: string; email: string };

    await sendEmail({
      to: participantUser.email,
      subject: `✅ You're confirmed for ${bookingRecord.clientMessage || 'Group Lesson'}`,
      html: `
        <h2>You're In!</h2>
        <p>Hi ${participantUser.name},</p>
        <p>Great news! Your spot in the group lesson has been confirmed.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Lesson Details</h3>
          <p><strong>Date:</strong> ${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <p><strong>Time:</strong> ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
          <p><strong>Coach:</strong> ${bookingRecord.coach?.name}</p>
          ${bookingRecord.location ? `<p><strong>Location:</strong> ${(bookingRecord.location as any).name}, ${(bookingRecord.location as any).address}</p>` : ''}
        </div>

        <p>Your payment has been processed. See you there!</p>
        <p><a href="${process.env.NEXT_PUBLIC_URL}/dashboard/bookings" style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Booking</a></p>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          Need to cancel? Please contact your coach as soon as possible.
        </p>
      `,
      text: `Hi ${participantUser.name}, You're confirmed for the group lesson on ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString()}. Coach: ${bookingRecord.coach?.name}. Your payment has been processed.`,
    });

    console.log(`[ACCEPT_PARTICIPANT] Participant ${participantId} accepted for booking ${bookingId}`);

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/coach');
    return { success: true };
  } catch (error) {
    console.error('Accept participant error:', error);
    return { success: false, error: 'Failed to accept participant' };
  }
}
