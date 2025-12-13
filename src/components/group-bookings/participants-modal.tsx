'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getBookingParticipants } from '@/actions/group-bookings/participants';
import { acceptParticipant } from '@/actions/group-bookings/accept-participant';
import { declineParticipant } from '@/actions/group-bookings/decline-participant';
import { User, CheckCircle, Clock, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ParticipantsModalProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ParticipantsModal({ bookingId, isOpen, onClose }: ParticipantsModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    image: string | null;
    username: string | null;
    paymentStatus: 'requires_payment_method' | 'authorized' | 'captured' | 'refunded' | 'cancelled';
    status: 'requested' | 'awaiting_payment' | 'awaiting_coach' | 'accepted' | 'declined' | 'cancelled' | 'completed';
    amountCents: number | null;
    joinedAt: Date;
  }>>([]);
  const [isCoach, setIsCoach] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingParticipantId, setProcessingParticipantId] = useState<string | null>(null);

  const fetchParticipants = async () => {
    setLoading(true);
    setError(null);

    const result = await getBookingParticipants(bookingId);

    if (result.success && result.participants) {
      setParticipants(result.participants);
      setIsCoach(result.isCoach || false);
    } else {
      setError(result.error || 'Failed to load participants');
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchParticipants();
    }
  }, [isOpen, bookingId]);

  const handleApprove = async (participantId: string) => {
    setProcessingParticipantId(participantId);
    const result = await acceptParticipant(bookingId, participantId);

    if (result.success) {
      toast.success('Participant approved successfully');
      await fetchParticipants();
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to approve participant');
    }

    setProcessingParticipantId(null);
  };

  const handleDecline = async (participantId: string) => {
    setProcessingParticipantId(participantId);
    const result = await declineParticipant(bookingId, participantId);

    if (result.success) {
      toast.success('Participant declined');
      await fetchParticipants();
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to decline participant');
    }

    setProcessingParticipantId(null);
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
                      <Image
                        src={participant.image}
                        alt={participant.name}
                        width={40}
                        height={40}
                        className="object-cover"
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
                    {participant.amountCents !== null && participant.amountCents !== undefined && (
                      <div className="text-xs text-gray-600 mt-0.5">
                        ${(participant.amountCents / 100).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {participant.paymentStatus === 'captured' ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      <CheckCircle className="h-3 w-3" />
                      Paid
                    </div>
                  ) : participant.paymentStatus === 'authorized' && isCoach ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(participant.id)}
                        disabled={processingParticipantId === participant.id}
                        className="h-7 px-3 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90 text-white text-xs"
                      >
                        {processingParticipantId === participant.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecline(participant.id)}
                        disabled={processingParticipantId === participant.id}
                        className="h-7 px-3 border-red-300 text-red-600 hover:bg-red-50 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                      <Clock className="h-3 w-3" />
                      {participant.paymentStatus === 'requires_payment_method'
                        ? 'Payment required'
                        : participant.status === 'awaiting_coach'
                          ? 'Awaiting coach approval'
                          : 'Pending'}
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
