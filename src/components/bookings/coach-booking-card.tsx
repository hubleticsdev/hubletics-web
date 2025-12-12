'use client';

import { useState } from 'react';
import { acceptBooking, declineBooking } from '@/actions/bookings/manage';
import Image from 'next/image';

interface BookingCardProps {
  booking: {
    id: string;
    scheduledStartAt: Date;
    scheduledEndAt?: Date;
    duration?: number;
    location?: {
      name: string;
      address: string;
      notes?: string;
    };
    clientMessage?: string | null;
    clientPaid?: string;
    coachPayout?: string;
    stripeFee?: string;
    platformFee?: string;
    status?: string;
    client: {
      id?: string;
      name: string;
      email?: string;
      image?: string | null;
    };
  };
  onUpdate?: () => void;
}

export function CoachBookingCard({ booking, onUpdate }: BookingCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = new Date(booking.scheduledStartAt);
  const endDate = booking.scheduledEndAt ? new Date(booking.scheduledEndAt) : null;

  const handleAccept = async () => {
    setIsProcessing(true);
    setError(null);

    const result = await acceptBooking(booking.id);

    setIsProcessing(false);

    if (result.success) {
      onUpdate?.();
    } else {
      setError(result.error || 'Failed to accept booking');
    }
  };

  const handleDecline = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const reason = formData.get('reason') as string;

    const result = await declineBooking(booking.id, reason);

    setIsProcessing(false);

    if (result.success) {
      onUpdate?.();
    } else {
      setError(result.error || 'Failed to decline booking');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200">
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 shrink-0">
          {booking.client.image ? (
            <Image src={booking.client.image} alt={booking.client.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
              {booking.client.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <div className="font-semibold text-gray-900">{booking.client.name}</div>
          <div className="text-sm text-gray-600">{booking.client.email}</div>
        </div>
      </div>

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
              {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="text-sm text-gray-600">
              {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              {endDate && booking.duration && (
                <> - {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ({booking.duration} min)</>
              )}
            </div>
          </div>
        </div>

        {booking.location && (
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
        )}

        {booking.clientMessage && (
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[#FF6B4A] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <div>
              <div className="font-medium text-gray-900 mb-1">Message from {booking.client.name}:</div>
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{booking.clientMessage}</div>
            </div>
          </div>
        )}

        {booking.coachPayout && (
          <div className="flex items-start gap-3 pt-2">
          <svg className="w-5 h-5 text-[#FF6B4A] mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <div className="text-lg font-bold text-[#FF6B4A]">
              You receive: ${parseFloat(booking.coachPayout!).toFixed(2)}
            </div>
            <details className="text-xs text-gray-500 mt-1">
              <summary className="cursor-pointer hover:text-gray-700">View breakdown</summary>
              <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded">
                <div className="flex justify-between">
                  <span>Client paid:</span>
                  <span className="font-medium">${parseFloat(booking.clientPaid!).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Stripe fee:</span>
                  <span>-${parseFloat(booking.stripeFee!).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Platform fee:</span>
                  <span>-${parseFloat(booking.platformFee!).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-300 pt-1 font-semibold text-gray-900">
                  <span>Your payout:</span>
                  <span>${parseFloat(booking.coachPayout!).toFixed(2)}</span>
                </div>
              </div>
            </details>
          </div>
          </div>
        )}
      </div>
      
      {booking.status === 'pending' && !showDeclineForm && (
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowDeclineForm(true)}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Accept & Charge'}
          </button>
        </div>
      )}

      {showDeclineForm && (
        <form onSubmit={handleDecline} className="pt-4 border-t border-gray-200 space-y-3">
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
            Reason for declining (will be sent to client):
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            required
            placeholder="e.g., Not available at this time, out of my specialty area, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDeclineForm(false)}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Confirm Decline'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

