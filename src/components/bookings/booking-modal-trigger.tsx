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
  mode?: 'private' | 'group';
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
  mode = 'private',
  buttonText,
  buttonClass,
}: BookingModalTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const defaultButtonText = mode === 'group' ? 'Book Group Session' : 'Book a Session';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          buttonClass ||
          'px-8 py-3 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200'
        }
      >
        {buttonText || defaultButtonText}
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
          mode={mode}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

