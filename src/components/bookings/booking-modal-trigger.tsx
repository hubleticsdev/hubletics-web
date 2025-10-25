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
}

export function BookingModalTrigger({
  coachId,
  coachName,
  hourlyRate,
  sessionDuration,
  availability,
  blockedDates,
  existingBookings,
}: BookingModalTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-8 py-3 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200"
      >
        Book a Session
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
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

