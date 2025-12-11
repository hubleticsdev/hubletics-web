'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface BlockedDatesCalendarProps {
  blockedDates: string[];
  onChange: (dates: string[]) => void;
  upcomingBookings: Array<{
    id: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
  }>;
}

export function BlockedDatesCalendar({
  blockedDates,
  onChange,
  upcomingBookings,
}: BlockedDatesCalendarProps) {
  const [newDate, setNewDate] = useState('');

  const addBlockedDate = () => {
    if (newDate && !blockedDates.includes(newDate)) {
      const hasBooking = upcomingBookings.some((booking) => {
        const bookingDate = new Date(booking.scheduledStartAt).toISOString().split('T')[0];
        return bookingDate === newDate;
      });

      if (hasBooking) {
        alert(
          'You have an existing booking on this date. Please cancel the booking first before blocking this date.'
        );
        return;
      }

      onChange([...blockedDates, newDate].sort());
      setNewDate('');
    }
  };

  const removeBlockedDate = (date: string) => {
    onChange(blockedDates.filter((d) => d !== date));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          min={today}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
        />
        <Button
          type="button"
          onClick={addBlockedDate}
          disabled={!newDate}
          className="bg-[#FF6B4A] hover:bg-[#FF8C5A]"
        >
          Block Date
        </Button>
      </div>

      {blockedDates.length === 0 ? (
        <p className="text-sm text-gray-500 italic text-center py-8">
          No blocked dates. Add dates when you're unavailable.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {blockedDates.map((date) => (
            <div
              key={date}
              className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
            >
              <span className="text-sm font-medium text-gray-700">{formatDate(date)}</span>
              <button
                type="button"
                onClick={() => removeBlockedDate(date)}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
