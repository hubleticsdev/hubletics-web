'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createPaymentForBooking, confirmBookingPayment } from '@/actions/bookings/pay';
import { toast } from 'sonner';
import { Loader2, Clock, CreditCard } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  coachName: string;
  amount: number;
  paymentDueAt: Date;
  onSuccess: () => void;
}

function PaymentForm({
  bookingId,
  amount,
  onSuccess,
  onCancel,
}: {
  bookingId: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        toast.error(submitError.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (confirmError) {
        toast.error(confirmError.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      const result = await confirmBookingPayment(bookingId);

      if (result.success) {
        toast.success('Payment successful! Your lesson is confirmed.');
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to confirm booking');
        setProcessing(false);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      <div className="flex gap-3 justify-end pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || processing}
          className="bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay ${amount.toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function PaymentModal({
  isOpen,
  onClose,
  bookingId,
  coachName,
  amount,
  paymentDueAt,
  onSuccess,
}: PaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (isOpen && !clientSecret) {
      setLoading(true);
      createPaymentForBooking(bookingId).then((result) => {
        if (result.success && result.clientSecret) {
          setClientSecret(result.clientSecret);
        } else {
          toast.error(result.error || 'Failed to initialize payment');
          onClose();
        }
        setLoading(false);
      });
    }
  }, [isOpen, bookingId, clientSecret, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const deadline = new Date(paymentDueAt).getTime();
      const distance = deadline - now;

      if (distance < 0) {
        setTimeLeft('Deadline passed');
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [isOpen, paymentDueAt]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Complete Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Lesson with {coachName}</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Amount:</span>
              <span className="font-semibold text-gray-900">${amount.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <Clock className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-900">Payment deadline:</p>
              <p className="text-lg font-bold text-orange-700">{timeLeft}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF6B4A]" />
            </div>
          ) : clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#FF6B4A',
                  },
                },
              }}
            >
              <PaymentForm bookingId={bookingId} amount={amount} onSuccess={onSuccess} onCancel={onClose} />
            </Elements>
          ) : (
            <p className="text-center text-red-600">Failed to load payment form</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

