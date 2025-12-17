import { booking } from '@/lib/db/schema';
import type { BookingWithDetails } from './booking-type-guards';

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
  fulfillmentStatus: typeof booking.$inferSelect.fulfillmentStatus;
  paymentStatus?: string | null;
  capacityStatus?: string | null;
};

/**
 * Derive UI status from booking status fields
 * Payment status comes from detail tables (individual/private) or is null (public groups)
 * Capacity status only exists for public groups
 */
export function deriveUiBookingStatus(source: BookingStatusSource): UiBookingStatus {
  // Check fulfillment status first (highest priority)
  if (source.fulfillmentStatus === 'disputed') return 'disputed';
  if (source.fulfillmentStatus === 'completed') return 'completed';
  
  // Check approval status
  if (source.approvalStatus === 'declined') return 'declined';
  if (source.approvalStatus === 'cancelled') return 'cancelled';
  if (source.approvalStatus === 'expired') return 'expired';
  
  // Check capacity status (public groups only)
  if (source.capacityStatus === 'open') return 'open';
  
  // Check if awaiting coach review
  if (source.approvalStatus === 'pending_review') return 'awaiting_coach';
  
  // Check if awaiting payment (individual/private groups only)
  if (source.paymentStatus === 'awaiting_client_payment') return 'awaiting_payment';
  
  // Default: confirmed (accepted and payment captured/not required)
  return 'confirmed';
}

// Derive UI status from a booking with details loaded
export function deriveUiBookingStatusFromBooking(booking: BookingWithDetails): UiBookingStatus {
  const paymentStatus = booking.bookingType === 'individual' 
    ? booking.individualDetails?.paymentStatus ?? null
    : booking.bookingType === 'private_group'
    ? booking.privateGroupDetails?.paymentStatus ?? null
    : null; // Public groups don't have payment status at booking level
  
  const capacityStatus = booking.bookingType === 'public_group'
    ? booking.publicGroupDetails?.capacityStatus ?? null
    : null;
  
  return deriveUiBookingStatus({
    approvalStatus: booking.approvalStatus,
    fulfillmentStatus: booking.fulfillmentStatus,
    paymentStatus,
    capacityStatus,
  });
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
