import { booking } from '@/lib/db/schema';

export type UiBookingStatus =
  | 'awaiting_coach'
  | 'awaiting_payment'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'disputed'
  | 'expired'
  | 'open';

type BookingStatusSource = {
  approvalStatus: typeof booking.$inferSelect.approvalStatus;
  paymentStatus: typeof booking.$inferSelect.paymentStatus;
  fulfillmentStatus: typeof booking.$inferSelect.fulfillmentStatus;
  capacityStatus?: typeof booking.$inferSelect.capacityStatus | null;
};

export function deriveUiBookingStatus(source: BookingStatusSource): UiBookingStatus {
  if (source.fulfillmentStatus === 'disputed') return 'disputed';
  if (source.fulfillmentStatus === 'completed') return 'completed';
  if (source.approvalStatus === 'declined') return 'declined';
  if (source.approvalStatus === 'cancelled') return 'cancelled';
  if (source.approvalStatus === 'expired') return 'expired';
  if (source.capacityStatus === 'open') return 'open';
  if (source.approvalStatus === 'pending_review') return 'awaiting_coach';
  if (source.paymentStatus === 'awaiting_client_payment') return 'awaiting_payment';
  return 'confirmed';
}

export function formatUiBookingStatus(status: UiBookingStatus): string {
  switch (status) {
    case 'awaiting_coach':
      return 'Awaiting coach review';
    case 'awaiting_payment':
      return 'Payment required';
    case 'confirmed':
      return 'Confirmed';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'declined':
      return 'Declined';
    case 'disputed':
      return 'Disputed';
    case 'expired':
      return 'Expired';
    case 'open':
      return 'Open';
    default:
      return status;
  }
}
