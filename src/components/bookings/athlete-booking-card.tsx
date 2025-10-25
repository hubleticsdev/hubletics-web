'use client';

import { useState } from 'react';
import { cancelBooking, confirmBookingComplete } from '@/actions/bookings/manage';
import Image from 'next/image';

interface AthleteBookingCardProps {
  booking: {
    id: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    duration: number;
    location: {
      name: string;
      address: string;
      notes?: string;
    };
    clientPaid: string;
    status: string;
    markedCompleteByCoach: boolean;
    confirmedByClient: boolean;
    coach: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
  };
  onUpdate?: () => void;
}

export function AthleteBookingCard({ booking, onUpdate }: AthleteBookingCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = new Date(booking.scheduledStartAt);
  const endDate = new Date(booking.scheduledEndAt);
  const isPast = startDate < new Date();

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
      case 'pending':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">Pending Coach Response</span>;
      case 'accepted':
        return <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">Confirmed</span>;
      case 'declined':
        return <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">Declined</span>;
      case 'cancelled':
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">Cancelled</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">Completed</span>;
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
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {booking.coach.image ? (
              <Image src={booking.coach.image} alt={booking.coach.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
                {booking.coach.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{booking.coach.name}</div>
            <div className="text-sm text-gray-600">{booking.coach.email}</div>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Booking Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[#FF6B4A] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <div>
            <div className="font-medium text-gray-900">
              {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="text-sm text-gray-600">
              {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} -{' '}
              {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ({booking.duration} min)
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[#FF6B4A] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg className="w-5 h-5 text-[#FF6B4A] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-lg font-bold text-[#FF6B4A]">${parseFloat(booking.clientPaid).toFixed(2)}</span>
        </div>
      </div>

      {/* Actions */}
      {booking.status === 'accepted' && booking.markedCompleteByCoach && !booking.confirmedByClient && (
        <div className="pt-4 border-t border-gray-200">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
            <p className="text-sm text-blue-800">
              Your coach has marked this session as complete. Please confirm to finalize.
            </p>
          </div>
          <button
            onClick={handleConfirmComplete}
            disabled={isProcessing}
            className="w-full px-4 py-2 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Confirm Session Complete'}
          </button>
        </div>
      )}

      {booking.status === 'pending' && !showCancelForm && (
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

      {booking.status === 'accepted' && !isPast && !showCancelForm && (
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
    </div>
  );
}

