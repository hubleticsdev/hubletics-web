'use client';

import { useState } from 'react';
import { acceptBooking, declineBooking, acceptPrivateGroupBooking } from '@/actions/bookings/manage';
import Image from 'next/image';
import { formatUiBookingStatus } from '@/lib/booking-status';
import type { UiBookingStatus } from '@/lib/booking-status';
import { formatDateOnly, formatTimeOnly } from '@/lib/utils/date';

interface BookingCardProps {
  booking: {
    id: string;
    bookingType?: 'individual' | 'private_group' | 'public_group';
    scheduledStartAt: Date;
    scheduledEndAt?: Date;
    duration?: number;
    location?: {
      name: string;
      address: string;
      notes?: string;
    };
    status: UiBookingStatus;
    clientMessage?: string | null;
    expectedGrossCents?: number | null;
    coachPayoutCents?: number | null;
    platformFeeCents?: number | null;
    stripeFeeCents?: number | null;
    // For individual bookings
    individualDetails?: {
      clientMessage?: string | null;
      clientPaysCents: number;
      coachPayoutCents: number;
      platformFeeCents: number;
      stripeFeeCents?: number;
      client: {
        id: string;
        name: string;
        email: string;
        image?: string | null;
      };
    } | null;
    // For private group bookings (flattened)
    client?: {
      id?: string;
      name: string;
      email?: string;
      image?: string | null;
    } | null;
  };
  timezone?: string;
  onUpdate?: () => void;
}

export function CoachBookingCard({ booking, timezone = 'America/Chicago', onUpdate }: BookingCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const client = booking.individualDetails?.client || booking.client;
  const clientMessage = booking.individualDetails?.clientMessage ?? booking.clientMessage ?? null;
  const expectedGrossCents = booking.individualDetails?.clientPaysCents ?? booking.expectedGrossCents ?? 0;
  const coachPayoutCents = booking.individualDetails?.coachPayoutCents ?? booking.coachPayoutCents ?? 0;
  const platformFeeCents = booking.individualDetails?.platformFeeCents ?? booking.platformFeeCents ?? 0;
  const stripeFeeCents = booking.individualDetails?.stripeFeeCents ?? booking.stripeFeeCents ?? 0;

  if (!client || !client.name) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-800">Error: Booking missing client information</p>
      </div>
    );
  }

  const startDate = new Date(booking.scheduledStartAt);
  const endDate = booking.scheduledEndAt ? new Date(booking.scheduledEndAt) : null;

  const handleAccept = async () => {
    setIsProcessing(true);
    setError(null);

    const isPrivateGroup = booking.bookingType === 'private_group' || (!booking.individualDetails && !!booking.client);
    
    const result = isPrivateGroup
      ? await acceptPrivateGroupBooking(booking.id)
      : await acceptBooking(booking.id);

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

  const formatDollars = (cents?: number | null) =>
    cents !== undefined && cents !== null ? (cents / 100).toFixed(2) : '0.00';

  const clientPaid = formatDollars(expectedGrossCents);
  const coachPayout = formatDollars(coachPayoutCents);
  const stripeFee = formatDollars(stripeFeeCents);
  const platformFee = formatDollars(platformFeeCents);
  const statusClass = (() => {
    switch (booking.status) {
      case 'awaiting_coach':
        return 'bg-yellow-100 text-yellow-800';
      case 'awaiting_payment':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'disputed':
        return 'bg-purple-100 text-purple-800';
      case 'open':
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  })();

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200">
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 shrink-0">
          {client.image ? (
            <Image src={client.image} alt={client.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <div className="font-semibold text-gray-900">{client.name}</div>
          {client.email && <div className="text-sm text-gray-600">{client.email}</div>}
        </div>
      </div>

      <div className="mb-3 flex justify-end">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass}`}>
          {formatUiBookingStatus(booking.status)}
        </span>
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
              {formatDateOnly(startDate, timezone)}
            </div>
            <div className="text-sm text-gray-600">
              {formatTimeOnly(startDate, timezone)}
              {endDate && booking.duration && (
                <> - {formatTimeOnly(endDate, timezone)} ({booking.duration} min)</>
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

        {clientMessage && (
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
              <div className="font-medium text-gray-900 mb-1">Message from {client.name}:</div>
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{clientMessage}</div>
            </div>
          </div>
        )}

        {coachPayoutCents !== undefined && coachPayoutCents !== null && (
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
              You receive: ${coachPayout}
            </div>
            <details className="text-xs text-gray-500 mt-1">
              <summary className="cursor-pointer hover:text-gray-700">View breakdown</summary>
              <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded">
                <div className="flex justify-between">
                  <span>Client pays:</span>
                  <span className="font-medium">${clientPaid}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Stripe fee:</span>
                  <span>-${stripeFee}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Platform fee:</span>
                  <span>-${platformFee}</span>
                </div>
                <div className="flex justify-between border-t border-gray-300 pt-1 font-semibold text-gray-900">
                  <span>Your payout:</span>
                  <span>${coachPayout}</span>
                </div>
              </div>
            </details>
          </div>
          </div>
        )}
      </div>

      {booking.status === 'awaiting_coach' && !showDeclineForm && (
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowDeclineForm(true)}
            disabled={isProcessing}
            className="cursor-pointer flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="cursor-pointer flex-1 px-4 py-2 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Accept & Request Payment'}
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
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="e.g., Not available at this time, out of my specialty area, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDeclineForm(false)}
              disabled={isProcessing}
              className="cursor-pointer flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="cursor-pointer flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Confirm Decline'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
