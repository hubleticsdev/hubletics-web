import { db } from '@/lib/db';
import { bookingPayment } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type PaymentEventStatus =
  | 'created'
  | 'requires_payment_method'
  | 'requires_capture'
  | 'authorized'
  | 'captured'
  | 'cancelled'
  | 'refunded'
  | 'failed';

interface RecordPaymentEventParams {
  bookingId: string;
  participantId?: string;
  stripePaymentIntentId: string;
  amountCents: number;
  status: PaymentEventStatus;
  captureMethod?: 'manual' | 'automatic';
  idempotencyKey?: string;
}

/**
 * Records a payment event to the booking_payment audit table.
 */
export async function recordPaymentEvent(params: RecordPaymentEventParams): Promise<void> {
  const {
    bookingId,
    participantId,
    stripePaymentIntentId,
    amountCents,
    status,
    captureMethod = 'manual',
    idempotencyKey,
  } = params;

  try {
    const existingRecord = await db.query.bookingPayment.findFirst({
      where: eq(bookingPayment.stripePaymentIntentId, stripePaymentIntentId),
    });

    if (existingRecord) {
      await db
        .update(bookingPayment)
        .set({
          status,
          lastEventAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookingPayment.stripePaymentIntentId, stripePaymentIntentId));

      console.log(`[PAYMENT_AUDIT] Updated payment ${stripePaymentIntentId} status to ${status}`);
    } else {
      await db.insert(bookingPayment).values({
        bookingId,
        participantId: participantId ?? null,
        stripePaymentIntentId,
        amountCents,
        currency: 'usd',
        captureMethod,
        status,
        lastEventAt: new Date(),
        idempotencyKey: idempotencyKey ?? null,
      });

      console.log(`[PAYMENT_AUDIT] Created payment record for ${stripePaymentIntentId} with status ${status}`);
    }
  } catch (error) {
    console.error(`[PAYMENT_AUDIT] Failed to record payment event:`, error);
  }
}
