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
  upcomingBookings,
}: AvailabilityManagerProps) {
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>(
    initialWeeklyAvailability
  );
  const [blockedDates, setBlockedDates] = useState<string[]>(initialBlockedDates);
  const [sessionDuration, setSessionDuration] = useState(initialSessionDuration);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateCoachAvailability({
        weeklyAvailability,
        blockedDates,
        sessionDuration,
      });

      if (result.success) {
        toast.success('Availability updated successfully');
        setHasChanges(false);
      } else {
        toast.error(result.error || 'Failed to update availability');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Save bar */}
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
                className="bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A]"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Weekly Schedule */}
        <div className="lg:col-span-2 space-y-6">
          {/* Session Duration */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Session Duration</h2>
            <p className="text-sm text-gray-600 mb-4">
              How long are your typical coaching sessions?
            </p>
            <div className="flex gap-3">
              {[30, 60, 90, 120].map((duration) => (
                <button
                  key={duration}
                  onClick={() => handleSessionDurationChange(duration)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    sessionDuration === duration
                      ? 'bg-[#FF6B4A] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {duration} min
                </button>
              ))}
            </div>
          </div>

          {/* Weekly Schedule */}
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

          {/* Blocked Dates */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Block Specific Dates</h2>
            <p className="text-sm text-gray-600 mb-6">
              Mark dates when you're unavailable (vacations, holidays, etc.)
            </p>
            <BlockedDatesCalendar
              blockedDates={blockedDates}
              onChange={handleBlockedDatesChange}
              upcomingBookings={upcomingBookings}
            />
          </div>
        </div>

        {/* Sidebar - Upcoming Bookings */}
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
