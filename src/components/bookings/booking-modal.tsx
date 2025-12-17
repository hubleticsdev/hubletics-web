'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBooking } from '@/actions/bookings/create';
import { createPrivateGroupBooking } from '@/actions/group-bookings/create-private-group';
import { getCoachPricingTiersPublic, getApplicableTier } from '@/actions/group-bookings/pricing-tiers';
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
  availability,
  blockedDates,
  existingBookings,
  preferredLocations,
  allowPrivateGroups = false,
  coachTimezone = DEFAULT_TIMEZONE,
  onClose,
}: BookingModalProps) {
  const router = useRouter();

  const [bookingType, setBookingType] = useState<'individual' | 'group'>('individual');
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState<number>(-1);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
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
    // Reset form when switching types
    setSelectedSlot(null);
    setSelectedLocationIndex(-1);
    setLocationName('');
    setLocationAddress('');
    setLocationNotes('');
    setMessage('');
    setParticipantUsernames([]);
    setStep('datetime');
    setError(null);
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

  // Fetch pricing tiers when group booking is enabled
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
      // Use shared pricing utility for individual bookings
      const pricing = calculateBookingPricing(hourlyRate, sessionDuration, platformFeePercentage);
      return {
        baseCost: pricing.clientPays,
        displayCost: pricing.clientPays,
        pricePerPerson: null,
        totalParticipants: 1,
      };
    } else {
      // Group booking: calculate based on participant count and pricing tiers
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
        // No tier found - show error or default
        return {
          baseCost: 0,
          displayCost: 0,
          pricePerPerson: null,
          totalParticipants: totalParticipants,
          error: 'No pricing tier available for this group size',
        };
      }

      const pricePerPerson = parseFloat(tierResult.pricePerPerson);
      const groupTotals = calculateGroupTotals(pricePerPerson, totalParticipants, platformFeePercentage);

      return {
        baseCost: groupTotals.totalGrossCents / 100,
        displayCost: groupTotals.totalGrossCents / 100,
        pricePerPerson: pricePerPerson,
        totalParticipants: totalParticipants,
        groupTotals,
      };
    }
  }, [bookingType, hourlyRate, sessionDuration, platformFeePercentage, participantUsernames.length, pricingTiers]);

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

        bookingResult = await createPrivateGroupBooking({
          coachId,
          scheduledStartAt: selectedSlot.start,
          scheduledEndAt: selectedSlot.end,
          duration: sessionDuration,
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
                        {formatDateOnly(selectedSlot.start, coachTimezone)}
                        {' at '}
                        {formatTimeRange(selectedSlot.start, selectedSlot.end, coachTimezone)}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Duration: {sessionDuration} minutes
                      </div>
                      {bookingType === 'group' && calculatedPricing.pricePerPerson && (
                        <div className="text-sm text-gray-600 mt-1">
                          {calculatedPricing.totalParticipants} participant{calculatedPricing.totalParticipants !== 1 ? 's' : ''} × ${calculatedPricing.pricePerPerson.toFixed(2)}/person
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {isLoadingTiers && bookingType === 'group' ? (
                        <div className="text-sm text-gray-500">Loading pricing...</div>
                      ) : calculatedPricing.error ? (
                        <div className="text-sm text-red-600">{calculatedPricing.error}</div>
                      ) : (
                        <>
                          <div className="text-2xl font-bold text-[#FF6B4A]">${baseSessionCost.toFixed(2)}</div>
                          <div className="text-xs text-gray-600">
                            {bookingType === 'group' ? 'Total cost' : 'Session cost'}
                          </div>
                          {bookingType === 'group' && calculatedPricing.pricePerPerson && (
                            <div className="text-xs text-gray-500 mt-1">
                              ${calculatedPricing.pricePerPerson.toFixed(2)} per person
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
                      {sessionDuration} minutes
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
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-[#FF6B4A]">${baseSessionCost.toFixed(2)}</div>
                      {bookingType === 'group' && calculatedPricing.pricePerPerson && (
                        <div className="text-xs text-gray-600 mt-1">
                          {calculatedPricing.totalParticipants} × ${calculatedPricing.pricePerPerson.toFixed(2)} per person
                        </div>
                      )}
                      <div className="text-xs text-gray-600 mt-1">
                        {bookingType === 'individual' 
                          ? 'Plus platform fees (calculated at payment)'
                          : 'Includes platform fees'}
                      </div>
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

