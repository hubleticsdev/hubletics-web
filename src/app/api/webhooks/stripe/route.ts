import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { coachProfile, coachPayout, idempotencyKey, booking, bookingParticipant, individualBookingDetails, privateGroupBookingDetails, publicGroupLessonDetails } from '@/lib/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { stripeWebhookSchema, safeValidateInput } from '@/lib/validations';
import { revalidatePath } from 'next/cache';
import { recordPaymentEvent } from '@/lib/payment-audit';
import { recordStateTransition } from '@/lib/booking-audit';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const validation = safeValidateInput(stripeWebhookSchema, event);
  if (!validation.success) {
    console.error('Invalid webhook structure:', validation.error);
    return NextResponse.json(
      { error: 'Invalid webhook structure' },
      { status: 400 }
    );
  }

  console.log(`Stripe webhook received: ${event.type}`);

  const existingKey = await db.query.idempotencyKey.findFirst({
    where: and(
      eq(idempotencyKey.key, event.id),
      gt(idempotencyKey.expiresAt, new Date())
    ),
  });

  if (existingKey) {
    console.log(`Webhook ${event.id} already processed, skipping`);
    return NextResponse.json({ received: true, status: 'already_processed' });
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        console.log(`Account updated: ${account.id}`);

        const isOnboarded = account.charges_enabled && account.payouts_enabled;

        if (isOnboarded) {
          console.log(`Account ${account.id} is now fully onboarded`);

          await db
            .update(coachProfile)
            .set({
              stripeOnboardingComplete: true,
              updatedAt: new Date(),
            })
            .where(eq(coachProfile.stripeAccountId, account.id));

          console.log(`Updated coach profile for Stripe account ${account.id}`);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment intent succeeded: ${paymentIntent.id}`);

        // Find booking by payment intent ID in detail tables
        const individualDetail = await db.query.individualBookingDetails.findFirst({
          where: eq(individualBookingDetails.stripePaymentIntentId, paymentIntent.id),
          with: {
            booking: true,
          },
        });

        const privateGroupDetail = !individualDetail ? await db.query.privateGroupBookingDetails.findFirst({
          where: eq(privateGroupBookingDetails.stripePaymentIntentId, paymentIntent.id),
          with: {
            booking: true,
          },
        }) : null;

        const bookingRecord = individualDetail?.booking || privateGroupDetail?.booking;
        const detailRecord = individualDetail || privateGroupDetail;

        if (bookingRecord && detailRecord) {
          const oldPaymentStatus = individualDetail
            ? individualDetail.paymentStatus
            : privateGroupDetail
              ? privateGroupDetail.paymentStatus
              : 'not_required';

          // Update payment status in detail table
          if (individualDetail) {
            await db
              .update(individualBookingDetails)
              .set({
                paymentStatus: 'captured',
              })
              .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
          } else if (privateGroupDetail) {
            await db
              .update(privateGroupBookingDetails)
              .set({
                paymentStatus: 'captured',
              })
              .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
          }

          // Get amount from detail record
          const amountCents = individualDetail
            ? individualDetail.clientPaysCents
            : privateGroupDetail?.totalGrossCents ?? 0;

          await recordPaymentEvent({
            bookingId: bookingRecord.id,
            stripePaymentIntentId: paymentIntent.id,
            amountCents,
            status: 'captured',
          });

          await recordStateTransition({
            bookingId: bookingRecord.id,
            field: 'paymentStatus',
            oldStatus: oldPaymentStatus,
            newStatus: 'captured',
          });

          console.log(`Payment confirmed for booking: ${bookingRecord.id}`);
        } else {
          const participantRecord = await db.query.bookingParticipant.findFirst({
            where: eq(bookingParticipant.stripePaymentIntentId, paymentIntent.id),
            with: {
              booking: {
                with: {
                  coach: {
                    columns: { name: true, email: true }
                  }
                }
              }
            }
          });

          if (participantRecord) {
            const oldPaymentStatus = participantRecord.paymentStatus;
            const oldStatus = participantRecord.status;

            await db
              .update(bookingParticipant)
              .set({
                paymentStatus: 'authorized',
                status: 'awaiting_coach',
                authorizedAt: new Date(),
              })
              .where(eq(bookingParticipant.id, participantRecord.id));

            // Update authorized participants count in public group details
            await db
              .update(publicGroupLessonDetails)
              .set({
                authorizedParticipants: sql`${publicGroupLessonDetails.authorizedParticipants} + 1`,
              })
              .where(eq(publicGroupLessonDetails.bookingId, participantRecord.bookingId));

            // Update booking timestamp
            await db
              .update(booking)
              .set({
                updatedAt: new Date(),
              })
              .where(eq(booking.id, participantRecord.bookingId));

            await recordPaymentEvent({
              bookingId: participantRecord.bookingId,
              participantId: participantRecord.id,
              stripePaymentIntentId: paymentIntent.id,
              amountCents: participantRecord.amountCents ?? 0,
              status: 'authorized',
            });

            await recordStateTransition({
              bookingId: participantRecord.bookingId,
              participantId: participantRecord.id,
              field: 'paymentStatus',
              oldStatus: oldPaymentStatus,
              newStatus: 'authorized',
            });

            await recordStateTransition({
              bookingId: participantRecord.bookingId,
              participantId: participantRecord.id,
              field: 'status',
              oldStatus: oldStatus,
              newStatus: 'awaiting_coach',
            });

            console.log(`Payment authorized for participant ${participantRecord.userId} in booking ${participantRecord.bookingId} - waiting for coach approval`);

            revalidatePath('/dashboard/bookings');
            revalidatePath(`/coaches/${participantRecord.booking.coachId}`);
          } else {
            console.warn(`Payment intent ${paymentIntent.id} not found in bookings or participants`);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment intent failed: ${paymentIntent.id}`);

        // Find booking by payment intent ID in detail tables
        const individualDetail = await db.query.individualBookingDetails.findFirst({
          where: eq(individualBookingDetails.stripePaymentIntentId, paymentIntent.id),
          with: {
            booking: true,
          },
        });

        const privateGroupDetail = !individualDetail ? await db.query.privateGroupBookingDetails.findFirst({
          where: eq(privateGroupBookingDetails.stripePaymentIntentId, paymentIntent.id),
          with: {
            booking: true,
          },
        }) : null;

        const bookingRecord = individualDetail?.booking || privateGroupDetail?.booking;

        if (bookingRecord) {
          await db
            .update(booking)
            .set({
              approvalStatus: 'cancelled',
              cancellationReason: 'Payment failed',
              cancelledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(booking.id, bookingRecord.id));

          // Update payment status in detail table
          if (individualDetail) {
            await db
              .update(individualBookingDetails)
              .set({
                paymentStatus: 'failed',
              })
              .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
          } else if (privateGroupDetail) {
            await db
              .update(privateGroupBookingDetails)
              .set({
                paymentStatus: 'failed',
              })
              .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
          }

          console.log(`Booking cancelled due to payment failure: ${bookingRecord.id}`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`Charge refunded: ${charge.id}, amount: $${charge.amount_refunded / 100}`);

        // Find booking by payment intent ID in detail tables
        const individualDetail = await db.query.individualBookingDetails.findFirst({
          where: eq(individualBookingDetails.stripePaymentIntentId, charge.payment_intent as string),
          with: {
            booking: true,
          },
        });

        const privateGroupDetail = !individualDetail ? await db.query.privateGroupBookingDetails.findFirst({
          where: eq(privateGroupBookingDetails.stripePaymentIntentId, charge.payment_intent as string),
          with: {
            booking: true,
          },
        }) : null;

        const bookingRecord = individualDetail?.booking || privateGroupDetail?.booking;

        if (bookingRecord) {
          // Update payment status in detail table
          if (individualDetail) {
            await db
              .update(individualBookingDetails)
              .set({
                paymentStatus: 'refunded',
              })
              .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
          } else if (privateGroupDetail) {
            await db
              .update(privateGroupBookingDetails)
              .set({
                paymentStatus: 'refunded',
              })
              .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
          }

          console.log(`Refund recorded for booking: ${bookingRecord.id}`);
        }
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        console.log(`Transfer created: ${transfer.id}, amount: $${transfer.amount / 100}`);

        // Find booking by payment intent ID in detail tables
        const individualDetail = await db.query.individualBookingDetails.findFirst({
          where: eq(individualBookingDetails.stripePaymentIntentId, transfer.source_transaction as string),
          with: {
            booking: {
              with: {
                coach: {
                  with: {
                    coachProfile: {
                      columns: {
                        stripeAccountId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const privateGroupDetail = !individualDetail ? await db.query.privateGroupBookingDetails.findFirst({
          where: eq(privateGroupBookingDetails.stripePaymentIntentId, transfer.source_transaction as string),
          with: {
            booking: {
              with: {
                coach: {
                  with: {
                    coachProfile: {
                      columns: {
                        stripeAccountId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }) : null;

        const bookingRecord = individualDetail?.booking || privateGroupDetail?.booking;

        if (bookingRecord && bookingRecord.fulfillmentStatus === 'completed' && bookingRecord.coach?.coachProfile?.stripeAccountId === transfer.destination) {
          // Update transfer ID in detail table
          if (individualDetail) {
            await db
              .update(individualBookingDetails)
              .set({
                stripeTransferId: transfer.id,
              })
              .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
          } else if (privateGroupDetail) {
            await db
              .update(privateGroupBookingDetails)
              .set({
                stripeTransferId: transfer.id,
              })
              .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
          }

          console.log(`Transfer recorded for booking: ${bookingRecord.id}`);
        }
        break;
      }

      case 'transfer.reversed': {
        const transfer = event.data.object as Stripe.Transfer;
        console.log(`Transfer reversed: ${transfer.id}, amount: $${transfer.amount_reversed / 100}`);

        // Find booking by transfer ID in detail tables
        const individualDetail = await db.query.individualBookingDetails.findFirst({
          where: eq(individualBookingDetails.stripeTransferId, transfer.id),
          with: {
            booking: true,
          },
        });

        const privateGroupDetail = !individualDetail ? await db.query.privateGroupBookingDetails.findFirst({
          where: eq(privateGroupBookingDetails.stripeTransferId, transfer.id),
          with: {
            booking: true,
          },
        }) : null;

        const bookingRecord = individualDetail?.booking || privateGroupDetail?.booking;

        if (bookingRecord) {
          await db
            .update(booking)
            .set({
              approvalStatus: 'cancelled',
              fulfillmentStatus: 'disputed',
              cancellationReason: 'Transfer reversed - refund processed',
              updatedAt: new Date(),
            })
            .where(eq(booking.id, bookingRecord.id));

          // Update payment status in detail table
          if (individualDetail) {
            await db
              .update(individualBookingDetails)
              .set({
                paymentStatus: 'refunded',
              })
              .where(eq(individualBookingDetails.bookingId, bookingRecord.id));
          } else if (privateGroupDetail) {
            await db
              .update(privateGroupBookingDetails)
              .set({
                paymentStatus: 'refunded',
              })
              .where(eq(privateGroupBookingDetails.bookingId, bookingRecord.id));
          }

          console.log(`Transfer reversal recorded for booking: ${bookingRecord.id}`);
        }
        break;
      }

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        console.log(`Payout paid: ${payout.id}, amount: $${payout.amount / 100}`);

        // Find coach by Stripe account ID
        const coachByAccount = await db.query.coachProfile.findFirst({
          where: eq(coachProfile.stripeAccountId, payout.destination as string),
          columns: {
            userId: true,
          },
        });

        if (coachByAccount) {
          await db
            .insert(coachPayout)
            .values({
              coachId: coachByAccount.userId,
              stripePayoutId: payout.id,
              stripeAccountId: payout.destination as string,
              amountCents: payout.amount,
              currency: payout.currency,
              status: 'paid',
              arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
            })
            .onConflictDoUpdate({
              target: coachPayout.stripePayoutId,
              set: {
                status: 'paid',
                updatedAt: new Date(),
              },
            });

          console.log(`Payout ${payout.id} recorded for coach ${coachByAccount.userId}`);
          revalidatePath('/dashboard/coach');
        } else {
          console.warn(`No coach found for Stripe account ${payout.destination}`);
        }
        break;
      }

      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        console.log(`Payout failed: ${payout.id}, reason: ${payout.failure_message}`);

        // Find coach by Stripe account ID
        const coachByAccountFailed = await db.query.coachProfile.findFirst({
          where: eq(coachProfile.stripeAccountId, payout.destination as string),
          columns: {
            userId: true,
          },
        });

        if (coachByAccountFailed) {
          await db
            .insert(coachPayout)
            .values({
              coachId: coachByAccountFailed.userId,
              stripePayoutId: payout.id,
              stripeAccountId: payout.destination as string,
              amountCents: payout.amount,
              currency: payout.currency,
              status: 'failed',
              failedReason: payout.failure_message || 'Unknown failure',
              arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
            })
            .onConflictDoUpdate({
              target: coachPayout.stripePayoutId,
              set: {
                status: 'failed',
                failedReason: payout.failure_message || 'Unknown failure',
                updatedAt: new Date(),
              },
            });

          console.log(`Failed payout ${payout.id} recorded for coach ${coachByAccountFailed.userId}`);
          revalidatePath('/dashboard/coach');
        } else {
          console.warn(`No coach found for Stripe account ${payout.destination}`);
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(`Dispute created: ${dispute.id}, amount: $${dispute.amount / 100}, reason: ${dispute.reason}`);

        // Find booking by payment intent ID
        const individualDetail = await db.query.individualBookingDetails.findFirst({
          where: eq(individualBookingDetails.stripePaymentIntentId, dispute.payment_intent as string),
          with: {
            booking: {
              with: {
                coach: {
                  columns: { name: true, email: true },
                },
              },
            },
            client: {
              columns: { name: true, email: true },
            },
          },
        });

        const privateGroupDetail = !individualDetail ? await db.query.privateGroupBookingDetails.findFirst({
          where: eq(privateGroupBookingDetails.stripePaymentIntentId, dispute.payment_intent as string),
          with: {
            booking: {
              with: {
                coach: {
                  columns: { name: true, email: true },
                },
              },
            },
            organizer: {
              columns: { name: true, email: true },
            },
          },
        }) : null;

        const bookingRecord = individualDetail?.booking || privateGroupDetail?.booking;

        if (bookingRecord) {
          // Flag booking as disputed
          await db
            .update(booking)
            .set({
              fulfillmentStatus: 'disputed',
              updatedAt: new Date(),
            })
            .where(eq(booking.id, bookingRecord.id));

          // Record the dispute event
          await recordPaymentEvent({
            bookingId: bookingRecord.id,
            stripePaymentIntentId: dispute.payment_intent as string,
            amountCents: dispute.amount,
            status: 'disputed',
          });

          await recordStateTransition({
            bookingId: bookingRecord.id,
            field: 'fulfillmentStatus',
            oldStatus: bookingRecord.fulfillmentStatus,
            newStatus: 'disputed',
          });

          console.log(`[DISPUTE] Booking ${bookingRecord.id} flagged as disputed. Reason: ${dispute.reason}. Amount: $${dispute.amount / 100}`);
          console.log(`[DISPUTE] Coach: ${bookingRecord.coach?.name}, Client: ${individualDetail?.client?.name || privateGroupDetail?.organizer?.name}`);

          revalidatePath('/admin/disputes');
          revalidatePath('/dashboard/coach');
        } else {
          // Check participants for public group disputes
          const participantRecord = await db.query.bookingParticipant.findFirst({
            where: eq(bookingParticipant.stripePaymentIntentId, dispute.payment_intent as string),
          });

          if (participantRecord) {
            await db
              .update(bookingParticipant)
              .set({
                paymentStatus: 'disputed',
              })
              .where(eq(bookingParticipant.id, participantRecord.id));

            console.log(`[DISPUTE] Participant ${participantRecord.id} payment disputed. Reason: ${dispute.reason}`);
          } else {
            console.warn(`[DISPUTE] No booking or participant found for dispute ${dispute.id}`);
          }
        }

        // Send admin notification email for new disputes
        try {
          const { resend } = await import('@/lib/email/resend');
          await resend.emails.send({
            from: 'Hubletics <noreply@hubletics.com>',
            to: 'hubleticsdev@gmail.com',
            subject: `⚠️ URGENT: Stripe Chargeback - $${dispute.amount / 100}`,
            html: `
              <h2 style="color: #dc2626;">Stripe Chargeback Alert</h2>
              <p><strong>A customer has disputed a charge with their bank. Immediate action required.</strong></p>
              <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Dispute ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${dispute.id}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${(dispute.amount / 100).toFixed(2)}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${dispute.reason}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Payment Intent:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${dispute.payment_intent}</td></tr>
              </table>
              <p style="margin-top: 16px;"><a href="https://dashboard.stripe.com/disputes/${dispute.id}" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View in Stripe Dashboard</a></p>
              <p style="margin-top: 16px;"><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/disputes">View in Admin Panel</a></p>
            `,
            text: `URGENT: Stripe Chargeback - $${(dispute.amount / 100).toFixed(2)}. Reason: ${dispute.reason}. View at https://dashboard.stripe.com/disputes/${dispute.id}`,
          });
          console.log(`[DISPUTE] Admin notification email sent for dispute ${dispute.id}`);
        } catch (emailError) {
          console.error(`[DISPUTE] Failed to send admin email:`, emailError);
        }
        break;
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(`Dispute closed: ${dispute.id}, status: ${dispute.status}`);

        // Find booking by payment intent ID
        const individualDetailClosed = await db.query.individualBookingDetails.findFirst({
          where: eq(individualBookingDetails.stripePaymentIntentId, dispute.payment_intent as string),
        });

        const privateGroupDetailClosed = !individualDetailClosed ? await db.query.privateGroupBookingDetails.findFirst({
          where: eq(privateGroupBookingDetails.stripePaymentIntentId, dispute.payment_intent as string),
        }) : null;

        const closedBookingId = individualDetailClosed?.bookingId || privateGroupDetailClosed?.bookingId;

        if (closedBookingId) {
          // Update booking status based on dispute outcome
          const newStatus = dispute.status === 'won' ? 'completed' : 'disputed';
          await db
            .update(booking)
            .set({
              fulfillmentStatus: newStatus,
              cancellationReason: `Stripe dispute ${dispute.status}: ${dispute.reason}`,
              updatedAt: new Date(),
            })
            .where(eq(booking.id, closedBookingId));

          await recordStateTransition({
            bookingId: closedBookingId,
            field: 'fulfillmentStatus',
            oldStatus: 'disputed',
            newStatus: newStatus,
          });

          console.log(`[DISPUTE] Booking ${closedBookingId} updated after dispute ${dispute.status}`);
          revalidatePath('/admin/disputes');
        }

        // Send admin notification about dispute resolution
        try {
          const { resend } = await import('@/lib/email/resend');
          const outcomeEmoji = dispute.status === 'won' ? '✅' : dispute.status === 'lost' ? '❌' : '⚠️';
          await resend.emails.send({
            from: 'Hubletics <noreply@hubletics.com>',
            to: 'hubleticsdev@gmail.com',
            subject: `${outcomeEmoji} Dispute ${dispute.status.toUpperCase()} - $${dispute.amount / 100}`,
            html: `
              <h2>Dispute Resolution: ${dispute.status.toUpperCase()}</h2>
              <p>The dispute for <strong>$${(dispute.amount / 100).toFixed(2)}</strong> has been ${dispute.status}.</p>
              <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Dispute ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${dispute.id}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Outcome:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${dispute.status}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${(dispute.amount / 100).toFixed(2)}</td></tr>
              </table>
              ${dispute.status === 'won' ? '<p style="color: green;">Funds have been returned to your account.</p>' : ''}
              ${dispute.status === 'lost' ? '<p style="color: red;">The disputed amount will remain with the customer.</p>' : ''}
            `,
            text: `Dispute ${dispute.status} - $${(dispute.amount / 100).toFixed(2)}`,
          });
          console.log(`[DISPUTE] Admin notification sent for dispute closure ${dispute.id}`);
        } catch (emailError) {
          console.error(`[DISPUTE] Failed to send closure email:`, emailError);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db
      .insert(idempotencyKey)
      .values({
        key: event.id,
        result: { processed: true, eventType: event.type },
        expiresAt,
      })
      .onConflictDoNothing();

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
