'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getBookingParticipants } from '@/actions/group-bookings/participants';
import { User, CheckCircle, Clock, Loader2 } from 'lucide-react';

interface ParticipantsModalProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ParticipantsModal({ bookingId, isOpen, onClose }: ParticipantsModalProps) {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchParticipants();
    }
  }, [isOpen, bookingId]);

  const fetchParticipants = async () => {
    setLoading(true);
    setError(null);

    const result = await getBookingParticipants(bookingId);

    if (result.success && result.participants) {
      setParticipants(result.participants);
      setIsOrganizer(result.isOrganizer || false);
    } else {
      setError(result.error || 'Failed to load participants');
    }

    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Group Participants</DialogTitle>
          <DialogDescription>
            {participants.length} participant{participants.length !== 1 ? 's' : ''} in this group lesson
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {participant.image ? (
                      <img
                        src={participant.image}
                        alt={participant.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{participant.name}</div>
                    {participant.username && (
                      <div className="text-sm text-gray-500">@{participant.username}</div>
                    )}
                    {participant.amountPaid && (
                      <div className="text-xs text-gray-600 mt-0.5">
                        ${parseFloat(participant.amountPaid).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {participant.paymentStatus === 'paid' ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      <CheckCircle className="h-3 w-3" />
                      Paid
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                      <Clock className="h-3 w-3" />
                      Pending
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

