'use client';

import { useState } from 'react';
import { processRefund, markDisputeResolved } from '@/actions/admin/disputes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type DisputedBooking = {
  id: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  location: { name: string; address: string };
  expectedGrossCents?: number | null;
  coachPayoutCents?: number | null;
  platformFeeCents?: number | null;
  stripeFeeCents?: number | null;
  cancellationReason: string | null;
  client: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  coach: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  createdAt: Date;
};

interface DisputesListProps {
  bookings: DisputedBooking[];
}

export function DisputesList({ bookings }: DisputesListProps) {
  const router = useRouter();
  const [selectedBooking, setSelectedBooking] = useState<DisputedBooking | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [resolution, setResolution] = useState('');
  const [processing, setProcessing] = useState(false);

  const formatDollars = (cents?: number | null) =>
    cents !== undefined && cents !== null ? (cents / 100).toFixed(2) : '0.00';

  const handleRefund = async () => {
    if (!selectedBooking) return;

    if (refundType === 'partial' && (!partialAmount || parseFloat(partialAmount) <= 0)) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    setProcessing(true);

    const result = await processRefund(
      selectedBooking.id,
      refundType,
      refundType === 'partial' ? parseFloat(partialAmount) : undefined,
      refundReason || undefined
    );

    setProcessing(false);

    if (result.success) {
      toast.success(result.message);
      setRefundDialogOpen(false);
      setSelectedBooking(null);
      setRefundReason('');
      setPartialAmount('');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleResolve = async () => {
    if (!selectedBooking || !resolution.trim()) {
      toast.error('Please provide a resolution note');
      return;
    }

    setProcessing(true);

    const result = await markDisputeResolved(selectedBooking.id, resolution);

    setProcessing(false);

    if (result.success) {
      toast.success(result.message);
      setResolveDialogOpen(false);
      setSelectedBooking(null);
      setResolution('');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="bg-white rounded-lg shadow border-l-4 border-red-500 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {booking.coach.name} & {booking.client.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Disputed on {new Date(booking.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                DISPUTED
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-600 mb-1">Scheduled Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(booking.scheduledStartAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-600">
                  {new Date(booking.scheduledStartAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Client Paid</p>
                <p className="text-sm font-medium text-gray-900">
                  ${formatDollars(booking.expectedGrossCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Coach Payout</p>
                <p className="text-sm font-medium text-gray-900">
                  ${formatDollars(booking.coachPayoutCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Platform Fee</p>
                <p className="text-sm font-medium text-gray-900">
                  ${formatDollars(booking.platformFeeCents)}
                </p>
              </div>
            </div>

            {booking.cancellationReason && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-semibold text-gray-700 mb-1">Reason:</p>
                <p className="text-sm text-gray-800">{booking.cancellationReason}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  setSelectedBooking(booking);
                  setRefundDialogOpen(true);
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Process Refund
              </Button>
              <Button
                onClick={() => {
                  setSelectedBooking(booking);
                  setResolveDialogOpen(true);
                }}
                variant="outline"
              >
                Mark Resolved
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Issue a refund to the client and reverse the transfer to the coach.
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {selectedBooking.coach.name} & {selectedBooking.client.name}
                </p>
                <p className="text-xs text-gray-600">
                  Client Paid: ${formatDollars(selectedBooking.expectedGrossCents)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="full"
                      checked={refundType === 'full'}
                      onChange={() => setRefundType('full')}
                      className="mr-2"
                    />
                    <span className="text-sm">Full Refund</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="partial"
                      checked={refundType === 'partial'}
                      onChange={() => setRefundType('partial')}
                      className="mr-2"
                    />
                    <span className="text-sm">Partial Refund</span>
                  </label>
                </div>
              </div>

              {refundType === 'partial' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Refund Amount
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={selectedBooking.expectedGrossCents ? selectedBooking.expectedGrossCents / 100 : undefined}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (Optional)
                </label>
                <Textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Explain why this refund is being issued..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setRefundDialogOpen(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRefund}
                  disabled={processing}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {processing ? 'Processing...' : 'Process Refund'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Dispute as Resolved</DialogTitle>
            <DialogDescription>
              Mark this dispute as resolved without processing a refund. The booking status will be changed to completed.
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {selectedBooking.coach.name} & {selectedBooking.client.name}
                </p>
                <p className="text-xs text-gray-600">
                  {new Date(selectedBooking.scheduledStartAt).toLocaleDateString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Note
                </label>
                <Textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Explain how this dispute was resolved..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setResolveDialogOpen(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResolve}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {processing ? 'Saving...' : 'Mark Resolved'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
