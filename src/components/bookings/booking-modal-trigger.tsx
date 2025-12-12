'use client';

import { useState } from 'react';
import { BookingModal } from './booking-modal';

interface BookingModalTriggerProps {
  coachId: string;
  coachName: string;
  hourlyRate: number;
  sessionDuration: number;
  availability: Record<string, Array<{ start: string; end: string }>>;
  blockedDates: string[];
  existingBookings: Array<{ scheduledStartAt: Date; scheduledEndAt: Date }>;
  preferredLocations: Array<{ name: string; address: string; notes?: string }>;
  allowPrivateGroups?: boolean;
  buttonText?: string;
  buttonClass?: string;
}

export function BookingModalTrigger({
  coachId,
  coachName,
  hourlyRate,
  sessionDuration,
  availability,
  blockedDates,
  existingBookings,
  preferredLocations,
  allowPrivateGroups = false,
  buttonText,
  buttonClass,
}: BookingModalTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          buttonClass ||
          'px-8 py-3 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200'
        }
      >
        {buttonText || 'Book a Session'}
      </button>

      {isOpen && (
        <BookingModal
          coachId={coachId}
          coachName={coachName}
          hourlyRate={hourlyRate}
          sessionDuration={sessionDuration}
          availability={availability}
          blockedDates={blockedDates}
          existingBookings={existingBookings}
          preferredLocations={preferredLocations}
          allowPrivateGroups={allowPrivateGroups}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

