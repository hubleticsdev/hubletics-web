'use client';

import { useState } from 'react';
import { WeeklySchedule } from './weekly-schedule';
import { BlockedDatesCalendar } from './blocked-dates-calendar';
import { UpcomingBookings } from './upcoming-bookings';
import { updateCoachAvailability } from '@/actions/coaches/availability';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type WeeklyAvailability = Record<string, Array<{ start: string; end: string }>>;

interface AvailabilityManagerProps {
  weeklyAvailability: WeeklyAvailability;
  blockedDates: string[];
  sessionDuration: number;
  allowedDurations: number[];
  defaultDuration: number;
  upcomingBookings: Array<{
    id: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    clientName: string;
    clientImage: string | null;
  }>;
}

export function AvailabilityManager({
  weeklyAvailability: initialWeeklyAvailability,
  blockedDates: initialBlockedDates,
  sessionDuration: initialSessionDuration,
  allowedDurations: initialAllowedDurations,
  defaultDuration: initialDefaultDuration,
  upcomingBookings,
}: AvailabilityManagerProps) {
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>(
    initialWeeklyAvailability
  );
  const [blockedDates, setBlockedDates] = useState<string[]>(initialBlockedDates);
  const [sessionDuration, setSessionDuration] = useState(initialSessionDuration);
  const [allowedDurations, setAllowedDurations] = useState<number[]>(initialAllowedDurations);
  const [defaultDuration, setDefaultDuration] = useState<number>(initialDefaultDuration);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleWeeklyAvailabilityChange = (newAvailability: WeeklyAvailability) => {
    setWeeklyAvailability(newAvailability);
    setHasChanges(true);
  };

  const handleBlockedDatesChange = (newBlockedDates: string[]) => {
    setBlockedDates(newBlockedDates);
    setHasChanges(true);
  };

  const handleSessionDurationChange = (duration: number) => {
    setSessionDuration(duration);
    setHasChanges(true);
  };

  const handleAllowedDurationToggle = (duration: number) => {
    const newDurations = allowedDurations.includes(duration)
      ? allowedDurations.filter(d => d !== duration)
      : [...allowedDurations, duration].sort((a, b) => a - b);
    
    if (newDurations.length === 0) {
      toast.error('At least one duration must be selected');
      return;
    }

    if (defaultDuration === duration && newDurations.length > 0) {
      setDefaultDuration(newDurations[0]);
    }

    setAllowedDurations(newDurations);
    setHasChanges(true);
  };

  const handleSetDefaultDuration = (duration: number) => {
    if (!allowedDurations.includes(duration)) {
      toast.error('Duration must be selected before setting as default');
      return;
    }
    setDefaultDuration(duration);
    setSessionDuration(duration); // Sync with sessionDuration
    setHasChanges(true);
  };

  const handleAddCustomDuration = () => {
    const duration = parseInt(customDuration, 10);
    if (isNaN(duration) || duration < 15 || duration > 480) {
      toast.error('Duration must be between 15 and 480 minutes');
      return;
    }
    if (allowedDurations.includes(duration)) {
      toast.error('This duration is already added');
      return;
    }
    const newDurations = [...allowedDurations, duration].sort((a, b) => a - b);
    setAllowedDurations(newDurations);
    setCustomDuration('');
    setHasChanges(true);
  };

  const handleRemoveDuration = (duration: number) => {
    if (allowedDurations.length === 1) {
      toast.error('At least one duration must be selected');
      return;
    }
    const newDurations = allowedDurations.filter(d => d !== duration);
    if (defaultDuration === duration && newDurations.length > 0) {
      setDefaultDuration(newDurations[0]);
      setSessionDuration(newDurations[0]);
    }
    setAllowedDurations(newDurations);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateCoachAvailability({
        weeklyAvailability,
        blockedDates,
        allowedDurations,
        defaultDuration,
      });

      if (result.success) {
        toast.success('Availability updated successfully');
        setHasChanges(false);
      } else {
        toast.error(result.error || 'Failed to update availability');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm text-gray-600">You have unsaved changes</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setWeeklyAvailability(initialWeeklyAvailability);
                  setBlockedDates(initialBlockedDates);
                  setSessionDuration(initialSessionDuration);
                  setHasChanges(false);
                }}
                disabled={saving}
              >
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A]"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Allowed Session Durations</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select which session durations clients can book. At least one must be selected. The default duration will be used for display and fallback.
            </p>
            
            {/* Common durations */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Common Durations</label>
              <div className="flex flex-wrap gap-3">
                {[30, 60, 90, 120].map((duration) => (
                  <div key={duration} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`duration-${duration}`}
                      checked={allowedDurations.includes(duration)}
                      onChange={() => handleAllowedDurationToggle(duration)}
                      className="h-4 w-4 text-[#FF6B4A] focus:ring-[#FF6B4A] border-gray-300 rounded"
                    />
                    <label htmlFor={`duration-${duration}`} className="text-sm text-gray-700 cursor-pointer">
                      {duration} min
                    </label>
                    {allowedDurations.includes(duration) && (
                      <button
                        onClick={() => handleSetDefaultDuration(duration)}
                        className={`text-xs px-2 py-1 rounded ${
                          defaultDuration === duration
                            ? 'bg-[#FF6B4A] text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        title={defaultDuration === duration ? 'Default duration' : 'Set as default'}
                      >
                        {defaultDuration === duration ? 'Default' : 'Set default'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom duration input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Add Custom Duration</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="e.g., 45, 75, 150"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#FF6B4A] focus:border-[#FF6B4A]"
                />
                <button
                  onClick={handleAddCustomDuration}
                  disabled={!customDuration}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Selected durations list */}
            {allowedDurations.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Selected Durations</label>
                <div className="flex flex-wrap gap-2">
                  {allowedDurations.map((duration) => (
                    <div
                      key={duration}
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                        defaultDuration === duration
                          ? 'bg-[#FF6B4A] text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="text-sm font-medium">{duration} min</span>
                      {defaultDuration === duration && (
                        <span className="text-xs">(Default)</span>
                      )}
                      {allowedDurations.length > 1 && (
                        <button
                          onClick={() => handleRemoveDuration(duration)}
                          className="ml-1 text-xs hover:underline"
                          title="Remove duration"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Weekly Schedule</h2>
            <p className="text-sm text-gray-600 mb-6">
              Set your recurring weekly availability. Clients can only book during these times.
            </p>
            <WeeklySchedule
              availability={weeklyAvailability}
              onChange={handleWeeklyAvailabilityChange}
              upcomingBookings={upcomingBookings}
            />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Block Specific Dates</h2>
            <p className="text-sm text-gray-600 mb-6">
              Mark dates when you&apos;re unavailable (vacations, holidays, etc.)
            </p>
            <BlockedDatesCalendar
              blockedDates={blockedDates}
              onChange={handleBlockedDatesChange}
              upcomingBookings={upcomingBookings}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Sessions</h2>
            <UpcomingBookings bookings={upcomingBookings} />
          </div>
        </div>
      </div>
    </div>
  );
}
