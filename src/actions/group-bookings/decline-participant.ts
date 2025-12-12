'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { revalidatePath } from 'next/cache';

export async function declineParticipant(bookingId: string, participantId: string, reason?: string) {
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
      return { success: false, error: 'Cannot decline - participant already paid. Use cancel/refund instead.' };
    }

    if (participant.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(participant.stripePaymentIntentId);
        console.log(`[DECLINE_PARTICIPANT] Cancelled PaymentIntent ${participant.stripePaymentIntentId} for participant ${participantId}`);
      } catch (stripeError: any) {
        console.error('[DECLINE_PARTICIPANT] Stripe cancel error:', stripeError);
        
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(participant.stripePaymentIntentId);
          
          if (paymentIntent.status === 'succeeded') {
            return {
              success: false,
              error: 'Participant payment has been processed. Please use the refund feature instead of declining.',
            };
          }
          
          console.log(`[DECLINE_PARTICIPANT] PaymentIntent status: ${paymentIntent.status}, safe to continue`);
        } catch (retrieveError) {
          console.error('[DECLINE_PARTICIPANT] Could not retrieve PaymentIntent:', retrieveError);
          return {
            success: false,
            error: 'Could not verify payment status. Please try again or contact support.',
          };
        }
      }
    }

    // Update participant status
    await db
      .update(bookingParticipant)
      .set({
        paymentStatus: 'refunded', // Treated as "declined/cancelled"
        cancelledAt: new Date(),
      })
      .where(eq(bookingParticipant.id, participantId));

    // Send notification email to participant
    const startDate = new Date(bookingRecord.scheduledStartAt);
    const participantUser = participant.user as { id: string; name: string; email: string };

    await sendEmail({
      to: participantUser.email,
      subject: `Update on your group lesson request`,
      html: `
        <h2>Group Lesson Update</h2>
        <p>Hi ${participantUser.name},</p>
        <p>Unfortunately, the coach has declined your request to join the group lesson on ${startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.</p>

        ${reason ? `<div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
          <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
        </div>` : ''}

        <p><strong>Good news:</strong> Your payment authorization has been cancelled. You will NOT be charged.</p>

        <p>Feel free to browse other available group lessons from this coach or explore other coaches on the platform.</p>

        <p><a href="${process.env.NEXT_PUBLIC_URL}/coaches" style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">Browse Coaches</a></p>
      `,
      text: `Hi ${participantUser.name}, The coach has declined your request to join the group lesson. Your payment authorization has been cancelled - you will NOT be charged.${reason ? ` Reason: ${reason}` : ''}`,
    });

    console.log(`[DECLINE_PARTICIPANT] Participant ${participantId} declined for booking ${bookingId}`);

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/coach');
    return { success: true };
  } catch (error) {
    console.error('Decline participant error:', error);
    return { success: false, error: 'Failed to decline participant' };
  }
}
