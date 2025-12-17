'use client';

import { useState } from 'react';
import { cancelBooking, confirmBookingComplete } from '@/actions/bookings/manage';
import Image from 'next/image';
import Link from 'next/link';
import type { UiBookingStatus } from '@/lib/booking-status';
import { formatDateOnly, formatTimeOnly, formatDateWithTimezone } from '@/lib/utils/date';
import { PaymentModal } from './payment-modal';
import { coachPaths } from '@/lib/paths';

interface AthleteBookingCardProps {
  booking: {
    id: string;
    bookingType: 'individual' | 'private_group' | 'public_group';
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    duration: number;
    location: {
      name: string;
      address: string;
      notes?: string;
    };
    status: UiBookingStatus;
    coachConfirmedAt?: Date | null;
    coach: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
    individualDetails?: {
      clientPaysCents: number;
      paymentDueAt?: Date | null;
      clientConfirmedAt?: Date | null;
    } | null;
    privateGroupDetails?: {
      totalGrossCents: number;
      paymentDueAt?: Date | null;
      organizerConfirmedAt?: Date | null;
    } | null;
    pendingParticipantsCount?: number;
  };
  timezone?: string;
  onUpdate?: () => void;
}

export function AthleteBookingCard({ booking, timezone = 'America/Chicago', onUpdate }: AthleteBookingCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const startDate = new Date(booking.scheduledStartAt);
  const endDate = new Date(booking.scheduledEndAt);
  const isPast = startDate < new Date();

  // Calculate amount based on booking type
  let amount = '0.00';
  let paymentDueAt: Date | null | undefined = null;

  if (booking.bookingType === 'individual' && booking.individualDetails) {
    amount = (booking.individualDetails.clientPaysCents / 100).toFixed(2);
    paymentDueAt = booking.individualDetails.paymentDueAt;
  } else if (booking.bookingType === 'private_group' && booking.privateGroupDetails) {
    amount = (booking.privateGroupDetails.totalGrossCents / 100).toFixed(2);
    paymentDueAt = booking.privateGroupDetails.paymentDueAt;
  }

  const clientConfirmedAt = booking.bookingType === 'individual'
    ? booking.individualDetails?.clientConfirmedAt
    : booking.bookingType === 'private_group'
    ? booking.privateGroupDetails?.organizerConfirmedAt
    : null;

  const handleConfirmComplete = async () => {
    setIsProcessing(true);
    setError(null);

    const result = await confirmBookingComplete(booking.id);

    setIsProcessing(false);

    if (result.success) {
      onUpdate?.();
    } else {
      setError(result.error || 'Failed to confirm completion');
    }
  };

  const handleCancel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const reason = formData.get('reason') as string;

    const result = await cancelBooking(booking.id, reason);

    setIsProcessing(false);

    if (result.success) {
      onUpdate?.();
    } else {
      setError(result.error || 'Failed to cancel booking');
    }
  };

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'awaiting_coach':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">Pending Coach Response</span>;
      case 'awaiting_payment':
        return <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">Payment Required</span>;
      case 'confirmed':
        return <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">Confirmed</span>;
      case 'declined':
        return <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">Declined</span>;
      case 'cancelled':
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">Cancelled</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">Completed</span>;
      case 'disputed':
        return <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">Disputed</span>;
      case 'expired':
        return <span className="px-3 py-1 bg-gray-200 text-gray-700 text-sm font-medium rounded-full">Expired</span>;
      case 'open':
        return <span className="px-3 py-1 bg-teal-100 text-teal-800 text-sm font-medium rounded-full">Open</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Header with Coach & Status */}
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 shrink-0">
            {booking.coach.image ? (
              <Image src={booking.coach.image} alt={booking.coach.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
                {booking.coach.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <Link 
              href={coachPaths.profile(booking.coach.id)}
              className="font-semibold text-gray-900 hover:text-[#FF6B4A] transition-colors"
            >
              {booking.coach.name}
            </Link>
            <div className="text-sm text-gray-600">{booking.coach.email}</div>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Booking Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[#FF6B4A] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <div>
            <div className="font-medium text-gray-900">
              {formatDateOnly(startDate, timezone)}
            </div>
            <div className="text-sm text-gray-600">
              {formatTimeOnly(startDate, timezone)} -{' '}
              {formatTimeOnly(endDate, timezone)} ({booking.duration} min)
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[#FF6B4A] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <div>
            <div className="font-medium text-gray-900">{booking.location.name}</div>
            <div className="text-sm text-gray-600">{booking.location.address}</div>
            {booking.location.notes && (
              <div className="text-sm text-gray-500 italic mt-1">{booking.location.notes}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <svg className="w-5 h-5 text-[#FF6B4A] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-lg font-bold text-[#FF6B4A]">${amount}</span>
        </div>
      </div>

      {/* Actions */}
      {booking.status === 'confirmed' && booking.coachConfirmedAt && !clientConfirmedAt && (
        <div className="pt-4 border-t border-gray-200">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
            <p className="text-sm text-blue-800">
              Your coach has marked this session as complete. Please confirm to finalize.
            </p>
          </div>
          <button
            onClick={handleConfirmComplete}
            disabled={isProcessing}
            className="w-full px-4 py-2 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Confirm Session Complete'}
          </button>
        </div>
      )}

      {booking.status === 'awaiting_coach' && !showCancelForm && (
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowCancelForm(true)}
            disabled={isProcessing}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel Request
          </button>
        </div>
      )}

      {booking.status === 'awaiting_payment' && paymentDueAt && !isPast && (
        <div className="pt-4 border-t border-gray-200 space-y-3">
          <button
            onClick={() => setPaymentModalOpen(true)}
            disabled={isProcessing}
            className="cursor-pointer w-full px-4 py-2 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            Pay Now
          </button>
          <div className="px-2 py-1 bg-orange-50 rounded text-xs text-orange-700 flex items-center gap-1 justify-center">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Payment due: {formatDateWithTimezone(new Date(paymentDueAt!), timezone)}
          </div>
        </div>
      )}

      {['confirmed', 'awaiting_payment'].includes(booking.status) && !isPast && !showCancelForm && (
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowCancelForm(true)}
            disabled={isProcessing}
            className="w-full px-4 py-2 border border-red-300 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Cancel Booking
          </button>
        </div>
      )}

      {showCancelForm && (
        <form onSubmit={handleCancel} className="pt-4 border-t border-gray-200 space-y-3">
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
            Reason for cancellation:
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            required
            placeholder="Please provide a reason..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowCancelForm(false)}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Keep Booking
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Confirm Cancel'}
            </button>
          </div>
        </form>
      )}

      {booking.bookingType !== 'public_group' && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          bookingId={booking.id}
          coachName={booking.coach.name}
          amount={parseFloat(amount)}
          paymentDueAt={paymentDueAt ? new Date(paymentDueAt) : new Date()}
          bookingType={booking.bookingType === 'private_group' ? 'private_group' : 'individual'}
          onSuccess={() => {
            setPaymentModalOpen(false);
            onUpdate?.();
          }}
        />
      )}
    </div>
  );
}
