'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';

interface BookingCalendarProps {
  coachAvailability: Record<string, { start: string; end: string }[]>; // e.g., { "monday": [{ start: "09:00", end: "17:00" }] }
  blockedDates: string[]; // ISO date strings
  sessionDuration: number; // minutes
  existingBookings: Array<{ scheduledStartAt: Date; scheduledEndAt: Date }>;
  onSelectSlot: (startTime: Date, endTime: Date) => void;
  selectedSlot: { start: Date; end: Date } | null;
}

export function BookingCalendar({
  coachAvailability,
  blockedDates,
  sessionDuration,
  existingBookings,
  onSelectSlot,
  selectedSlot,
}: BookingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Generate next 30 days
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const dateString = date.toISOString().split('T')[0];
      
      // Check if coach is available this day of week and date isn't blocked
      if (coachAvailability[dayName] && !blockedDates.includes(dateString)) {
        dates.push(date);
      }
    }
    
    return dates;
  }, [coachAvailability, blockedDates]);

  // Generate time slots for selected date
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];

    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayAvailability = coachAvailability[dayName];
    
    if (!dayAvailability) return [];

    const slots: Array<{ start: Date; end: Date; available: boolean }> = [];

    dayAvailability.forEach(({ start, end }) => {
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);

      const startTime = new Date(selectedDate);
      startTime.setHours(startHour, startMin, 0, 0);

      const endTime = new Date(selectedDate);
      endTime.setHours(endHour, endMin, 0, 0);

      let currentSlot = new Date(startTime);
      
      while (currentSlot.getTime() + sessionDuration * 60000 <= endTime.getTime()) {
        const slotEnd = new Date(currentSlot.getTime() + sessionDuration * 60000);
        
        // Check if slot conflicts with existing bookings
        const isAvailable = !existingBookings.some(booking => {
          const bookingStart = new Date(booking.scheduledStartAt);
          const bookingEnd = new Date(booking.scheduledEndAt);
          return (
            (currentSlot >= bookingStart && currentSlot < bookingEnd) ||
            (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
            (currentSlot <= bookingStart && slotEnd >= bookingEnd)
          );
        });

        // Only show future slots
        if (currentSlot > new Date()) {
          slots.push({
            start: new Date(currentSlot),
            end: slotEnd,
            available: isAvailable,
          });
        }

        currentSlot = new Date(currentSlot.getTime() + 30 * 60000); // 30 min intervals
      }
    });

    return slots;
  }, [selectedDate, coachAvailability, sessionDuration, existingBookings]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Date Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Select a Date</h3>
        <div className="grid grid-cols-7 gap-2">
          {availableDates.slice(0, 21).map((date) => (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedDate?.toDateString() === date.toDateString()
                  ? 'border-[#FF6B4A] bg-orange-50 text-[#FF6B4A] font-semibold'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <div className="text-xs text-gray-500">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-lg font-semibold">
                {date.getDate()}
              </div>
            </button>
          ))}
        </div>
        {availableDates.length > 21 && (
          <p className="text-sm text-gray-500 mt-2">
            + {availableDates.length - 21} more dates available
          </p>
        )}
      </div>

      {/* Time Slot Selection */}
      {selectedDate && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Available Times on {formatDate(selectedDate)}
          </h3>
          {timeSlots.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600">
              No available time slots for this date.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {timeSlots.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => slot.available && onSelectSlot(slot.start, slot.end)}
                  disabled={!slot.available}
                  className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    selectedSlot?.start.getTime() === slot.start.getTime()
                      ? 'border-[#FF6B4A] bg-orange-50 text-[#FF6B4A]'
                      : slot.available
                      ? 'border-gray-200 hover:border-[#FF6B4A] text-gray-700'
                      : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {formatTime(slot.start)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

