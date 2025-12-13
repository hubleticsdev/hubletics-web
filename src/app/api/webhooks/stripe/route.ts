import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { coachProfile, idempotencyKey, booking, bookingParticipant } from '@/lib/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { stripeWebhookSchema, safeValidateInput } from '@/lib/validations';
import { revalidatePath } from 'next/cache';
import { recordPaymentEvent } from '@/lib/payment-audit';
import { recordStateTransition } from '@/lib/booking-audit';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
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
      process.env.STRIPE_WEBHOOK_SECRET
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

        const bookingRecord = await db.query.booking.findFirst({
          where: eq(booking.primaryStripePaymentIntentId, paymentIntent.id),
        });

        if (bookingRecord) {
          const oldPaymentStatus = bookingRecord.paymentStatus;

          await db
            .update(booking)
            .set({
              paymentStatus: 'captured',
              updatedAt: new Date(),
            })
            .where(eq(booking.id, bookingRecord.id));

          await recordPaymentEvent({
            bookingId: bookingRecord.id,
            stripePaymentIntentId: paymentIntent.id,
            amountCents: bookingRecord.expectedGrossCents ?? 0,
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

            await db
              .update(booking)
              .set({
                authorizedParticipants: sql`${booking.authorizedParticipants} + 1`,
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

        const bookingRecord = await db.query.booking.findFirst({
          where: eq(booking.primaryStripePaymentIntentId, paymentIntent.id),
        });

        if (bookingRecord) {
          await db
            .update(booking)
            .set({
              approvalStatus: 'cancelled',
              paymentStatus: 'failed',
              cancellationReason: 'Payment failed',
              cancelledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(booking.id, bookingRecord.id));

          console.log(`Booking cancelled due to payment failure: ${bookingRecord.id}`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`Charge refunded: ${charge.id}, amount: $${charge.amount_refunded / 100}`);

        // might need to store charge IDs for better refund tracking
        const bookingRecord = await db.query.booking.findFirst({
          where: eq(booking.primaryStripePaymentIntentId, charge.payment_intent as string),
        });

        if (bookingRecord) {
          await db
            .update(booking)
            .set({
              paymentStatus: 'refunded',
              updatedAt: new Date(),
            })
            .where(eq(booking.id, bookingRecord.id));

          console.log(`Refund recorded for booking: ${bookingRecord.id}`);
        }
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        console.log(`Transfer created: ${transfer.id}, amount: $${transfer.amount / 100}`);

        const bookingRecord = await db.query.booking.findFirst({
          where: and(
            eq(booking.fulfillmentStatus, 'completed'),
            eq(booking.primaryStripePaymentIntentId, transfer.source_transaction as string)
          ),
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
        });

        if (bookingRecord?.coach?.coachProfile?.stripeAccountId === transfer.destination) {
          await db
            .update(booking)
            .set({
              stripeTransferId: transfer.id,
              updatedAt: new Date(),
            })
            .where(eq(booking.id, bookingRecord.id));

          console.log(`Transfer recorded for booking: ${bookingRecord.id}`);
        }
        break;
      }

      case 'transfer.reversed': {
        const transfer = event.data.object as Stripe.Transfer;
        console.log(`Transfer reversed: ${transfer.id}, amount: $${transfer.amount_reversed / 100}`);

        const bookingRecord = await db.query.booking.findFirst({
          where: eq(booking.stripeTransferId, transfer.id),
        });

        if (bookingRecord) {
          await db
            .update(booking)
            .set({
              approvalStatus: 'cancelled',
              paymentStatus: 'refunded',
              fulfillmentStatus: 'disputed',
              cancellationReason: 'Transfer reversed - refund processed',
              updatedAt: new Date(),
            })
            .where(eq(booking.id, bookingRecord.id));

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
