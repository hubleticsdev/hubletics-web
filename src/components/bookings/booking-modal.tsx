'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBooking } from '@/actions/bookings/create';
import { createPrivateGroupBooking } from '@/actions/group-bookings/create-private-group';
import { getCoachPricingTiersPublic } from '@/actions/group-bookings/pricing-tiers';
import { calculateBookingPricing, calculateGroupTotals } from '@/lib/pricing';
import { formatDateOnly, formatTimeRange, DEFAULT_TIMEZONE } from '@/lib/utils/date';
import { BookingCalendar } from './booking-calendar';
import { ParticipantSelector } from '../group-bookings/participant-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface BookingModalProps {
  coachId: string;
  coachName: string;
  hourlyRate: number;
  sessionDuration: number;
  allowedDurations?: number[];
  availability: Record<string, { start: string; end: string }[]>;
  blockedDates: string[];
  existingBookings: Array<{ scheduledStartAt: Date; scheduledEndAt: Date }>;
  preferredLocations: Array<{ name: string; address: string; notes?: string }>;
  allowPrivateGroups?: boolean;
  coachTimezone?: string;
  onClose: () => void;
}

export function BookingModal({
  coachId,
  coachName,
  hourlyRate,
  sessionDuration,
  allowedDurations,
  availability,
  blockedDates,
  existingBookings,
  preferredLocations,
  allowPrivateGroups = false,
  coachTimezone = DEFAULT_TIMEZONE,
  onClose,
}: BookingModalProps) {
  const router = useRouter();

  const availableDurations = allowedDurations && allowedDurations.length > 0 
    ? allowedDurations 
    : [sessionDuration];
  
  const [selectedDuration, setSelectedDuration] = useState<number>(
    availableDurations.includes(sessionDuration) ? sessionDuration : availableDurations[0]
  );

  const [bookingType, setBookingType] = useState<'individual' | 'group'>('individual');
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  // Default to first preferred location if available, otherwise -1 for custom
  const [selectedLocationIndex, setSelectedLocationIndex] = useState<number>(
    preferredLocations.length > 0 ? 0 : -1
  );
  const [locationName, setLocationName] = useState(
    preferredLocations.length > 0 ? preferredLocations[0]?.name || '' : ''
  );
  const [locationAddress, setLocationAddress] = useState(
    preferredLocations.length > 0 ? preferredLocations[0]?.address || '' : ''
  );
  const [locationNotes, setLocationNotes] = useState(
    preferredLocations.length > 0 ? preferredLocations[0]?.notes || '' : ''
  );
  const [message, setMessage] = useState('');
  const [participantUsernames, setParticipantUsernames] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'datetime' | 'details' | 'review'>('datetime');
  const [pricingTiers, setPricingTiers] = useState<Array<{ minParticipants: number; maxParticipants: number | null; pricePerPerson: string }>>([]);
  const [platformFeePercentage, setPlatformFeePercentage] = useState<number>(15);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);

  const handleBookingTypeChange = (type: 'individual' | 'group') => {
    setBookingType(type);
    setSelectedSlot(null);
    // Reset to first preferred location if available, otherwise custom
    const defaultLocationIndex = preferredLocations.length > 0 ? 0 : -1;
    setSelectedLocationIndex(defaultLocationIndex);
    if (defaultLocationIndex >= 0 && preferredLocations[0]) {
      setLocationName(preferredLocations[0].name);
      setLocationAddress(preferredLocations[0].address);
      setLocationNotes(preferredLocations[0].notes || '');
    } else {
      setLocationName('');
      setLocationAddress('');
      setLocationNotes('');
    }
    setMessage('');
    setParticipantUsernames([]);
    setStep('datetime');
    setError(null);
    setSelectedDuration(availableDurations.includes(sessionDuration) ? sessionDuration : availableDurations[0]);
  };

  const handleLocationSelect = (index: number) => {
    setSelectedLocationIndex(index);
    if (index >= 0 && preferredLocations[index]) {
      const location = preferredLocations[index];
      setLocationName(location.name);
      setLocationAddress(location.address);
      setLocationNotes(location.notes || '');
    } else {
      setLocationName('');
      setLocationAddress('');
      setLocationNotes('');
    }
  };

  useEffect(() => {
    if (allowPrivateGroups && bookingType === 'group') {
      setIsLoadingTiers(true);
      getCoachPricingTiersPublic(coachId)
        .then((result) => {
          if (result.success && result.tiers) {
            setPricingTiers(result.tiers);
          }
        })
        .catch((err) => {
          console.error('Failed to load pricing tiers:', err);
        })
        .finally(() => {
          setIsLoadingTiers(false);
        });
    }
  }, [coachId, allowPrivateGroups, bookingType]);

  // Calculate pricing based on booking type
  const calculatedPricing = useMemo(() => {
    if (bookingType === 'individual') {
      const pricing = calculateBookingPricing(hourlyRate, selectedDuration, platformFeePercentage);
      return {
        baseCost: pricing.clientPays,
        displayCost: pricing.clientPays,
        pricePerPerson: null,
        totalParticipants: 1,
        breakdown: {
          coachRate: pricing.coachDesiredRate,
          clientPays: pricing.clientPays,
          stripeFee: pricing.stripeFee,
          platformFee: pricing.platformFee,
          coachPayout: pricing.coachPayout,
        },
      };
    } else {
      const totalParticipants = participantUsernames.length + 1; // +1 for organizer
      
      if (totalParticipants < 2) {
        // Not enough participants yet
        return {
          baseCost: 0,
          displayCost: 0,
          pricePerPerson: null,
          totalParticipants: totalParticipants,
        };
      }

      // Find applicable tier
      const tierResult = pricingTiers.find((tier) => {
        return (
          totalParticipants >= tier.minParticipants &&
          (tier.maxParticipants === null || totalParticipants <= tier.maxParticipants)
        );
      });

      if (!tierResult) {
        // No tier found
        return {
          baseCost: 0,
          displayCost: 0,
          pricePerPerson: null,
          totalParticipants: totalParticipants,
          error: 'No pricing tier available for this group size',
        };
      }

      const coachRatePerPerson = parseFloat(tierResult.pricePerPerson);
      const groupTotals = calculateGroupTotals(coachRatePerPerson, totalParticipants, platformFeePercentage);

      // Calculate per-person breakdown
      const config = { platformFeePercentage, stripePercentage: 2.9, stripeFixedCents: 30 };
      const P = config.platformFeePercentage / 100;
      const S = config.stripePercentage / 100;
      const F = config.stripeFixedCents / 100;
      
      const clientPaysPerPerson = (coachRatePerPerson + F * (1 - P)) / ((1 - S) * (1 - P));
      const stripeFeePerPerson = clientPaysPerPerson * S + F;
      const netAfterStripePerPerson = clientPaysPerPerson - stripeFeePerPerson;
      const platformFeePerPerson = netAfterStripePerPerson * P;
      const coachPayoutPerPerson = netAfterStripePerPerson - platformFeePerPerson;

      return {
        baseCost: groupTotals.totalGrossCents / 100,
        displayCost: groupTotals.totalGrossCents / 100,
        pricePerPerson: groupTotals.pricePerPerson,
        totalParticipants: totalParticipants,
        groupTotals,
        tierInfo: {
          minParticipants: tierResult.minParticipants,
          maxParticipants: tierResult.maxParticipants,
        },
        breakdown: {
          coachRatePerPerson: coachRatePerPerson,
          pricePerPerson: groupTotals.pricePerPerson,
          totalParticipants: totalParticipants,
          totalGross: groupTotals.totalGrossCents / 100,
          stripeFeePerPerson: Number(stripeFeePerPerson.toFixed(2)),
          platformFeePerPerson: Number(platformFeePerPerson.toFixed(2)),
          coachPayoutPerPerson: Number(coachPayoutPerPerson.toFixed(2)),
          totalStripeFee: groupTotals.stripeFeeCents / 100,
          totalPlatformFee: groupTotals.platformFeeCents / 100,
          totalCoachPayout: groupTotals.coachPayoutCents / 100,
        },
      };
    }
  }, [bookingType, hourlyRate, selectedDuration, platformFeePercentage, participantUsernames.length, pricingTiers]);

  const baseSessionCost = calculatedPricing.displayCost;

  const handleSubmit = async () => {
    if (!selectedSlot) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let bookingResult;

      if (bookingType === 'group') {
        if (participantUsernames.length === 0) {
          throw new Error('Please add at least one participant');
        }

        // Calculate actual duration from selected slot
        const actualDuration = Math.round(
          (selectedSlot.end.getTime() - selectedSlot.start.getTime()) / (1000 * 60)
        );

        bookingResult = await createPrivateGroupBooking({
          coachId,
          scheduledStartAt: selectedSlot.start,
          scheduledEndAt: selectedSlot.end,
          duration: actualDuration,
          location: {
            name: locationName,
            address: locationAddress,
            notes: locationNotes || undefined,
          },
          participantUsernames,
          clientMessage: message || undefined,
        });
      } else {
        bookingResult = await createBooking({
          coachId,
          scheduledStartAt: selectedSlot.start,
          scheduledEndAt: selectedSlot.end,
          location: {
            name: locationName,
            address: locationAddress,
            notes: locationNotes || undefined,
          },
          clientMessage: message || undefined,
        });
      }

      if (!bookingResult.success) {
        throw new Error(bookingResult.error || 'Failed to create booking request');
      }

      const successMessage = bookingType === 'group'
        ? `Group booking request sent for ${participantUsernames.length + 1} participants!`
        : 'Booking request sent!';

      toast.success(successMessage, {
        description: 'You\'ll be notified when the coach responds. If accepted, you\'ll have 24 hours to complete payment.',
      });

      onClose();
      router.push('/dashboard/bookings');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to send booking request');
    } finally {
      setIsProcessing(false);
    }
  };

  const canProceedToDetails = selectedSlot !== null;
  const canProceedToReview = locationName && locationAddress;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Session with {coachName}</DialogTitle>
          <DialogDescription>
            Send a booking request to the coach. If accepted, you&apos;ll have 24 hours to complete payment.
          </DialogDescription>

          {allowPrivateGroups && (
            <div className="flex border-b border-gray-200 mt-4 -mb-2">
              <button
                onClick={() => handleBookingTypeChange('individual')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  bookingType === 'individual'
                    ? 'border-[#FF6B4A] text-[#FF6B4A]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Individual
              </button>
              <button
                onClick={() => handleBookingTypeChange('group')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  bookingType === 'group'
                    ? 'border-[#FF6B4A] text-[#FF6B4A]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Group
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span className={step === 'datetime' ? 'text-[#FF6B4A] font-semibold' : ''}>
              1. Date & Time
            </span>
            <span className="text-gray-300">→</span>
            <span className={step === 'details' ? 'text-[#FF6B4A] font-semibold' : ''}>
              2. Details
            </span>
            <span className="text-gray-300">→</span>
            <span className={step === 'review' ? 'text-[#FF6B4A] font-semibold' : ''}>
              3. Review
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {step === 'datetime' && (
            <div className="space-y-6">
              {availableDurations.length > 1 && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Select Session Duration
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {availableDurations.map((duration) => (
                      <button
                        key={duration}
                        type="button"
                        onClick={() => {
                          setSelectedDuration(duration);
                          setSelectedSlot(null);
                        }}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          selectedDuration === duration
                            ? 'bg-[#FF6B4A] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        {duration} min
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <BookingCalendar
                coachAvailability={availability}
                blockedDates={blockedDates}
                sessionDuration={selectedDuration}
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
                        {formatDateOnly(selectedSlot.start, coachTimezone)}
                        {' at '}
                        {formatTimeRange(selectedSlot.start, selectedSlot.end, coachTimezone)}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Duration: {selectedDuration} minutes
                      </div>
                      {bookingType === 'group' && calculatedPricing.breakdown && calculatedPricing.breakdown.pricePerPerson !== undefined && (
                        <div className="text-sm text-gray-600 mt-1">
                          {calculatedPricing.totalParticipants} participant{calculatedPricing.totalParticipants !== 1 ? 's' : ''} × ${calculatedPricing.breakdown.pricePerPerson.toFixed(2)}/person
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {isLoadingTiers && bookingType === 'group' ? (
                        <div className="text-sm text-gray-500">Loading pricing...</div>
                      ) : calculatedPricing.error ? (
                        <div className="text-sm text-red-600">{calculatedPricing.error}</div>
                      ) : bookingType === 'group' && calculatedPricing.totalParticipants < 2 ? (
                        <div className="text-sm text-gray-500 italic">
                          Add participants to see pricing
                        </div>
                      ) : (
                        <>
                          <div className="text-2xl font-bold text-[#FF6B4A]">${baseSessionCost.toFixed(2)}</div>
                          <div className="text-xs text-gray-600">
                            {bookingType === 'group' ? 'You pay for everyone' : 'Session cost'}
                          </div>
                          {bookingType === 'group' && calculatedPricing.breakdown && calculatedPricing.breakdown.pricePerPerson !== undefined && (
                            <>
                              <div className="text-xs text-gray-500 mt-1">
                                {calculatedPricing.totalParticipants} × ${calculatedPricing.breakdown.pricePerPerson.toFixed(2)} per person
                              </div>
                              {calculatedPricing.tierInfo && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  Tier: {calculatedPricing.tierInfo.minParticipants}
                                  {calculatedPricing.tierInfo.maxParticipants 
                                    ? `-${calculatedPricing.tierInfo.maxParticipants}` 
                                    : '+'} participants
                                </div>
                              )}
                            </>
                          )}
                          {bookingType === 'individual' && (
                            <div className="text-xs text-gray-500 mt-1">
                              Includes platform and processing fees
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep('details')}
                  disabled={!canProceedToDetails}
                  className="flex-1 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
                >
                  Continue to Details
                </Button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              {preferredLocations.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="preferredLocation">
                    Select Location *
                  </Label>
                  <select
                    id="preferredLocation"
                    value={selectedLocationIndex}
                    onChange={(e) => handleLocationSelect(parseInt(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#FF6B4A] focus:outline-none focus:ring-1 focus:ring-[#FF6B4A]"
                  >
                    <option value={-1}>Custom location</option>
                    {preferredLocations.map((location, index) => (
                      <option key={index} value={index}>
                        {location.name} - {location.address}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(preferredLocations.length === 0 || selectedLocationIndex === -1) && (
                <>
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
                </>
              )}

              {preferredLocations.length > 0 && selectedLocationIndex >= 0 && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-500">LOCATION</p>
                    <p className="text-sm text-gray-900">{locationName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">ADDRESS</p>
                    <p className="text-sm text-gray-900">{locationAddress}</p>
                  </div>
                  {locationNotes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500">NOTES</p>
                      <p className="text-sm text-gray-900">{locationNotes}</p>
                    </div>
                  )}
                </div>
              )}

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

              {bookingType === 'group' && (
                <div className="space-y-2">
                  <Label>Participants *</Label>
                  <ParticipantSelector
                    selectedUsernames={participantUsernames}
                    onAdd={(username) => setParticipantUsernames(prev => [...prev, username])}
                    onRemove={(username) => setParticipantUsernames(prev => prev.filter(u => u !== username))}
                  />
                  <p className="text-sm text-gray-500">
                    Total: You + {participantUsernames.length} participant{participantUsernames.length !== 1 ? 's' : ''} = {participantUsernames.length + 1} people
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  onClick={() => setStep('datetime')}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep('review')}
                  disabled={!canProceedToReview}
                  className="flex-1 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
                >
                  Review Request
                </Button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Session Details</h3>
                  <div className="space-y-1 text-gray-900">
                    <div className="font-medium">
                      {selectedSlot ? formatDateOnly(selectedSlot.start, coachTimezone) : ''}
                    </div>
                    <div className="text-sm">
                      {selectedSlot ? formatTimeRange(selectedSlot.start, selectedSlot.end, coachTimezone) : ''}
                      {' • '}
                      {selectedDuration} minutes
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Location</h3>
                  <div className="space-y-1 text-gray-900">
                    <div className="font-medium">{locationName}</div>
                    <div className="text-sm">{locationAddress}</div>
                    {locationNotes && <div className="text-sm text-gray-600">{locationNotes}</div>}
                  </div>
                </div>

                {message && (
                  <div className="border-t border-gray-200 pt-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Your Message</h3>
                    <div className="text-sm text-gray-900">{message}</div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-3">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Estimated Cost</h3>
                  {isLoadingTiers && bookingType === 'group' ? (
                    <div className="text-sm text-gray-500">Loading pricing...</div>
                  ) : calculatedPricing.error ? (
                    <div className="text-sm text-red-600">{calculatedPricing.error}</div>
                  ) : bookingType === 'group' && calculatedPricing.totalParticipants < 2 ? (
                    <div className="text-sm text-gray-500 italic">
                      Add at least one participant to see pricing
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-[#FF6B4A]">${baseSessionCost.toFixed(2)}</div>
                      {bookingType === 'group' && calculatedPricing.breakdown && calculatedPricing.breakdown.pricePerPerson !== undefined && (
                        <>
                          <div className="text-xs text-gray-600 mt-1 font-medium">
                            You pay for {calculatedPricing.totalParticipants} participant{calculatedPricing.totalParticipants !== 1 ? 's' : ''}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {calculatedPricing.totalParticipants} × ${calculatedPricing.breakdown.pricePerPerson.toFixed(2)} per person
                          </div>
                          {calculatedPricing.tierInfo && (
                            <div className="text-xs text-gray-500 mt-1">
                              Pricing tier: {calculatedPricing.tierInfo.minParticipants}
                              {calculatedPricing.tierInfo.maxParticipants 
                                ? `-${calculatedPricing.tierInfo.maxParticipants}` 
                                : '+'} participants
                            </div>
                          )}
                          <details className="text-xs text-gray-600 mt-2">
                            <summary className="cursor-pointer hover:text-gray-700 mb-1">View breakdown</summary>
                            <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded">
                              <div className="text-xs font-medium text-gray-700 mb-1">Per Person Breakdown:</div>
                              <div className="flex justify-between">
                                <span>Coach&apos;s rate per person:</span>
                                <span className="font-medium">${calculatedPricing.breakdown.coachRatePerPerson.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-red-600">
                                <span>Stripe fee (added):</span>
                                <span>+${calculatedPricing.breakdown.stripeFeePerPerson.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-red-600">
                                <span>Platform fee (added):</span>
                                <span>+${calculatedPricing.breakdown.platformFeePerPerson.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between border-t border-gray-300 pt-1 font-semibold text-gray-900">
                                <span>You pay per person:</span>
                                <span>${calculatedPricing.breakdown.pricePerPerson.toFixed(2)}</span>
                              </div>
                              <div className="border-t border-gray-300 pt-1 mt-1">
                                <div className="text-xs font-medium text-gray-700 mb-1">Your Total Payment (for {calculatedPricing.totalParticipants} people):</div>
                                <div className="flex justify-between font-semibold text-gray-900">
                                  <span>You pay:</span>
                                  <span>${calculatedPricing.breakdown.totalGross.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-gray-500 pl-2 border-l-2 border-gray-200 ml-1 mt-1">
                                  <div className="flex justify-between">
                                    <span>Coach receives total:</span>
                                    <span>${calculatedPricing.breakdown.totalCoachPayout.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-red-600">
                                    <span>Total Stripe fees:</span>
                                    <span>${calculatedPricing.breakdown.totalStripeFee.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-red-600">
                                    <span>Total platform fees:</span>
                                    <span>${calculatedPricing.breakdown.totalPlatformFee.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </details>
                        </>
                      )}
                      {bookingType === 'individual' && calculatedPricing.breakdown && calculatedPricing.breakdown.coachRate !== undefined && (
                        <details className="text-xs text-gray-600 mt-2">
                          <summary className="cursor-pointer hover:text-gray-700 mb-1">View breakdown</summary>
                          <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded">
                            <div className="flex justify-between">
                              <span>Coach&apos;s rate:</span>
                              <span className="font-medium">${calculatedPricing.breakdown.coachRate.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                              <span>Stripe fee:</span>
                              <span>+${calculatedPricing.breakdown.stripeFee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                              <span>Platform fee:</span>
                              <span>+${calculatedPricing.breakdown.platformFee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-300 pt-1 font-semibold text-gray-900">
                              <span>You pay:</span>
                              <span>${calculatedPricing.breakdown.clientPays.toFixed(2)}</span>
                            </div>
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Clock className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-orange-900">
                    <strong>No payment required yet.</strong> Your request will be sent to {coachName}.
                    If they accept, you&apos;ll have <strong>24 hours</strong> to complete payment.
                    If declined, no charges will be made.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  onClick={() => setStep('details')}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isProcessing}
                  className="flex-1 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    'Send Booking Request'
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

