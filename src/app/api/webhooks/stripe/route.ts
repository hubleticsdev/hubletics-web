import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { coachProfile, idempotencyKey, booking, bookingParticipant, individualBookingDetails, privateGroupBookingDetails, publicGroupLessonDetails } from '@/lib/db/schema';
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
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
