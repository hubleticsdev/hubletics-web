import { db } from '@/lib/db';
import { bookingStateTransition } from '@/lib/db/schema';

export type BookingStatusField = 'approvalStatus' | 'paymentStatus' | 'fulfillmentStatus' | 'capacityStatus';
export type ParticipantStatusField = 'status' | 'paymentStatus';

interface RecordBookingTransitionParams {
  bookingId: string;
  participantId?: string;
  field: BookingStatusField | ParticipantStatusField;
  oldStatus: string;
  newStatus: string;
  changedBy?: string;
  reason?: string;
}

/**
 * Records a state transition to the booking_state_transition audit table.
 */
export async function recordStateTransition(params: RecordBookingTransitionParams): Promise<void> {
  const {
    bookingId,
    participantId,
    field,
    oldStatus,
    newStatus,
    changedBy,
    reason,
  } = params;

  if (oldStatus === newStatus) {
    return;
  }

  try {
    await db.insert(bookingStateTransition).values({
      bookingId,
      participantId: participantId ?? null,
      oldStatus: `${field}:${oldStatus}`,
      newStatus: `${field}:${newStatus}`,
      changedBy: changedBy ?? null,
      reason: reason ?? null,
    });

    console.log(`[STATE_AUDIT] ${bookingId}${participantId ? `/${participantId}` : ''}: ${field} ${oldStatus} -> ${newStatus}`);
  } catch (error) {
    console.error(`[STATE_AUDIT] Failed to record state transition:`, error);
  }
}

/**
 * Helper to record multiple field transitions at once
 */
export async function recordMultipleTransitions(
  bookingId: string,
  transitions: Array<{
    field: BookingStatusField | ParticipantStatusField;
    oldStatus: string;
    newStatus: string;
  }>,
  changedBy?: string,
  reason?: string
): Promise<void> {
  for (const transition of transitions) {
    await recordStateTransition({
      bookingId,
      field: transition.field,
      oldStatus: transition.oldStatus,
      newStatus: transition.newStatus,
      changedBy,
      reason,
    });
  }
}
