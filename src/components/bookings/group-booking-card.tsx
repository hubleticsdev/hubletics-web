'use client';

import { useState } from 'react';
import { acceptParticipant } from '@/actions/group-bookings/accept-participant';
import { declineParticipant } from '@/actions/group-bookings/decline-participant';
import Image from 'next/image';
import { formatDateOnly, formatTimeOnly } from '@/lib/utils/date';

interface GroupBookingCardProps {
  booking: {
    id: string;
    scheduledStartAt: Date;
    scheduledEndAt?: Date;
    duration?: number;
    timezone?: string;
    location?: {
      name: string;
      address: string;
      notes?: string;
    };
    clientMessage?: string | null;
    pricePerPerson?: string | null;
    maxParticipants?: number | null;
    currentParticipants?: number | null;
    hasPendingParticipants?: boolean;
    pendingParticipantsCount?: number;
    pendingParticipants?: Array<{
      id: string;
      user: {
        id: string;
        name: string;
        email: string;
        image?: string | null;
      };
    }>;
  };
  timezone?: string;
  onUpdate?: () => void;
}

export function GroupBookingCard({ booking, timezone = 'America/Chicago', onUpdate }: GroupBookingCardProps) {
  const [processingParticipants, setProcessingParticipants] = useState<Set<string>>(new Set());
  const [showDeclineForm, setShowDeclineForm] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const startDate = new Date(booking.scheduledStartAt);
  const endDate = booking.scheduledEndAt ? new Date(booking.scheduledEndAt) : null;

  const handleAcceptParticipant = async (participantId: string) => {
    setProcessingParticipants(prev => new Set(prev).add(participantId));
    setErrors(prev => ({ ...prev, [participantId]: '' }));

    const result = await acceptParticipant(booking.id, participantId);

    setProcessingParticipants(prev => {
      const next = new Set(prev);
      next.delete(participantId);
      return next;
    });

    if (result.success) {
      onUpdate?.();
    } else {
      setErrors(prev => ({ ...prev, [participantId]: result.error || 'Failed to accept participant' }));
    }
  };

  const handleDeclineParticipant = async (participantId: string, reason?: string) => {
    setProcessingParticipants(prev => new Set(prev).add(participantId));
    setErrors(prev => ({ ...prev, [participantId]: '' }));

    const result = await declineParticipant(booking.id, participantId, reason);

    setProcessingParticipants(prev => {
      const next = new Set(prev);
      next.delete(participantId);
      return next;
    });
    setShowDeclineForm(null);

    if (result.success) {
      onUpdate?.();
    } else {
      setErrors(prev => ({ ...prev, [participantId]: result.error || 'Failed to decline participant' }));
    }
  };

  const pendingParticipants = booking.pendingParticipants || [];

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="mb-4 pb-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Group Lesson</h3>
        <div className="text-sm text-gray-600">
          {booking.currentParticipants || 0} of {booking.maxParticipants || 0} spots filled
          {booking.pricePerPerson && ` • $${parseFloat(booking.pricePerPerson).toFixed(2)} per person`}
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
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">
          Pending Participants ({pendingParticipants.length})
        </h4>

        {pendingParticipants.map((participant) => {
          const isProcessing = processingParticipants.has(participant.id);
          const error = errors[participant.id];

          return (
            <div key={participant.id} className="border border-gray-200 rounded-lg p-4">
              {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 shrink-0">
                  {participant.user.image ? (
                    <Image src={participant.user.image} alt={participant.user.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
                      {participant.user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{participant.user.name}</div>
                  <div className="text-sm text-gray-600">{participant.user.email}</div>
                </div>
              </div>

              {showDeclineForm === participant.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const reason = formData.get('reason') as string;
                    handleDeclineParticipant(participant.id, reason);
                  }}
                  className="space-y-3"
                >
                  <label htmlFor={`reason-${participant.id}`} className="block text-sm font-medium text-gray-700">
                    Reason for declining (will be sent to participant):
                  </label>
                  <textarea
                    id={`reason-${participant.id}`}
                    name="reason"
                    rows={2}
                    required
                    placeholder="e.g., Lesson is full, not available, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeclineForm(null)}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
                    >
                      {isProcessing ? 'Processing...' : 'Confirm Decline'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeclineForm(participant.id)}
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleAcceptParticipant(participant.id)}
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 text-sm"
                  >
                    {isProcessing ? 'Processing...' : 'Accept & Charge'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
