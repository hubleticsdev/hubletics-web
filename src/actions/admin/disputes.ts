'use server';

import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq, or, inArray } from 'drizzle-orm';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function getDisputedBookings(page = 1, limit = 25) {
  try {
    const offset = (page - 1) * limit;

    const totalDisputed = await db.$count(booking, eq(booking.status, 'disputed'));

    const bookings = await db.query.booking.findMany({
      where: eq(booking.status, 'disputed'),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
      limit,
      offset,
    });

    return {
      success: true,
      bookings,
      pagination: {
        page,
        limit,
        total: totalDisputed,
        pages: Math.ceil(totalDisputed / limit),
        hasNext: page < Math.ceil(totalDisputed / limit),
        hasPrev: page > 1,
      }
    };
  } catch (error) {
    console.error('Error fetching disputed bookings:', error);
    return { success: false, error: 'Failed to fetch disputed bookings' };
  }
}

export async function processRefund(
  bookingId: string,
  refundType: 'full' | 'partial',
  partialAmount?: number,
  reason?: string
) {
  try {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    if (!bookingRecord.stripePaymentIntentId) {
      return { success: false, error: 'No payment found for this booking' };
    }

    // Fetch the PaymentIntent to get the charge ID
    const paymentIntent = await stripe.paymentIntents.retrieve(
      bookingRecord.stripePaymentIntentId
    );

    if (paymentIntent.status !== 'succeeded') {
      return { success: false, error: 'Payment was not successful' };
    }

    // Get the charge from the payment intent
    const charges = await stripe.charges.list({
      payment_intent: bookingRecord.stripePaymentIntentId,
      limit: 1,
    });

    if (charges.data.length === 0) {
      return { success: false, error: 'No charge found for this payment' };
    }

    const charge = charges.data[0];

    const clientPaidCents = Math.round(parseFloat(bookingRecord.clientPaid) * 100);
    const refundAmountCents =
      refundType === 'full' ? clientPaidCents : Math.round((partialAmount || 0) * 100);

    if (refundAmountCents <= 0 || refundAmountCents > clientPaidCents) {
      return { success: false, error: 'Invalid refund amount' };
    }

    const refund = await stripe.refunds.create({
      charge: charge.id,
      amount: refundAmountCents,
      reverse_transfer: true,
      reason: 'requested_by_customer',
    });

    // Update booking record
    await db
      .update(booking)
      .set({
        status: 'cancelled',
        refundAmount: (refundAmountCents / 100).toString(),
        refundProcessedAt: new Date(),
        cancellationReason: reason || 'Refund processed by admin',
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    await resend.emails.send({
      from: 'Hubletics <noreply@hubletics.com>',
      to: bookingRecord.client.email,
      subject: `Refund Processed - ${bookingRecord.coach.name}`,
      html: `
        <h2>Refund Processed</h2>
        <p>Hi ${bookingRecord.client.name},</p>
        <p>Your refund of <strong>$${(refundAmountCents / 100).toFixed(2)}</strong> has been processed.</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li>Coach: ${bookingRecord.coach.name}</li>
          <li>Date: ${new Date(bookingRecord.scheduledStartAt).toLocaleDateString()}</li>
          <li>Original Amount: $${parseFloat(bookingRecord.clientPaid).toFixed(2)}</li>
          <li>Refund Amount: $${(refundAmountCents / 100).toFixed(2)}</li>
        </ul>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>The refund should appear in your account within 5-10 business days.</p>
      `,
      text: `Hi ${bookingRecord.client.name}, Your refund of $${(refundAmountCents / 100).toFixed(2)} has been processed for your booking with ${bookingRecord.coach.name}. The refund should appear in your account within 5-10 business days.`,
    });

    await resend.emails.send({
      from: 'Hubletics <noreply@hubletics.com>',
      to: bookingRecord.coach.email,
      subject: `Booking Refunded - ${bookingRecord.client.name}`,
      html: `
        <h2>Booking Refunded</h2>
        <p>Hi ${bookingRecord.coach.name},</p>
        <p>A refund of <strong>$${(refundAmountCents / 100).toFixed(2)}</strong> has been issued to ${bookingRecord.client.name}.</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li>Client: ${bookingRecord.client.name}</li>
          <li>Date: ${new Date(bookingRecord.scheduledStartAt).toLocaleDateString()}</li>
          <li>Refund Amount: $${(refundAmountCents / 100).toFixed(2)}</li>
        </ul>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>The funds will be reversed from your account accordingly.</p>
      `,
      text: `Hi ${bookingRecord.coach.name}, A refund of $${(refundAmountCents / 100).toFixed(2)} has been issued to ${bookingRecord.client.name} for your booking on ${new Date(bookingRecord.scheduledStartAt).toLocaleDateString()}.`,
    });

    return {
      success: true,
      message: `Refund of $${(refundAmountCents / 100).toFixed(2)} processed successfully`,
      refundId: refund.id,
    };
  } catch (error) {
    console.error('Error processing refund:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process refund',
    };
  }
}

export async function markDisputeResolved(bookingId: string, resolution: string) {
  try {
    await db
      .update(booking)
      .set({
        status: 'completed',
        cancellationReason: `Dispute resolved: ${resolution}`,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    return { success: true, message: 'Dispute marked as resolved' };
  } catch (error) {
    console.error('Error resolving dispute:', error);
    return { success: false, error: 'Failed to resolve dispute' };
  }
}

export async function initiateDispute(bookingId: string, reason: string, initiatedBy: 'client' | 'coach') {
  try {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    await db
      .update(booking)
      .set({
        status: 'disputed',
        cancellationReason: `${initiatedBy === 'client' ? 'Client' : 'Coach'} initiated dispute: ${reason}`,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    await resend.emails.send({
      from: 'Hubletics <noreply@hubletics.com>',
      to: 'hubleticsdev@gmail.com',
      subject: `New Dispute - ${bookingRecord.coach.name} & ${bookingRecord.client.name}`,
      html: `
        <h2>New Booking Dispute</h2>
        <p><strong>Initiated By:</strong> ${initiatedBy === 'client' ? bookingRecord.client.name : bookingRecord.coach.name}</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li>Coach: ${bookingRecord.coach.name}</li>
          <li>Client: ${bookingRecord.client.name}</li>
          <li>Date: ${new Date(bookingRecord.scheduledStartAt).toLocaleDateString()}</li>
          <li>Amount: $${parseFloat(bookingRecord.clientPaid).toFixed(2)}</li>
        </ul>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><a href="${process.env.NEXT_PUBLIC_URL}/admin/disputes">View in Admin Panel</a></p>
      `,
      text: `New dispute initiated by ${initiatedBy} for booking between ${bookingRecord.coach.name} and ${bookingRecord.client.name}. Reason: ${reason}`,
    });

    // Notify the other party
    const otherParty = initiatedBy === 'client' ? bookingRecord.coach : bookingRecord.client;
    await resend.emails.send({
      from: 'Hubletics <noreply@hubletics.com>',
      to: otherParty.email,
      subject: 'Booking Dispute Initiated',
      html: `
        <h2>Booking Dispute</h2>
        <p>Hi ${otherParty.name},</p>
        <p>A dispute has been initiated for your booking on ${new Date(bookingRecord.scheduledStartAt).toLocaleDateString()}.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Our support team will review this case and contact you if additional information is needed.</p>
        <p><a href="${process.env.NEXT_PUBLIC_URL}/dashboard/bookings">View Booking</a></p>
      `,
      text: `A dispute has been initiated for your booking on ${new Date(bookingRecord.scheduledStartAt).toLocaleDateString()}. Our support team will review this case.`,
    });

    return { success: true, message: 'Dispute initiated successfully' };
  } catch (error) {
    console.error('Error initiating dispute:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate dispute',
    };
  }
}

