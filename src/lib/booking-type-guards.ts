import type {
  Booking,
  IndividualBookingDetails,
  PrivateGroupBookingDetails,
  PublicGroupLessonDetails,
} from '@/lib/db/schema';

// Type for a booking with all possible detail tables loaded
export type BookingWithDetails = Booking & {
  individualDetails?: IndividualBookingDetails | null;
  privateGroupDetails?: PrivateGroupBookingDetails | null;
  publicGroupDetails?: PublicGroupLessonDetails | null;
};

// Type guard for individual bookings
export function isIndividualBooking(
  booking: BookingWithDetails
): booking is Booking & { individualDetails: IndividualBookingDetails } {
  return booking.bookingType === 'individual' && !!booking.individualDetails;
}

// Type guard for private group bookings
export function isPrivateGroupBooking(
  booking: BookingWithDetails
): booking is Booking & { privateGroupDetails: PrivateGroupBookingDetails } {
  return booking.bookingType === 'private_group' && !!booking.privateGroupDetails;
}

// Type guard for public group bookings

export function isPublicGroupBooking(
  booking: BookingWithDetails
): booking is Booking & { publicGroupDetails: PublicGroupLessonDetails } {
  return booking.bookingType === 'public_group' && !!booking.publicGroupDetails;
}


// Get the payment status for a booking
export function getBookingPaymentStatus(
  booking: BookingWithDetails
): string | null {
  if (isIndividualBooking(booking)) {
    return booking.individualDetails.paymentStatus;
  }
  if (isPrivateGroupBooking(booking)) {
    return booking.privateGroupDetails.paymentStatus;
  }
  // Public groups don't have a single payment status at booking level
  return null;
}

// Get the capacity status for a booking (only for public groups)

export function getBookingCapacityStatus(
  booking: BookingWithDetails
): string | null {
  if (isPublicGroupBooking(booking)) {
    return booking.publicGroupDetails.capacityStatus;
  }
  return null;
}
