'use server';

import { db } from '@/lib/db';
import { booking, individualBookingDetails, privateGroupBookingDetails, publicGroupLessonDetails, bookingParticipant } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { BookingWithDetails } from '@/lib/booking-type-guards';
import { isIndividualBooking, isPrivateGroupBooking, isPublicGroupBooking } from '@/lib/booking-type-guards';
import { requireRole, requireAuth } from '@/lib/auth/session';
import { resend } from '@/lib/email/resend';
import { incrementCoachLessonsCompleted } from '@/lib/coach-stats';
import { stripe } from '@/lib/stripe';
import { formatDateOnly } from '@/lib/utils/date';
import { z } from 'zod';
import { validateInput } from '@/lib/validations';

export async function getDisputedBookings(page = 1, limit = 25) {
  await requireRole('admin');
  try {
    const offset = (page - 1) * limit;

    const totalDisputed = await db.$count(booking, eq(booking.fulfillmentStatus, 'disputed'));

    const bookings = await db.query.booking.findMany({
      where: eq(booking.fulfillmentStatus, 'disputed'),
      with: {
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        individualDetails: {
          with: {
            client: {
              columns: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        privateGroupDetails: {
          with: {
            organizer: {
              columns: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        publicGroupDetails: true,
      },
      orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
      limit,
      offset,
    });

    // Flatten detail table fields for backward compatibility
    const flattenedBookings = bookings.map(b => {
      const bookingWithDetails = b as BookingWithDetails;
      let expectedGrossCents: number | null = null;
      let coachPayoutCents: number | null = null;
      let platformFeeCents: number | null = null;
      let client: { id: string; name: string; email: string; image: string | null } | null = null;

      if (isIndividualBooking(bookingWithDetails)) {
        expectedGrossCents = bookingWithDetails.individualDetails.clientPaysCents;
        coachPayoutCents = bookingWithDetails.individualDetails.coachPayoutCents;
        platformFeeCents = bookingWithDetails.individualDetails.platformFeeCents;
        // Access client relation from query result
        const details = b.individualDetails as typeof b.individualDetails & {
          client?: { id: string; name: string; email: string; image: string | null } | null;
        };
        client = (details as any).client ?? null;
      } else if (isPrivateGroupBooking(bookingWithDetails)) {
        expectedGrossCents = bookingWithDetails.privateGroupDetails.totalGrossCents;
        coachPayoutCents = bookingWithDetails.privateGroupDetails.coachPayoutCents;
        platformFeeCents = bookingWithDetails.privateGroupDetails.platformFeeCents;
        // Access organizer relation from query result
        const details = b.privateGroupDetails as typeof b.privateGroupDetails & {
          organizer?: { id: string; name: string; email: string; image: string | null } | null;
        };
        client = (details as any).organizer ?? null;
      }
      // Public groups don't have booking-level amounts (participants pay individually)

      return {
        ...b,
        expectedGrossCents,
        coachPayoutCents,
        platformFeeCents,
        client,
      };
    });

    return {
      success: true,
      bookings: flattenedBookings,
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

const processRefundSchema = z.object({
  bookingId: z.string().uuid(),
  refundType: z.enum(['full', 'partial']),
  partialAmount: z.number().positive().optional(),
  reason: z.string().optional(),
});

export async function processRefund(
  bookingId: string,
  refundType: 'full' | 'partial',
  partialAmount?: number,
  reason?: string
) {
  await requireRole('admin');

  try {
    const validated = validateInput(processRefundSchema, {
      bookingId,
      refundType,
      partialAmount,
      reason,
    });

    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, validated.bookingId),
      with: {
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            timezone: true,
          },
        },
        individualDetails: {
          with: {
            client: {
              columns: {
                id: true,
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
                id: true,
                name: true,
                email: true,
                timezone: true,
              },
            },
          },
        },
        publicGroupDetails: true,
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    // Handle individual bookings
    if (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails) {
      const details = bookingRecord.individualDetails;
      if (!details.stripePaymentIntentId) {
        return { success: false, error: 'No payment found for this booking' };
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(details.stripePaymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return { success: false, error: 'Payment was not successful' };
      }

      const charges = await stripe.charges.list({
        payment_intent: details.stripePaymentIntentId,
        limit: 1,
      });

      if (charges.data.length === 0) {
        return { success: false, error: 'No charge found for this payment' };
      }

      const charge = charges.data[0];
      const clientPaidCents = details.clientPaysCents || 0;
      const refundAmountCents =
        validated.refundType === 'full' ? clientPaidCents : Math.round((validated.partialAmount || 0) * 100);

      if (refundAmountCents <= 0 || refundAmountCents > clientPaidCents) {
        return { success: false, error: 'Invalid refund amount' };
      }

      const refund = await stripe.refunds.create({
        charge: charge.id,
        amount: refundAmountCents,
        reverse_transfer: true,
        reason: 'requested_by_customer',
      });

      await db
        .update(booking)
        .set({
          approvalStatus: 'cancelled',
          fulfillmentStatus: 'disputed',
          cancellationReason: validated.reason || 'Refund processed by admin',
          updatedAt: new Date(),
        })
        .where(eq(booking.id, validated.bookingId));

      await db
        .update(individualBookingDetails)
        .set({
          paymentStatus: 'refunded',
        })
        .where(eq(individualBookingDetails.bookingId, validated.bookingId));

      const client = details.client;
      if (!client) {
        return { success: false, error: 'Client not found' };
      }

      await resend.emails.send({
        from: 'Hubletics <noreply@hubletics.com>',
        to: client.email,
        subject: `Refund Processed - ${bookingRecord.coach.name}`,
        html: `
          <h2>Refund Processed</h2>
          <p>Hi ${client.name},</p>
          <p>Your refund of <strong>$${(refundAmountCents / 100).toFixed(2)}</strong> has been processed.</p>
          <p><strong>Booking Details:</strong></p>
          <ul>
            <li>Coach: ${bookingRecord.coach.name}</li>
            <li>Date: ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), client.timezone || 'America/Chicago')}</li>
            <li>Original Amount: $${(clientPaidCents / 100).toFixed(2)}</li>
            <li>Refund Amount: $${(refundAmountCents / 100).toFixed(2)}</li>
          </ul>
          ${validated.reason ? `<p><strong>Reason:</strong> ${validated.reason}</p>` : ''}
          <p>The refund should appear in your account within 5-10 business days.</p>
        `,
        text: `Hi ${client.name}, Your refund of $${(refundAmountCents / 100).toFixed(2)} has been processed for your booking with ${bookingRecord.coach.name}. The refund should appear in your account within 5-10 business days.`,
      });

      await resend.emails.send({
        from: 'Hubletics <noreply@hubletics.com>',
        to: bookingRecord.coach.email,
        subject: `Booking Refunded - ${client.name}`,
        html: `
          <h2>Booking Refunded</h2>
          <p>Hi ${bookingRecord.coach.name},</p>
          <p>A refund of <strong>$${(refundAmountCents / 100).toFixed(2)}</strong> has been issued to ${client.name}.</p>
          <p><strong>Booking Details:</strong></p>
          <ul>
            <li>Client: ${client.name}</li>
            <li>Date: ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), bookingRecord.coach.timezone || 'America/Chicago')}</li>
            <li>Refund Amount: $${(refundAmountCents / 100).toFixed(2)}</li>
          </ul>
          ${validated.reason ? `<p><strong>Reason:</strong> ${validated.reason}</p>` : ''}
          <p>The funds will be reversed from your account accordingly.</p>
        `,
        text: `Hi ${bookingRecord.coach.name}, A refund of $${(refundAmountCents / 100).toFixed(2)} has been issued to ${client.name} for your booking on ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), bookingRecord.coach.timezone || 'America/Chicago')}.`,
      });

      return {
        success: true,
        message: `Refund of $${(refundAmountCents / 100).toFixed(2)} processed successfully`,
        refundId: refund.id,
      };
    }

    // Handle private group bookings
    if (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails) {
      if (!bookingRecord.privateGroupDetails.stripePaymentIntentId) {
        return { success: false, error: 'No payment found for this booking' };
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(
        bookingRecord.privateGroupDetails.stripePaymentIntentId
      );

      if (paymentIntent.status !== 'succeeded') {
        return { success: false, error: 'Payment was not successful' };
      }

      const charges = await stripe.charges.list({
        payment_intent: bookingRecord.privateGroupDetails.stripePaymentIntentId,
        limit: 1,
      });

      if (charges.data.length === 0) {
        return { success: false, error: 'No charge found for this payment' };
      }

      const charge = charges.data[0];
      const totalPaidCents = bookingRecord.privateGroupDetails.totalGrossCents || 0;
      const refundAmountCents =
        validated.refundType === 'full' ? totalPaidCents : Math.round((validated.partialAmount || 0) * 100);

      if (refundAmountCents <= 0 || refundAmountCents > totalPaidCents) {
        return { success: false, error: 'Invalid refund amount' };
      }

      const refund = await stripe.refunds.create({
        charge: charge.id,
        amount: refundAmountCents,
        reverse_transfer: true,
        reason: 'requested_by_customer',
      });

      await db
        .update(booking)
        .set({
          approvalStatus: 'cancelled',
          fulfillmentStatus: 'disputed',
          cancellationReason: validated.reason || 'Refund processed by admin',
          updatedAt: new Date(),
        })
        .where(eq(booking.id, validated.bookingId));

      await db
        .update(privateGroupBookingDetails)
        .set({
          paymentStatus: 'refunded',
        })
        .where(eq(privateGroupBookingDetails.bookingId, validated.bookingId));

      const organizer = bookingRecord.privateGroupDetails.organizer;
      if (!organizer) {
        return { success: false, error: 'Organizer not found' };
      }
      await resend.emails.send({
        from: 'Hubletics <noreply@hubletics.com>',
        to: organizer.email,
        subject: `Refund Processed - ${bookingRecord.coach.name}`,
        html: `
          <h2>Refund Processed</h2>
          <p>Hi ${organizer.name},</p>
          <p>Your refund of <strong>$${(refundAmountCents / 100).toFixed(2)}</strong> has been processed for your private group booking.</p>
          <p><strong>Booking Details:</strong></p>
          <ul>
            <li>Coach: ${bookingRecord.coach.name}</li>
            <li>Date: ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), organizer.timezone || 'America/Chicago')}</li>
            <li>Original Amount: $${(totalPaidCents / 100).toFixed(2)}</li>
            <li>Refund Amount: $${(refundAmountCents / 100).toFixed(2)}</li>
          </ul>
          ${validated.reason ? `<p><strong>Reason:</strong> ${validated.reason}</p>` : ''}
          <p>The refund should appear in your account within 5-10 business days.</p>
        `,
        text: `Hi ${organizer.name}, Your refund of $${(refundAmountCents / 100).toFixed(2)} has been processed for your private group booking with ${bookingRecord.coach.name}. The refund should appear in your account within 5-10 business days.`,
      });

      await resend.emails.send({
        from: 'Hubletics <noreply@hubletics.com>',
        to: bookingRecord.coach.email,
        subject: `Private Group Booking Refunded - ${organizer.name}`,
        html: `
          <h2>Private Group Booking Refunded</h2>
          <p>Hi ${bookingRecord.coach.name},</p>
          <p>A refund of <strong>$${(refundAmountCents / 100).toFixed(2)}</strong> has been issued to ${organizer.name}.</p>
          <p><strong>Booking Details:</strong></p>
          <ul>
            <li>Organizer: ${organizer.name}</li>
            <li>Date: ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), bookingRecord.coach.timezone || 'America/Chicago')}</li>
            <li>Refund Amount: $${(refundAmountCents / 100).toFixed(2)}</li>
          </ul>
          ${validated.reason ? `<p><strong>Reason:</strong> ${validated.reason}</p>` : ''}
          <p>The funds will be reversed from your account accordingly.</p>
        `,
        text: `Hi ${bookingRecord.coach.name}, A refund of $${(refundAmountCents / 100).toFixed(2)} has been issued to ${organizer.name} for your private group booking on ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), bookingRecord.coach.timezone || 'America/Chicago')}.`,
      });

      return {
        success: true,
        message: `Refund of $${(refundAmountCents / 100).toFixed(2)} processed successfully`,
        refundId: refund.id,
      };
    }

    // Handle public group bookings, refund all captured participants
    if (bookingRecord.bookingType === 'public_group') {
      const capturedParticipants = await db.query.bookingParticipant.findMany({
        where: and(
          eq(bookingParticipant.bookingId, validated.bookingId),
          eq(bookingParticipant.paymentStatus, 'captured')
        ),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              timezone: true,
            },
          },
        },
      });

      if (capturedParticipants.length === 0) {
        return { success: false, error: 'No captured payments found for this booking' };
      }

      const totalPaidCents = capturedParticipants.reduce((sum, p) => sum + (p.amountCents || 0), 0);
      const refundAmountCents =
        validated.refundType === 'full' ? totalPaidCents : Math.round((validated.partialAmount || 0) * 100);

      if (refundAmountCents <= 0 || refundAmountCents > totalPaidCents) {
        return { success: false, error: 'Invalid refund amount' };
      }

      // Calculate per-participant refund
      const refundPerParticipant = Math.floor(refundAmountCents / capturedParticipants.length);
      const remainder = refundAmountCents % capturedParticipants.length;

      let refundedCount = 0;
      let totalRefunded = 0;

      for (let i = 0; i < capturedParticipants.length; i++) {
        const participant = capturedParticipants[i];
        if (!participant.stripePaymentIntentId) continue;

        const participantRefundAmount = refundPerParticipant + (i < remainder ? 1 : 0);

        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(participant.stripePaymentIntentId);
          if (paymentIntent.status !== 'succeeded') continue;

          const charges = await stripe.charges.list({
            payment_intent: participant.stripePaymentIntentId,
            limit: 1,
          });

          if (charges.data.length === 0) continue;

          const refund = await stripe.refunds.create({
            charge: charges.data[0].id,
            amount: participantRefundAmount,
            reverse_transfer: true,
            reason: 'requested_by_customer',
          });

          await db
            .update(bookingParticipant)
            .set({
              paymentStatus: 'refunded',
              refundedAt: new Date(),
              refundAmount: (participantRefundAmount / 100).toString(),
            })
            .where(eq(bookingParticipant.id, participant.id));

          refundedCount++;
          totalRefunded += participantRefundAmount;

          // Send email to participant
          if (participant.user) {
            await resend.emails.send({
              from: 'Hubletics <noreply@hubletics.com>',
              to: participant.user.email,
              subject: `Refund Processed - ${bookingRecord.coach.name}`,
            html: `
              <h2>Refund Processed</h2>
              <p>Hi ${participant.user.name},</p>
              <p>Your refund of <strong>$${(participantRefundAmount / 100).toFixed(2)}</strong> has been processed for your public group lesson.</p>
              <p><strong>Booking Details:</strong></p>
              <ul>
                <li>Coach: ${bookingRecord.coach.name}</li>
                <li>Date: ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), participant.user.timezone || 'America/Chicago')}</li>
                <li>Original Amount: $${((participant.amountCents || 0) / 100).toFixed(2)}</li>
                <li>Refund Amount: $${(participantRefundAmount / 100).toFixed(2)}</li>
              </ul>
              ${validated.reason ? `<p><strong>Reason:</strong> ${validated.reason}</p>` : ''}
              <p>The refund should appear in your account within 5-10 business days.</p>
            `,
              text: `Hi ${participant.user.name}, Your refund of $${(participantRefundAmount / 100).toFixed(2)} has been processed for your public group lesson with ${bookingRecord.coach.name}. The refund should appear in your account within 5-10 business days.`,
            });
          }
        } catch (error) {
          console.error(`Failed to refund participant ${participant.userId}:`, error);
        }
      }

      if (refundedCount === 0) {
        return { success: false, error: 'Failed to process any refunds' };
      }

      await db
        .update(booking)
        .set({
          approvalStatus: 'cancelled',
          fulfillmentStatus: 'disputed',
          cancellationReason: validated.reason || 'Refund processed by admin',
          updatedAt: new Date(),
        })
        .where(eq(booking.id, validated.bookingId));

      await resend.emails.send({
        from: 'Hubletics <noreply@hubletics.com>',
        to: bookingRecord.coach.email,
        subject: `Public Group Lesson Refunded`,
        html: `
          <h2>Public Group Lesson Refunded</h2>
          <p>Hi ${bookingRecord.coach.name},</p>
          <p>Refunds totaling <strong>$${(totalRefunded / 100).toFixed(2)}</strong> have been issued to ${refundedCount} participant(s) for your public group lesson.</p>
          <p><strong>Booking Details:</strong></p>
          <ul>
            <li>Date: ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), bookingRecord.coach.timezone || 'America/Chicago')}</li>
            <li>Total Refund Amount: $${(totalRefunded / 100).toFixed(2)}</li>
            <li>Participants Refunded: ${refundedCount}</li>
          </ul>
          ${validated.reason ? `<p><strong>Reason:</strong> ${validated.reason}</p>` : ''}
          <p>The funds will be reversed from your account accordingly.</p>
        `,
        text: `Hi ${bookingRecord.coach.name}, Refunds totaling $${(totalRefunded / 100).toFixed(2)} have been issued to ${refundedCount} participant(s) for your public group lesson on ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), bookingRecord.coach.timezone || 'America/Chicago')}.`,
      });

      return {
        success: true,
        message: `Refunded $${(totalRefunded / 100).toFixed(2)} to ${refundedCount} participant(s)`,
      };
    }

    return { success: false, error: 'Unsupported booking type' };
  } catch (error) {
    console.error('Error processing refund:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process refund',
    };
  }
}

const markDisputeResolvedSchema = z.object({
  bookingId: z.string().uuid(),
  resolution: z.string().min(1),
});

export async function markDisputeResolved(bookingId: string, resolution: string) {
  await requireRole('admin');

  try {
    const validated = validateInput(markDisputeResolvedSchema, {
      bookingId,
      resolution,
    });

    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, validated.bookingId),
      with: {
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            timezone: true,
          },
        },
        individualDetails: {
          with: {
            client: {
              columns: {
                id: true,
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
                id: true,
                name: true,
                email: true,
                timezone: true,
              },
            },
          },
        },
        publicGroupDetails: true,
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    await db
      .update(booking)
      .set({
        fulfillmentStatus: 'completed',
        cancellationReason: `Dispute resolved: ${validated.resolution}`,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, validated.bookingId));

    await incrementCoachLessonsCompleted(bookingRecord.coachId);

    const clientInfo =
      bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails?.client
        ? bookingRecord.individualDetails.client
        : bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails?.organizer
        ? bookingRecord.privateGroupDetails.organizer
        : null;

    if (clientInfo) {
      await resend.emails.send({
        from: 'Hubletics <noreply@hubletics.com>',
        to: clientInfo.email,
        subject: `Dispute Resolved - ${bookingRecord.coach.name}`,
        html: `
          <h2>Dispute Resolved</h2>
          <p>Hi ${clientInfo.name},</p>
          <p>The dispute for your booking with ${bookingRecord.coach.name} has been resolved.</p>
          <p><strong>Resolution:</strong> ${validated.resolution}</p>
          <p><strong>Booking Details:</strong></p>
          <ul>
            <li>Coach: ${bookingRecord.coach.name}</li>
            <li>Date: ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), clientInfo.timezone || 'America/Chicago')}</li>
          </ul>
          <p>The booking has been marked as completed.</p>
        `,
        text: `Hi ${clientInfo.name}, The dispute for your booking with ${bookingRecord.coach.name} has been resolved. Resolution: ${validated.resolution}`,
      });
    }

    await resend.emails.send({
      from: 'Hubletics <noreply@hubletics.com>',
      to: bookingRecord.coach.email,
      subject: `Dispute Resolved`,
      html: `
        <h2>Dispute Resolved</h2>
        <p>Hi ${bookingRecord.coach.name},</p>
        <p>The dispute for your booking has been resolved.</p>
        <p><strong>Resolution:</strong> ${validated.resolution}</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li>Date: ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), bookingRecord.coach.timezone || 'America/Chicago')}</li>
        </ul>
        <p>The booking has been marked as completed.</p>
      `,
      text: `Hi ${bookingRecord.coach.name}, The dispute for your booking has been resolved. Resolution: ${validated.resolution}`,
    });

    return { success: true, message: 'Dispute marked as resolved' };
  } catch (error) {
    console.error('Error resolving dispute:', error);
    return { success: false, error: 'Failed to resolve dispute' };
  }
}

const initiateDisputeSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(1),
  initiatedBy: z.enum(['client', 'coach']),
});

export async function initiateDispute(bookingId: string, reason: string, initiatedBy: 'client' | 'coach') {
  try {
    const validated = validateInput(initiateDisputeSchema, {
      bookingId,
      reason,
      initiatedBy,
    });

    const session = await requireAuth();
    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, validated.bookingId),
      with: {
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            timezone: true,
          },
        },
        individualDetails: {
          with: {
            client: {
              columns: {
                id: true,
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
                id: true,
                name: true,
                email: true,
                timezone: true,
              },
            },
          },
        },
        publicGroupDetails: true,
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    // Authorization: user must be the client/coach or admin
    const isAuthorized =
      session.user.role === 'admin' ||
      (validated.initiatedBy === 'client' &&
        (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails
          ? bookingRecord.individualDetails.clientId === session.user.id
          : bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails
          ? bookingRecord.privateGroupDetails.organizerId === session.user.id
          : false)) ||
      (validated.initiatedBy === 'coach' && bookingRecord.coachId === session.user.id);

    if (!isAuthorized) {
      return { success: false, error: 'Unauthorized to initiate dispute for this booking' };
    }

    await db
      .update(booking)
      .set({
        fulfillmentStatus: 'disputed',
        cancellationReason: `${validated.initiatedBy === 'client' ? 'Client' : 'Coach'} initiated dispute: ${validated.reason}`,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, validated.bookingId));

    const clientInfo =
      bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails?.client
        ? bookingRecord.individualDetails.client
        : bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails?.organizer
        ? bookingRecord.privateGroupDetails.organizer
        : null;

    const amountCents =
      bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails
        ? bookingRecord.individualDetails.clientPaysCents
        : bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails
        ? bookingRecord.privateGroupDetails.totalGrossCents
        : null;

    const initiatorName =
      validated.initiatedBy === 'client'
        ? clientInfo?.name || 'Client'
        : bookingRecord.coach.name;

    await resend.emails.send({
      from: 'Hubletics <noreply@hubletics.com>',
      to: 'hubleticsdev@gmail.com',
      subject: `New Dispute - ${bookingRecord.coach.name} & ${clientInfo?.name || 'Unknown'}`,
      html: `
        <h2>New Booking Dispute</h2>
        <p><strong>Initiated By:</strong> ${initiatorName}</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li>Coach: ${bookingRecord.coach.name}</li>
          <li>${bookingRecord.bookingType === 'private_group' ? 'Organizer' : 'Client'}: ${clientInfo?.name || 'Unknown'}</li>
          <li>Date: ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), clientInfo?.timezone || bookingRecord.coach.timezone || 'America/Chicago')}</li>
          ${amountCents ? `<li>Amount: $${(amountCents / 100).toFixed(2)}</li>` : ''}
        </ul>
        <p><strong>Reason:</strong> ${validated.reason}</p>
        <p><a href="${process.env.NEXT_PUBLIC_URL}/admin/disputes">View in Admin Panel</a></p>
      `,
      text: `New dispute initiated by ${validated.initiatedBy} for booking between ${bookingRecord.coach.name} and ${clientInfo?.name || 'Unknown'}. Reason: ${validated.reason}`,
    });

    // Notify the other party
    const otherParty =
      validated.initiatedBy === 'client' ? bookingRecord.coach : clientInfo;
    if (otherParty) {
      await resend.emails.send({
        from: 'Hubletics <noreply@hubletics.com>',
        to: otherParty.email,
        subject: 'Booking Dispute Initiated',
        html: `
          <h2>Booking Dispute</h2>
          <p>Hi ${otherParty.name},</p>
          <p>A dispute has been initiated for your booking on ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), otherParty.timezone || 'America/Chicago')}.</p>
          <p><strong>Reason:</strong> ${validated.reason}</p>
          <p>Our support team will review this case and contact you if additional information is needed.</p>
          <p><a href="${process.env.NEXT_PUBLIC_URL}/dashboard/bookings">View Booking</a></p>
        `,
        text: `A dispute has been initiated for your booking on ${formatDateOnly(new Date(bookingRecord.scheduledStartAt), otherParty.timezone || 'America/Chicago')}. Our support team will review this case.`,
      });
    }

    return { success: true, message: 'Dispute initiated successfully' };
  } catch (error) {
    console.error('Error initiating dispute:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate dispute',
    };
  }
}
