'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { joinPublicLesson } from '@/actions/group-bookings/join-public-lesson';
import { PaymentElement, useStripe, useElements, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { formatBookingDateTime } from '@/lib/utils/date';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface JoinLessonModalProps {
  lesson: {
    id: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    location: {
      name: string;
      address: string;
    };
    maxParticipants: number | null;
    minParticipants: number | null;
    pricePerPerson: string | null;
    currentParticipants: number;
    clientMessage: string | null;
  };
  coachName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function JoinLessonModal({ lesson, coachName, isOpen, onClose }: JoinLessonModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    const result = await joinPublicLesson(lesson.id);
    setLoading(false);

    if (!result.success || !result.clientSecret) {
      toast.error(result.error || 'Failed to join lesson');
      return;
    }

    setClientSecret(result.clientSecret);
    setAmount(result.amount || 0);
  };

  const handleClose = () => {
    setClientSecret(null);
    setAmount(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Join Group Lesson</DialogTitle>
          <DialogDescription>
            Review details and complete payment to join
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div>
              <div className="text-sm text-gray-500">Coach</div>
              <div className="font-semibold text-gray-900">{coachName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Date & Time</div>
              <div className="font-medium text-gray-900">
                {formatBookingDateTime(new Date(lesson.scheduledStartAt))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Location</div>
              <div className="font-medium text-gray-900">
                {lesson.location.name}
                <div className="text-sm text-gray-600">{lesson.location.address}</div>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Participants</div>
              <div className="font-medium text-gray-900">
                {lesson.currentParticipants}/{lesson.maxParticipants} joined
              </div>
            </div>
            {lesson.clientMessage && (
              <div>
                <div className="text-sm text-gray-500">Details</div>
                <div className="text-sm text-gray-700">{lesson.clientMessage}</div>
              </div>
            )}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Price</span>
                <span className="text-2xl font-bold text-[#FF6B4A]">
                  ${lesson.pricePerPerson ? parseFloat(lesson.pricePerPerson).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>

          {!clientSecret ? (
            <Button
              onClick={handleJoin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join & Pay
            </Button>
          ) : (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: { theme: 'stripe' },
              }}
            >
              <CheckoutForm
                lessonId={lesson.id}
                amount={amount || 0}
                onSuccess={handleClose}
              />
            </Elements>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="w-full"
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckoutForm({
  lessonId,
  amount,
  onSuccess,
}: {
  lessonId: string;
  amount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/bookings?joined=${lessonId}`,
      },
      redirect: 'if_required',
    });

    if (error) {
      toast.error(error.message || 'Payment failed');
      setProcessing(false);
      return;
    }

    toast.success('Successfully joined the lesson!');
    onSuccess();
    router.push('/dashboard/bookings');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
      >
        {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Pay ${amount.toFixed(2)}
      </Button>
    </form>
  );
}

