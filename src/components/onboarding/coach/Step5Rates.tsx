'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { CoachProfileData } from '@/actions/onboarding/coach';

type Step5Props = {
  formData: CoachProfileData;
  setFormData: (data: CoachProfileData) => void;
};

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type DayOfWeek = typeof DAYS_OF_WEEK[number];

export function Step5Rates({ formData, setFormData }: Step5Props) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);
  const [newSlot, setNewSlot] = useState({ start: '', end: '' });
  const [newLocation, setNewLocation] = useState({ name: '', address: '', notes: '' });
  const [isAddingLocation, setIsAddingLocation] = useState(false);

  const addTimeSlot = () => {
    if (!selectedDay) {
      toast.error('Please select a day');
      return;
    }
    if (!newSlot.start || !newSlot.end) {
      toast.error('Please enter start and end times');
      return;
    }
    if (newSlot.start >= newSlot.end) {
      toast.error('End time must be after start time');
      return;
    }

    const currentSlots = formData.weeklyAvailability[selectedDay] || [];
    setFormData({
      ...formData,
      weeklyAvailability: {
        ...formData.weeklyAvailability,
        [selectedDay]: [...currentSlots, { start: newSlot.start, end: newSlot.end }],
      },
    });

    setNewSlot({ start: '', end: '' });
    toast.success('Time slot added!');
  };

  const removeTimeSlot = (day: DayOfWeek, index: number) => {
    setFormData({
      ...formData,
      weeklyAvailability: {
        ...formData.weeklyAvailability,
        [day]: formData.weeklyAvailability[day].filter((_, i) => i !== index),
      },
    });
  };

  const saveLocation = () => {
    if (!newLocation.name.trim() || !newLocation.address.trim()) {
      toast.error('Please enter location name and address');
      return;
    }

    setFormData({
      ...formData,
      preferredLocations: [
        ...formData.preferredLocations,
        {
          name: newLocation.name,
          address: newLocation.address,
          notes: newLocation.notes || undefined,
        },
      ],
    });

    setNewLocation({ name: '', address: '', notes: '' });
    setIsAddingLocation(false);
    toast.success('Location added!');
  };

  const removeLocation = (index: number) => {
    setFormData({
      ...formData,
      preferredLocations: formData.preferredLocations.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Rates & Availability</h2>
        <p className="mt-2 text-gray-600">
          Set your pricing and let athletes know when you&apos;re available.
        </p>
      </div>

      {/* Hourly Rate */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label htmlFor="hourlyRate" className="block text-sm font-semibold text-gray-900 mb-2">
            Hourly Rate (USD) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
              $
            </span>
            <input
              id="hourlyRate"
              type="number"
              min="0"
              step="1"
              value={formData.hourlyRate}
              onChange={(e) =>
                setFormData({ ...formData, hourlyRate: Number(e.target.value) })
              }
              className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
              placeholder="50"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">Your rate per hour of coaching</p>
        </div>

        <div>
          <label
            htmlFor="sessionDuration"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            Default Session Duration (minutes)
          </label>
          <input
            id="sessionDuration"
            type="number"
            min="30"
            step="15"
            value={formData.sessionDuration}
            onChange={(e) =>
              setFormData({ ...formData, sessionDuration: Number(e.target.value) })
            }
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
            placeholder="60"
          />
          <p className="text-xs text-gray-500 mt-2">Typical session length (default: 60 min)</p>
        </div>
      </div>

      {/* Weekly Availability */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Weekly Availability <span className="text-red-500">*</span>
        </label>

        {/* Day Selector */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {DAYS_OF_WEEK.map((day) => {
            const daySlots = formData.weeklyAvailability[day] || [];
            const hasSlots = daySlots.length > 0;
            const dayDisplay = day.charAt(0).toUpperCase() + day.slice(1);
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`shrink-0 px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                  selectedDay === day
                    ? 'bg-orange-50 border-[#FF6B4A] text-[#FF6B4A]'
                    : hasSlots
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {dayDisplay.substring(0, 3)}
                {hasSlots && <span className="ml-1 text-xs">({daySlots.length})</span>}
              </button>
            );
          })}
        </div>

        {/* Add Time Slot */}
        {selectedDay && (
          <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50/30">
            <h4 className="font-semibold text-gray-900 mb-3">{selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}</h4>

            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={newSlot.start}
                  onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={newSlot.end}
                  onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={addTimeSlot}
                className="self-end px-4 py-2 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Add
              </button>
            </div>

            {/* Display Slots */}
            {formData.weeklyAvailability[selectedDay]?.length > 0 && (
              <div className="space-y-2">
                {formData.weeklyAvailability[selectedDay].map((slot, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {slot.start} - {slot.end}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(selectedDay, index)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedDay && (
          <div className="text-center py-8 px-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-600">Select a day above to add availability</p>
          </div>
        )}
      </div>

      {/* Preferred Locations */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Preferred Training Locations <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-gray-600 mb-3">
          Add at least one location where you train clients. Athletes will choose from these when booking.
        </p>

        {formData.preferredLocations.length > 0 && (
          <div className="space-y-3 mb-4">
            {formData.preferredLocations.map((location, index) => (
              <div
                key={index}
                className="border-2 border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{location.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{location.address}</p>
                  {location.notes && (
                    <p className="text-sm text-gray-500 mt-1 italic">{location.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeLocation(index)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {isAddingLocation ? (
          <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50/30 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Name
              </label>
              <input
                type="text"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
                placeholder="e.g., Central Park Tennis Courts"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={newLocation.address}
                onChange={(e) =>
                  setNewLocation({ ...newLocation, address: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
                placeholder="123 Main St, City, State"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={newLocation.notes}
                onChange={(e) => setNewLocation({ ...newLocation, notes: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
                placeholder="Additional details about this location"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={saveLocation}
                className="flex-1 px-4 py-2 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Save Location
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingLocation(false);
                  setNewLocation({ name: '', address: '', notes: '' });
                }}
                className="px-4 py-2 bg-white text-gray-700 font-medium rounded-lg border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingLocation(true)}
            className="w-full px-6 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#FF6B4A] hover:text-[#FF6B4A] transition-all flex items-center justify-center gap-2 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Location
          </button>
        )}
      </div>
    </div>
  );
}

