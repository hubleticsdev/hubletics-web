'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, bookingParticipant, coachProfile, user } from '@/lib/db/schema';
import { eq, and, gte, lte, or, inArray } from 'drizzle-orm';
import { calculateCoachEarnings } from '@/lib/pricing';
import { getApplicableTier } from './pricing-tiers';
import { sendEmail } from '@/lib/email/resend';
import { getBookingRequestEmailTemplate } from '@/lib/email/templates/booking-notifications';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';

interface PrivateGroupBookingInput {
  coachId: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  duration: number;
  location: {
    name: string;
    address: string;
    notes?: string;
  };
  participantUsernames: string[];
  clientMessage?: string;
}

export async function createPrivateGroupBooking(input: PrivateGroupBookingInput) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, input.coachId),
      columns: {
        allowPrivateGroups: true,
        fullName: true,
      },
      with: {
        user: {
          columns: {
            email: true,
            platformFeePercentage: true,
          },
        },
      },
    });

    if (!coach || !coach.allowPrivateGroups) {
      return { success: false, error: 'This coach does not accept private group bookings' };
    }

    const participants = await db.query.user.findMany({
      where: inArray(user.username, input.participantUsernames),
      columns: {
        id: true,
        username: true,
        name: true,
      },
    });

    if (participants.length !== input.participantUsernames.length) {
      const found = participants.map(p => p.username);
      const missing = input.participantUsernames.filter(u => !found.includes(u));
      return { success: false, error: `Users not found: ${missing.join(', ')}` };
    }

    const totalParticipants = participants.length + 1;

    const tierResult = await getApplicableTier(input.coachId, totalParticipants);
    if (!tierResult.success || !tierResult.tier) {
      return { success: false, error: `No pricing tier configured for ${totalParticipants} participants` };
    }

    const pricePerPerson = parseFloat(tierResult.tier.pricePerPerson);
    const totalAmount = pricePerPerson * totalParticipants;

    const userPlatformFee = parseFloat(coach.user.platformFeePercentage || '15');
    const { platformFee, stripeFee, coachPayout } = calculateCoachEarnings(totalAmount, userPlatformFee);

    const now = new Date();
    const conflicts = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, input.coachId),
        or(
          and(
            gte(booking.scheduledStartAt, input.scheduledStartAt),
            lte(booking.scheduledStartAt, input.scheduledEndAt)
          ),
          and(
            gte(booking.scheduledEndAt, input.scheduledStartAt),
            lte(booking.scheduledEndAt, input.scheduledEndAt)
          ),
          and(
            lte(booking.scheduledStartAt, input.scheduledStartAt),
            gte(booking.scheduledEndAt, input.scheduledEndAt)
          )
        ),
        or(
          eq(booking.status, 'pending'),
          eq(booking.status, 'awaiting_payment'),
          eq(booking.status, 'accepted'),
          eq(booking.status, 'open')
        )
      ),
    });

    if (conflicts.length > 0) {
      return { success: false, error: 'Time slot no longer available' };
    }

    const bookingId = crypto.randomUUID();
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          organizerId: session.user.id,
          coachId: input.coachId,
          start: input.scheduledStartAt.toISOString(),
          participants: input.participantUsernames.sort(),
        })
      )
      .digest('hex');

    const existingBooking = await db.query.booking.findFirst({
      where: eq(booking.idempotencyKey, idempotencyKey),
    });

    if (existingBooking) {
      const ageHours = (Date.now() - new Date(existingBooking.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours < 24) {
        return { success: true, bookingId: existingBooking.id };
      }
    }

    await db.insert(booking).values({
      id: bookingId,
      clientId: session.user.id,
      coachId: input.coachId,
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      duration: input.duration,
      location: input.location,
      clientMessage: input.clientMessage || null,
      coachRate: pricePerPerson.toString(),
      clientPaid: totalAmount.toString(),
      platformFee: platformFee.toString(),
      stripeFee: stripeFee.toString(),
      coachPayout: coachPayout.toString(),
      stripePaymentIntentId: null,
      status: 'pending',
      isGroupBooking: true,
      groupType: 'private',
      organizerId: session.user.id,
      maxParticipants: totalParticipants,
      minParticipants: totalParticipants,
      pricePerPerson: pricePerPerson.toString(),
      currentParticipants: totalParticipants,
      idempotencyKey,
      lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
    });

    await db.insert(bookingParticipant).values([
      {
        bookingId,
        userId: session.user.id,
        paymentStatus: 'pending',
        amountPaid: totalAmount.toString(),
      },
      ...participants.map(p => ({
        bookingId,
        userId: p.id,
        paymentStatus: 'pending' as const,
        amountPaid: null,
      })),
    ]);

    const emailTemplate = getBookingRequestEmailTemplate(
      coach.fullName,
      session.user.name,
      {
        date: input.scheduledStartAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        time: `${input.scheduledStartAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${input.scheduledEndAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        duration: input.duration,
        location: `${input.location.name}, ${input.location.address}`,
        amount: totalAmount.toFixed(2),
      }
    );

    await sendEmail({
      to: coach.user.email,
      subject: `🎯 Group Booking Request (${totalParticipants} participants)`,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`Private group booking created: ${bookingId} (${totalParticipants} participants)`);

    revalidatePath('/dashboard/bookings');
    return { success: true, bookingId };
  } catch (error) {
    console.error('Create private group booking error:', error);
    return { success: false, error: 'Failed to create group booking' };
  }
}

