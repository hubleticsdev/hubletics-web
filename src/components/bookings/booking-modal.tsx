'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createBooking } from '@/actions/bookings/create';
import { BookingCalendar } from './booking-calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface BookingModalProps {
  coachId: string;
  coachName: string;
  hourlyRate: number;
  sessionDuration: number;
  availability: Record<string, { start: string; end: string }[]>;
  blockedDates: string[];
  existingBookings: Array<{ scheduledStartAt: Date; scheduledEndAt: Date }>;
  onClose: () => void;
}

interface BookingFormProps extends BookingModalProps {
  clientSecret: string;
}

function BookingForm({
  coachId,
  coachName,
  hourlyRate,
  sessionDuration,
  availability,
  blockedDates,
  existingBookings,
  onClose,
  clientSecret,
}: BookingFormProps) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'datetime' | 'details' | 'payment'>('datetime');

  const totalCost = hourlyRate * (sessionDuration / 60);

  const handleSubmit = async () => {
    if (!stripe || !elements || !selectedSlot || !clientSecret) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Submit payment element to get payment method
      const { error: submitError } = await elements.submit();
      
      if (submitError) {
        throw new Error(submitError.message);
      }

      // Confirm payment with Stripe (holds funds)
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/athlete`,
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      if (!paymentIntent) {
        throw new Error('Payment confirmation failed');
      }

      // Payment confirmed! Now create the booking record
      const bookingResult = await createBooking({
        coachId,
        scheduledStartAt: selectedSlot.start,
        scheduledEndAt: selectedSlot.end,
        location: {
          name: locationName,
          address: locationAddress,
          notes: locationNotes || undefined,
        },
        clientMessage: message || undefined,
        paymentIntentId: paymentIntent.id,
      });

      if (!bookingResult.success) {
        throw new Error(bookingResult.error || 'Failed to create booking');
      }

      // Success!
      onClose();
      router.push('/dashboard/athlete');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const canProceedToDetails = selectedSlot !== null;
  const canProceedToPayment = locationName && locationAddress;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Session with {coachName}</DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className={step === 'datetime' ? 'text-[#FF6B4A] font-semibold' : ''}>
                1. Date & Time
              </span>
              <span className="text-gray-300">→</span>
              <span className={step === 'details' ? 'text-[#FF6B4A] font-semibold' : ''}>
                2. Details
              </span>
              <span className="text-gray-300">→</span>
              <span className={step === 'payment' ? 'text-[#FF6B4A] font-semibold' : ''}>
                3. Payment
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Date & Time Selection */}
          {step === 'datetime' && (
            <div className="space-y-6">
              <BookingCalendar
                coachAvailability={availability}
                blockedDates={blockedDates}
                sessionDuration={sessionDuration}
                existingBookings={existingBookings}
                onSelectSlot={(start, end) => setSelectedSlot({ start, end })}
                selectedSlot={selectedSlot}
              />

              {selectedSlot && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">Selected Time</div>
                      <div className="text-sm text-gray-600">
                        {selectedSlot.start.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}
                        {' at '}
                        {selectedSlot.start.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {' - '}
                        {selectedSlot.end.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Duration: {sessionDuration} minutes
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#FF6B4A]">${totalCost.toFixed(2)}</div>
                      <div className="text-xs text-gray-600">Total cost</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('details')}
                  disabled={!canProceedToDetails}
                  className="flex-1 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
                >
                  Continue to Details
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Location & Message */}
          {step === 'details' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="locationName">
                  Location Name *
                </Label>
                <Input
                  id="locationName"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g., Central Park, LA Fitness"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationAddress">
                  Address *
                </Label>
                <Input
                  id="locationAddress"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  placeholder="Full address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationNotes">
                  Location Notes (Optional)
                </Label>
                <Input
                  id="locationNotes"
                  value={locationNotes}
                  onChange={(e) => setLocationNotes(e.target.value)}
                  placeholder="e.g., Meet at main entrance"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">
                  Message to Coach (Optional)
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Tell the coach about your goals, experience level, or any special requests..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setStep('datetime')}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep('payment')}
                  disabled={!canProceedToPayment}
                  className="flex-1 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
                >
                  Continue to Payment
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 'payment' && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700">Session ({sessionDuration} min)</span>
                  <span className="font-semibold">${totalCost.toFixed(2)}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {selectedSlot?.start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  {' at '}
                  {selectedSlot?.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Details</h3>
                <PaymentElement />
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <strong>Payment Hold:</strong> Your payment will be authorized but not charged until the coach accepts your request. If declined, the authorization will be released immediately.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setStep('details')}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing || !stripe || !elements}
                  className="flex-1 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Pay $${totalCost.toFixed(2)}`
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BookingModal(props: BookingModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    // We'll create the PaymentIntent upfront to get client_secret
    // This is fine since we're using manual capture
    fetch('/api/bookings/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coachId: props.coachId,
        amount: props.hourlyRate * (props.sessionDuration / 60),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      })
      .catch(err => {
        console.error('Failed to create payment intent:', err);
      });
  }, [props.coachId, props.hourlyRate, props.sessionDuration]);

  if (!clientSecret) {
    return (
      <Dialog open={true} onOpenChange={props.onClose}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-[#FF6B4A]" />
            <p className="mt-4 text-gray-600">Preparing booking form...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
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
      <BookingForm {...props} clientSecret={clientSecret} />
    </Elements>
  );
}

