'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

type TimeSlot = { start: string; end: string };
type WeeklyAvailability = Record<string, TimeSlot[]>;

interface WeeklyScheduleProps {
  availability: WeeklyAvailability;
  onChange: (availability: WeeklyAvailability) => void;
  upcomingBookings: Array<{
    id: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
  }>;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export function WeeklySchedule({ availability, onChange, upcomingBookings }: WeeklyScheduleProps) {
  const addTimeSlot = (day: string) => {
    const newAvailability = { ...availability };
    if (!newAvailability[day]) {
      newAvailability[day] = [];
    }
    newAvailability[day].push({ start: '09:00', end: '17:00' });
    onChange(newAvailability);
  };

  const removeTimeSlot = (day: string, index: number) => {
    const newAvailability = { ...availability };
    newAvailability[day] = newAvailability[day].filter((_, i) => i !== index);
    if (newAvailability[day].length === 0) {
      delete newAvailability[day];
    }
    onChange(newAvailability);
  };

  const updateTimeSlot = (day: string, index: number, field: 'start' | 'end', value: string) => {
    const newAvailability = { ...availability };
    newAvailability[day][index][field] = value;
    onChange(newAvailability);
  };

  const hasBookingOnDay = (day: string) => {
    const dayIndex = DAYS.indexOf(day);
    return upcomingBookings.some((booking) => {
      const bookingDay = new Date(booking.scheduledStartAt).getDay();
      const adjustedDay = bookingDay === 0 ? 6 : bookingDay - 1;
      return adjustedDay === dayIndex;
    });
  };

  return (
    <div className="space-y-4">
      {DAYS.map((day) => {
        const slots = availability[day] || [];
        const isUnavailable = slots.length === 0;
        const hasBooking = hasBookingOnDay(day);

        return (
          <div
            key={day}
            className={`border rounded-lg p-4 ${
              hasBooking ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">{DAY_LABELS[day]}</h3>
                {hasBooking && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                    Has bookings
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addTimeSlot(day)}
                className="text-[#FF6B4A] hover:text-[#FF8C5A] hover:bg-orange-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add time
              </Button>
            </div>

            {isUnavailable ? (
              <p className="text-sm text-gray-500 italic">Unavailable this day</p>
            ) : (
              <div className="space-y-2">
                {slots.map((slot, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) => updateTimeSlot(day, index, 'start', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) => updateTimeSlot(day, index, 'end', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(day, index)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
