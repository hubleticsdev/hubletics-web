'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, individualBookingDetails, privateGroupBookingDetails, publicGroupLessonDetails, bookingParticipant, coachProfile } from '@/lib/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { incrementCoachLessonsCompleted } from '@/lib/coach-stats';
import {
  cancelBookingPayment,
  refundBookingPayment,
  transferToCoach,
} from '@/lib/stripe';
import { sendEmail } from '@/lib/email/resend';
import { getBookingAcceptedEmailTemplate, getBookingDeclinedEmailTemplate } from '@/lib/email/templates/booking-management-notifications';
import { uuidSchema, validateInput } from '@/lib/validations';
import { recordStateTransition, recordMultipleTransitions } from '@/lib/booking-audit';
import { recordPaymentEvent } from '@/lib/payment-audit';
import { revalidatePath } from 'next/cache';
import { formatDateOnly, formatTimeOnly, formatDateWithTimezone } from '@/lib/utils/date';
import { calculateCoachEarnings } from '@/lib/pricing';

export async function processCoachPayoutSafely(bookingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
      with: {
        individualDetails: true,
        privateGroupDetails: true,
        publicGroupDetails: true,
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, bookingRecord.coachId),
      with: {
        user: {
          columns: {
            platformFeePercentage: true,
          },
        },
      },
    });

    if (!coach?.stripeAccountId) {
      console.error(`[TRANSFER] Coach has no Stripe account for booking ${bookingId}`);
      return { success: false, error: 'Coach Stripe account not configured' };
    }

    const platformFeePercentage = coach.user?.platformFeePercentage
      ? parseFloat(coach.user.platformFeePercentage as unknown as string)
      : 15;

    let paymentIntentId: string | null = null;
    let coachPayoutAmount = 0;

    if (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails) {
      if (bookingRecord.individualDetails.stripeTransferId) {
        console.log(`[TRANSFER] Individual booking ${bookingId} already has transfer ${bookingRecord.individualDetails.stripeTransferId} - skipping`);
        return { success: true };
      }
      paymentIntentId = bookingRecord.individualDetails.stripePaymentIntentId;
      coachPayoutAmount = bookingRecord.individualDetails.coachPayoutCents / 100;

    } else if (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails) {
      if (bookingRecord.privateGroupDetails.stripeTransferId) {
        console.log(`[TRANSFER] Private group booking ${bookingId} already has transfer ${bookingRecord.privateGroupDetails.stripeTransferId} - skipping`);
        return { success: true };
      }
      paymentIntentId = bookingRecord.privateGroupDetails.stripePaymentIntentId;
      coachPayoutAmount = bookingRecord.privateGroupDetails.coachPayoutCents / 100;

    } else if (bookingRecord.bookingType === 'public_group' && bookingRecord.publicGroupDetails) {
      if (bookingRecord.publicGroupDetails.stripeTransferId) {
        console.log(`[TRANSFER] Public group booking ${bookingId} already has transfer ${bookingRecord.publicGroupDetails.stripeTransferId} - skipping`);
        return { success: true };
      }

      // For public groups, calculate aggregate payout from all captured participants
      // Use proper pricing calculation, not hardcoded percentage
      const capturedParticipants = await db.query.bookingParticipant.findMany({
        where: and(
          eq(bookingParticipant.bookingId, bookingId),
          eq(bookingParticipant.paymentStatus, 'captured')
        ),
      });

      for (const participant of capturedParticipants) {
        if (participant.amountCents) {
          // Use proper pricing calculation from pricing.ts
          const earnings = calculateCoachEarnings(
            participant.amountCents / 100,
            platformFeePercentage
          );
          coachPayoutAmount += earnings.coachPayout;
        }
      }

      paymentIntentId = 'aggregate'; // Special case for aggregate transfers

    } else {
      return { success: false, error: 'Unsupported booking type' };
    }

    if (!paymentIntentId) {
      return { success: false, error: 'No payment intent found' };
    }

    console.log(`[TRANSFER] Transferring $${coachPayoutAmount} to coach for ${bookingRecord.bookingType} booking ${bookingId}`);
    const transfer = await transferToCoach(
      coachPayoutAmount,
      coach.stripeAccountId,
      {
        bookingId: bookingRecord.id,
        paymentIntentId,
        coachId: bookingRecord.coachId,
      }
    );

    console.log(`[TRANSFER] Transfer successful: ${transfer.id}`);

    // Determine the correct detail table and field based on booking type
    let transferTable: typeof individualBookingDetails | typeof privateGroupBookingDetails | typeof publicGroupLessonDetails;
    let transferField: typeof individualBookingDetails.stripeTransferId | typeof privateGroupBookingDetails.stripeTransferId | typeof publicGroupLessonDetails.stripeTransferId;

    if (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails) {
      transferTable = individualBookingDetails;
      transferField = individualBookingDetails.stripeTransferId;
    } else if (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails) {
      transferTable = privateGroupBookingDetails;
      transferField = privateGroupBookingDetails.stripeTransferId;
    } else if (bookingRecord.bookingType === 'public_group' && bookingRecord.publicGroupDetails) {
      transferTable = publicGroupLessonDetails;
      transferField = publicGroupLessonDetails.stripeTransferId;
    } else {
      return { success: false, error: 'Unsupported booking type for transfer' };
    }

    // Update transfer ID on the detail table (detail tables don't have updatedAt)
    await db
      .update(transferTable)
      .set({
        stripeTransferId: transfer.id,
      })
      .where(
        and(
          eq(transferTable.bookingId, bookingId),
          sql`${transferField} IS NULL`
        )
      );
    
    // Update the booking table's updatedAt separately
    await db
      .update(booking)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    return { success: true };
  } catch (error) {
    console.error(`[TRANSFER] Failed to transfer funds for booking ${bookingId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Transfer failed' };
  }
}

export async function acceptBooking(bookingId: string) {
  try {
    const validatedBookingId = validateInput(uuidSchema, bookingId);

    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, validatedBookingId),
        eq(booking.coachId, session.user.id),
        eq(booking.approvalStatus, 'pending_review'),
        eq(booking.bookingType, 'individual')
      ),
      with: {
        coach: {
          columns: {
            name: true,
            email: true,
          },
        },
        individualDetails: {
          with: {
            client: {
              columns: {
                name: true,
                email: true,
                timezone: true,
              },
            },
          },
        },
      },
    });

    if (!bookingRecord || !bookingRecord.individualDetails) {
      return { success: false, error: 'Booking not found' };
    }

    const paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update booking status
    await db
      .update(booking)
      .set({
        approvalStatus: 'accepted',
        coachRespondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, validatedBookingId));

    // Update individual booking details payment status
    await db
      .update(individualBookingDetails)
      .set({
        paymentStatus: 'awaiting_client_payment',
        paymentDueAt,
      })
      .where(eq(individualBookingDetails.bookingId, validatedBookingId));

    // Record state transitions
    await recordMultipleTransitions(
      bookingRecord.id,
      [
        { field: 'approvalStatus', oldStatus: 'pending_review', newStatus: 'accepted' },
        { field: 'paymentStatus', oldStatus: 'not_required', newStatus: 'awaiting_client_payment' },
      ],
      session.user.id
    );

    console.log(`Booking accepted: ${validatedBookingId}`);
    console.log(`Payment due by: ${paymentDueAt.toISOString()}`);

    const startDate = new Date(bookingRecord.scheduledStartAt);
    const clientTimezone = bookingRecord.individualDetails?.client.timezone || 'America/Chicago';

    const lessonDate = formatDateOnly(startDate, clientTimezone);
    const lessonTime = formatTimeOnly(startDate, clientTimezone);
    const paymentDeadline = formatDateWithTimezone(paymentDueAt, clientTimezone);

    const emailTemplate = getBookingAcceptedEmailTemplate(
      bookingRecord.individualDetails.client.name,
      bookingRecord.coach.name,
      lessonDate,
      lessonTime,
      bookingRecord.location ? `${bookingRecord.location.name}, ${bookingRecord.location.address}` : 'Location to be confirmed',
      bookingRecord.individualDetails.clientPaysCents,
      paymentDeadline
    );

    await sendEmail({
      to: bookingRecord.individualDetails?.client.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`Payment request email sent to: ${bookingRecord.individualDetails?.client.email}`);

    revalidatePath('/dashboard/coach');

    return { success: true };
  } catch (error) {
    console.error('Accept booking error:', error);
    return { success: false, error: 'Failed to accept booking' };
  }
}

export async function declineBooking(bookingId: string, reason?: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.coachId, session.user.id),
        eq(booking.approvalStatus, 'pending_review'),
        or(
          eq(booking.bookingType, 'individual'),
          eq(booking.bookingType, 'private_group')
        )
      ),
      with: {
        coach: {
          columns: {
            name: true,
          },
        },
        individualDetails: {
          with: {
            client: {
              columns: {
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
                name: true,
                email: true,
                timezone: true,
              },
            },
          },
        },
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    // Handle individual bookings
    if (bookingRecord.bookingType === 'individual') {
      if (!bookingRecord.individualDetails) {
        return { success: false, error: 'Booking details not found' };
      }

      // Only cancel PI if one exists (won't exist for pending_review individual bookings with deferred payment)
      if (bookingRecord.individualDetails.stripePaymentIntentId) {
        await cancelBookingPayment(bookingRecord.individualDetails.stripePaymentIntentId);
        console.log(`Payment cancelled: ${bookingRecord.individualDetails.stripePaymentIntentId}`);
      }

      await db
        .update(booking)
        .set({
          approvalStatus: 'declined',
          coachRespondedAt: new Date(),
          cancellationReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(booking.id, bookingId));

      // Record state transition
      await recordStateTransition({
        bookingId: bookingRecord.id,
        field: 'approvalStatus',
        oldStatus: 'pending_review',
        newStatus: 'declined',
        changedBy: session.user.id,
        reason,
      });

      console.log(`Booking declined: ${bookingId}`);

      // Send decline notification email to client
      const startDate = new Date(bookingRecord.scheduledStartAt);
      const clientTimezone = bookingRecord.individualDetails.client.timezone || 'America/Chicago';
      const lessonDate = formatDateOnly(startDate, clientTimezone);
      const lessonTime = formatTimeOnly(startDate, clientTimezone);

      const emailTemplate = getBookingDeclinedEmailTemplate(
        bookingRecord.individualDetails.client.name,
        bookingRecord.coach.name,
        lessonDate,
        lessonTime,
        reason
      );

      await sendEmail({
        to: bookingRecord.individualDetails.client.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });

      console.log(`Decline notification sent to: ${bookingRecord.individualDetails.client.email}`);
    }

    // Handle private group bookings
    if (bookingRecord.bookingType === 'private_group') {
      if (!bookingRecord.privateGroupDetails) {
        return { success: false, error: 'Booking details not found' };
      }

      if (bookingRecord.privateGroupDetails.stripePaymentIntentId) {
        await cancelBookingPayment(bookingRecord.privateGroupDetails.stripePaymentIntentId);
        console.log(`Payment cancelled: ${bookingRecord.privateGroupDetails.stripePaymentIntentId}`);
      }

      await db
        .update(booking)
        .set({
          approvalStatus: 'declined',
          coachRespondedAt: new Date(),
          cancellationReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(booking.id, bookingId));

      // Record state transition
      await recordStateTransition({
        bookingId: bookingRecord.id,
        field: 'approvalStatus',
        oldStatus: 'pending_review',
        newStatus: 'declined',
        changedBy: session.user.id,
        reason,
      });

      console.log(`Private group booking declined: ${bookingId}`);

      // Send decline notification email to organizer
      const startDate = new Date(bookingRecord.scheduledStartAt);
      const organizerTimezone = bookingRecord.privateGroupDetails.organizer.timezone || 'America/Chicago';
      const lessonDate = formatDateOnly(startDate, organizerTimezone);
      const lessonTime = formatTimeOnly(startDate, organizerTimezone);

      const emailTemplate = getBookingDeclinedEmailTemplate(
        bookingRecord.privateGroupDetails.organizer.name,
        bookingRecord.coach.name,
        lessonDate,
        lessonTime,
        reason
      );

      await sendEmail({
        to: bookingRecord.privateGroupDetails.organizer.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });

      console.log(`Decline notification sent to organizer: ${bookingRecord.privateGroupDetails.organizer.email}`);
    }

    revalidatePath('/dashboard/coach');

    return { success: true };
  } catch (error) {
    console.error('Decline booking error:', error);
    return { success: false, error: 'Failed to decline booking' };
  }
}

export async function cancelBooking(bookingId: string, reason: string) {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
      with: {
        individualDetails: true,
        privateGroupDetails: true,
        publicGroupDetails: true,
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    // Check authorization based on booking type
    const isCoach = bookingRecord.coachId === session.user.id;
    const isAuthorized = isCoach ||
      (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails?.clientId === session.user.id) ||
      (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails?.organizerId === session.user.id);

    if (!isAuthorized) {
      return { success: false, error: 'Unauthorized' };
    }

    if (
      bookingRecord.approvalStatus !== 'pending_review' &&
      bookingRecord.approvalStatus !== 'accepted'
    ) {
      return { success: false, error: 'Cannot cancel this booking' };
    }

    // Handle payment refund/cancellation based on booking type
    if (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails) {
      const paymentIntentId = bookingRecord.individualDetails.stripePaymentIntentId;
      let newPaymentStatus = bookingRecord.individualDetails.paymentStatus;

      if (paymentIntentId) {
        if (bookingRecord.individualDetails.paymentStatus === 'captured' || bookingRecord.individualDetails.paymentStatus === 'authorized') {
          await refundBookingPayment(paymentIntentId);
          newPaymentStatus = 'refunded';
        } else if (bookingRecord.individualDetails.paymentStatus === 'awaiting_client_payment') {
          await cancelBookingPayment(paymentIntentId);
        }
      }

      await db
        .update(individualBookingDetails)
        .set({
          paymentStatus: newPaymentStatus,
        })
        .where(eq(individualBookingDetails.bookingId, bookingId));

      // Record payment event if refunded
      if (paymentIntentId && newPaymentStatus === 'refunded') {
        await recordPaymentEvent({
          bookingId: bookingRecord.id,
          stripePaymentIntentId: paymentIntentId,
          amountCents: bookingRecord.individualDetails.clientPaysCents,
          status: 'refunded',
        });
      }

    } else if (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails) {
      const paymentIntentId = bookingRecord.privateGroupDetails.stripePaymentIntentId;
      let newPaymentStatus = bookingRecord.privateGroupDetails.paymentStatus;

      if (paymentIntentId) {
        if (bookingRecord.privateGroupDetails.paymentStatus === 'captured' || bookingRecord.privateGroupDetails.paymentStatus === 'authorized') {
          await refundBookingPayment(paymentIntentId);
          newPaymentStatus = 'refunded';
        } else if (bookingRecord.privateGroupDetails.paymentStatus === 'awaiting_client_payment') {
          await cancelBookingPayment(paymentIntentId);
        }
      }

      await db
        .update(privateGroupBookingDetails)
        .set({
          paymentStatus: newPaymentStatus,
        })
        .where(eq(privateGroupBookingDetails.bookingId, bookingId));

      // Update all participant statuses
      await db.update(bookingParticipant)
        .set({
          status: 'cancelled',
          paymentStatus: newPaymentStatus === 'refunded' ? 'refunded' : 'cancelled',
          cancelledAt: new Date(),
        })
        .where(eq(bookingParticipant.bookingId, bookingId));

      // Record payment event if refunded
      if (paymentIntentId && newPaymentStatus === 'refunded') {
        await recordPaymentEvent({
          bookingId: bookingRecord.id,
          stripePaymentIntentId: paymentIntentId,
          amountCents: bookingRecord.privateGroupDetails.totalGrossCents,
          status: 'refunded',
        });
      }

    } else if (bookingRecord.bookingType === 'public_group' && bookingRecord.publicGroupDetails) {
      // For public groups, refund all captured participants
      const capturedParticipants = await db.query.bookingParticipant.findMany({
        where: and(
          eq(bookingParticipant.bookingId, bookingId),
          eq(bookingParticipant.paymentStatus, 'captured')
        ),
      });

      for (const participant of capturedParticipants) {
        if (participant.stripePaymentIntentId) {
          await refundBookingPayment(participant.stripePaymentIntentId);
        }
      }

      // Update all participants
      await db.update(bookingParticipant)
        .set({
          status: 'cancelled',
          paymentStatus: 'refunded',
          cancelledAt: new Date(),
        })
        .where(eq(bookingParticipant.bookingId, bookingId));

      // Update public group details
      await db.update(publicGroupLessonDetails)
        .set({
          capacityStatus: 'closed',
          currentParticipants: 0,
          authorizedParticipants: 0,
          capturedParticipants: 0,
        })
        .where(eq(publicGroupLessonDetails.bookingId, bookingId));
    }

    // Update booking status
    await db
      .update(booking)
      .set({
        approvalStatus: 'cancelled',
        cancelledBy: session.user.id,
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    // Record state transitions
    await recordStateTransition({
      bookingId: bookingRecord.id,
      field: 'approvalStatus',
      oldStatus: bookingRecord.approvalStatus,
      newStatus: 'cancelled',
      changedBy: session.user.id,
      reason,
    });

    console.log(`Booking cancelled: ${bookingId}`);

    revalidatePath('/dashboard/coach');
    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Cancel booking error:', error);
    return { success: false, error: 'Failed to cancel booking' };
  }
}

export async function markBookingComplete(bookingId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.coachId, session.user.id),
        eq(booking.approvalStatus, 'accepted')
      ),
      with: {
        coach: {
          columns: {
            name: true,
          },
        },
        individualDetails: {
          with: {
            client: {
              columns: {
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

    let newFulfillmentStatus: 'scheduled' | 'completed' = 'scheduled';
    let shouldSendEmail = false;
    let emailRecipient: { email: string; name: string; timezone: string } | null = null;

    // Handle different booking types
    if (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails) {
      // Individual: Check if client already confirmed
      newFulfillmentStatus = bookingRecord.individualDetails.clientConfirmedAt ? 'completed' : 'scheduled';
      if (!bookingRecord.individualDetails.clientConfirmedAt) {
        shouldSendEmail = true;
        emailRecipient = {
          email: bookingRecord.individualDetails.client.email,
          name: bookingRecord.individualDetails.client.name,
          timezone: bookingRecord.individualDetails.client.timezone || 'America/Chicago',
        };
      }
    } else if (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails) {
      // Private group: Check if organizer already confirmed
      newFulfillmentStatus = bookingRecord.privateGroupDetails.organizerConfirmedAt ? 'completed' : 'scheduled';
      if (!bookingRecord.privateGroupDetails.organizerConfirmedAt) {
        shouldSendEmail = true;
        emailRecipient = {
          email: bookingRecord.privateGroupDetails.organizer.email,
          name: bookingRecord.privateGroupDetails.organizer.name,
          timezone: bookingRecord.privateGroupDetails.organizer.timezone || 'America/Chicago',
        };
      }
    } else if (bookingRecord.bookingType === 'public_group') {
      // Public group: Coach can mark complete directly
      newFulfillmentStatus = 'completed';
    } else {
      return { success: false, error: 'Invalid booking type' };
    }

    await db
      .update(booking)
      .set({
        coachConfirmedAt: new Date(),
        fulfillmentStatus: newFulfillmentStatus,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    if (newFulfillmentStatus === 'completed') {
      await incrementCoachLessonsCompleted(bookingRecord.coachId);
      // Transfer funds if both parties confirmed (or coach-only for public groups)
      await processCoachPayoutSafely(bookingId);
    }

    // Send confirmation email if needed
    if (shouldSendEmail && emailRecipient) {
      const startDate = new Date(bookingRecord.scheduledStartAt);
      
      await sendEmail({
        to: emailRecipient.email,
        subject: `Please confirm lesson completion with ${bookingRecord.coach.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B4A;">Lesson Completion Confirmation</h2>
            <p>Hi ${emailRecipient.name},</p>
            <p>${bookingRecord.coach.name} has marked your lesson on <strong>${formatDateOnly(startDate, emailRecipient.timezone)}</strong> as complete.</p>
            <p>Please confirm that the lesson was completed successfully:</p>
            <p style="margin: 30px 0; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_URL}/dashboard/bookings"
                 style="background: linear-gradient(to right, #FF6B4A, #FF8C5A); color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Confirm Completion
              </a>
            </p>
            <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px;">
              <strong>Note:</strong> If we don't hear from you within 7 days, we'll automatically confirm the lesson and release payment to the coach. If there was an issue with the lesson, please contact support immediately.
            </p>
          </div>
        `,
        text: `Hi ${emailRecipient.name}, ${bookingRecord.coach.name} has marked your lesson on ${formatDateOnly(startDate, emailRecipient.timezone)} as complete. Please log in to confirm at ${process.env.NEXT_PUBLIC_URL}/dashboard/bookings or contact support if there was an issue.`,
      });

      console.log(`Completion confirmation email sent to: ${emailRecipient.email}`);
    }

    console.log(`Booking marked complete by coach: ${bookingId}`);

    revalidatePath('/dashboard/coach');
    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Mark complete error:', error);
    return { success: false, error: 'Failed to mark booking complete' };
  }
}

export async function acceptPrivateGroupBooking(bookingId: string) {
  try {
    const validatedBookingId = validateInput(uuidSchema, bookingId);

    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, validatedBookingId),
        eq(booking.coachId, session.user.id),
        eq(booking.approvalStatus, 'pending_review'),
        eq(booking.bookingType, 'private_group')
      ),
      with: {
        coach: {
          columns: {
            name: true,
          },
        },
        privateGroupDetails: {
          with: {
            organizer: {
              columns: {
                name: true,
                email: true,
                timezone: true,
              },
            },
          },
        },
      },
    });

    if (!bookingRecord || !bookingRecord.privateGroupDetails) {
      return { success: false, error: 'Booking not found' };
    }

    const paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update booking status
    await db
      .update(booking)
      .set({
        approvalStatus: 'accepted',
        coachRespondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, validatedBookingId));

    // Update private group details payment status
    await db
      .update(privateGroupBookingDetails)
      .set({
        paymentStatus: 'awaiting_client_payment',
        paymentDueAt,
      })
      .where(eq(privateGroupBookingDetails.bookingId, validatedBookingId));

    // Record state transitions
    await recordMultipleTransitions(
      bookingRecord.id,
      [
        { field: 'approvalStatus', oldStatus: 'pending_review', newStatus: 'accepted' },
        { field: 'paymentStatus', oldStatus: 'not_required', newStatus: 'awaiting_client_payment' },
      ],
      session.user.id
    );

    console.log(`Private group booking accepted: ${validatedBookingId}`);

    const startDate = new Date(bookingRecord.scheduledStartAt);
    const organizerTimezone = bookingRecord.privateGroupDetails.organizer.timezone || 'America/Chicago';

    const lessonDate = formatDateOnly(startDate, organizerTimezone);
    const lessonTime = formatTimeOnly(startDate, organizerTimezone);
    const paymentDeadline = formatDateWithTimezone(paymentDueAt, organizerTimezone);

    const emailTemplate = getBookingAcceptedEmailTemplate(
      bookingRecord.privateGroupDetails.organizer.name,
      bookingRecord.coach.name,
      lessonDate,
      lessonTime,
      bookingRecord.location ? `${bookingRecord.location.name}, ${bookingRecord.location.address}` : 'Location to be confirmed',
      bookingRecord.privateGroupDetails.totalGrossCents,
      paymentDeadline
    );

    await sendEmail({
      to: bookingRecord.privateGroupDetails.organizer.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`Payment request email sent to organizer: ${bookingRecord.privateGroupDetails.organizer.email}`);

    revalidatePath('/dashboard/coach');

    return { success: true };
  } catch (error) {
    console.error('Accept private group booking error:', error);
    return { success: false, error: 'Failed to accept booking' };
  }
}

export async function confirmBookingComplete(bookingId: string) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, bookingId),
        eq(booking.approvalStatus, 'accepted'),
        or(
          // Individual booking
          and(
            eq(booking.bookingType, 'individual')
          ),
          // Private group
          and(
            eq(booking.bookingType, 'private_group')
          )
        )
      ),
      with: {
        individualDetails: true,
        privateGroupDetails: true,
      },
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found' };
    }

    // Verify user has permission to confirm
    const isAuthorized = 
      (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails?.clientId === session.user.id) ||
      (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails?.organizerId === session.user.id);

    if (!isAuthorized) {
      return { success: false, error: 'Unauthorized' };
    }

    // Public groups don't require client confirmation (coach-only)
    if (bookingRecord.bookingType === 'public_group') {
      return { success: false, error: 'Public group bookings do not require client confirmation' };
    }

    const newFulfillmentStatus = bookingRecord.coachConfirmedAt ? 'completed' : 'scheduled';

    await db
      .update(booking)
      .set({
        fulfillmentStatus: newFulfillmentStatus,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId));

    // Set confirmation timestamp in appropriate detail table
    if (bookingRecord.bookingType === 'individual' && bookingRecord.individualDetails) {
      await db
        .update(individualBookingDetails)
        .set({
          clientConfirmedAt: new Date(),
        })
        .where(eq(individualBookingDetails.bookingId, bookingId));
    } else if (bookingRecord.bookingType === 'private_group' && bookingRecord.privateGroupDetails) {
      await db
        .update(privateGroupBookingDetails)
        .set({
          organizerConfirmedAt: new Date(),
        })
        .where(eq(privateGroupBookingDetails.bookingId, bookingId));
    }

    if (newFulfillmentStatus === 'completed') {
      await processCoachPayoutSafely(bookingId);
    }

    console.log(`Booking confirmed by ${bookingRecord.bookingType === 'individual' ? 'client' : 'organizer'}: ${bookingId}`);

    revalidatePath('/dashboard/coach');
    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('Confirm complete error:', error);
    return { success: false, error: 'Failed to confirm booking' };
  }
}
