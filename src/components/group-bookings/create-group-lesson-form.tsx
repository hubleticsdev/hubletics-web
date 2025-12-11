'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createPublicGroupLesson, createRecurringGroupLesson } from '@/actions/group-bookings/create-public-lesson';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';

interface CreateGroupLessonFormProps {
  preferredLocations: Array<{ name: string; address: string; notes?: string }>;
  availability: Record<string, Array<{ start: string; end: string }>>;
}

export function CreateGroupLessonForm({ preferredLocations, availability }: CreateGroupLessonFormProps) {
  const router = useRouter();
  const [lessonType, setLessonType] = useState<'single' | 'recurring'>('single');
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(60);

  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [recurringStartTime, setRecurringStartTime] = useState('');
  const [recurringDuration, setRecurringDuration] = useState(60);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [locationIndex, setLocationIndex] = useState(0);
  const [customLocation, setCustomLocation] = useState({ name: '', address: '', notes: '' });
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [minParticipants, setMinParticipants] = useState(5);
  const [pricePerPerson, setPricePerPerson] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pricePerPerson || parseFloat(pricePerPerson) <= 0) {
      toast.error('Please enter a valid price per person');
      return;
    }

    if (maxParticipants < minParticipants) {
      toast.error('Maximum participants must be greater than or equal to minimum');
      return;
    }

    if (minParticipants < 2) {
      toast.error('Minimum participants must be at least 2');
      return;
    }

    const location = useCustomLocation
      ? customLocation
      : preferredLocations[locationIndex];

    if (!location.name || !location.address) {
      toast.error('Please select or enter a valid location');
      return;
    }

    setSubmitting(true);

    try {
      if (lessonType === 'single') {
        if (!date || !startTime) {
          toast.error('Please select date and time');
          setSubmitting(false);
          return;
        }

        const scheduledStartAt = new Date(`${date}T${startTime}`);
        const scheduledEndAt = new Date(scheduledStartAt.getTime() + duration * 60000);

        const result = await createPublicGroupLesson({
          scheduledStartAt,
          scheduledEndAt,
          duration,
          location,
          maxParticipants,
          minParticipants,
          pricePerPerson: parseFloat(pricePerPerson),
          description: description || undefined,
        });

        if (result.success) {
          toast.success('Group lesson created successfully!');
          router.push('/dashboard/coach');
        } else {
          toast.error(result.error || 'Failed to create lesson');
        }
      } else {
        // Recurring lesson
        if (!title || !recurringStartTime || !startDate) {
          toast.error('Please fill in all required fields');
          setSubmitting(false);
          return;
        }

        const result = await createRecurringGroupLesson({
          title,
          description: description || undefined,
          dayOfWeek,
          startTime: recurringStartTime,
          duration: recurringDuration,
          location,
          maxParticipants,
          minParticipants,
          pricePerPerson: parseFloat(pricePerPerson),
          startDate,
          endDate: endDate || undefined,
        });

        if (result.success) {
          toast.success('Recurring group lesson created successfully!');
          router.push('/dashboard/coach');
        } else {
          toast.error(result.error || 'Failed to create recurring lesson');
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
      {/* Lesson Type Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Lesson Type</label>
        <div className="flex gap-4">
          <Button
            type="button"
            variant={lessonType === 'single' ? 'default' : 'outline'}
            onClick={() => setLessonType('single')}
            className="flex-1"
          >
            Single Lesson
          </Button>
          <Button
            type="button"
            variant={lessonType === 'recurring' ? 'default' : 'outline'}
            onClick={() => setLessonType('recurring')}
            className="flex-1"
          >
            Recurring Lesson
          </Button>
        </div>
      </div>

      {lessonType === 'single' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                Date
              </label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="inline h-4 w-4 mr-1" />
                Start Time
              </label>
              <input
                type="time"
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
              min="30"
              step="15"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              required
            />
          </div>
        </>
      )}

      {lessonType === 'recurring' && (
        <>
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Lesson Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Basketball Training"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dayOfWeek" className="block text-sm font-medium text-gray-700 mb-1">
                Day of Week
              </label>
              <select
                id="dayOfWeek"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              >
                {daysOfWeek.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="recurringStartTime" className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="inline h-4 w-4 mr-1" />
                Start Time
              </label>
              <input
                type="time"
                id="recurringStartTime"
                value={recurringStartTime}
                onChange={(e) => setRecurringStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="recurringDuration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="recurringDuration"
              value={recurringDuration}
              onChange={(e) => setRecurringDuration(parseInt(e.target.value) || 60)}
              min="30"
              step="15"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End Date (optional)
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Leave empty for indefinite</p>
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <MapPin className="inline h-4 w-4 mr-1" />
          Location
        </label>
        {preferredLocations.length > 0 && !useCustomLocation ? (
          <>
            <select
              value={locationIndex}
              onChange={(e) => setLocationIndex(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
            >
              {preferredLocations.map((loc, idx) => (
                <option key={idx} value={idx}>
                  {loc.name} - {loc.address}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setUseCustomLocation(true)}
              className="mt-2 text-sm text-[#FF6B4A] hover:underline"
            >
              Use different location
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Location name"
              value={customLocation.name}
              onChange={(e) => setCustomLocation({ ...customLocation, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent mb-2"
              required
            />
            <input
              type="text"
              placeholder="Address"
              value={customLocation.address}
              onChange={(e) => setCustomLocation({ ...customLocation, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              required
            />
            {preferredLocations.length > 0 && (
              <button
                type="button"
                onClick={() => setUseCustomLocation(false)}
                className="mt-2 text-sm text-[#FF6B4A] hover:underline"
              >
                Use preferred location
              </button>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="minParticipants" className="block text-sm font-medium text-gray-700 mb-1">
            <Users className="inline h-4 w-4 mr-1" />
            Minimum Participants
          </label>
          <input
            type="number"
            id="minParticipants"
            value={minParticipants}
            onChange={(e) => setMinParticipants(parseInt(e.target.value) || 2)}
            min="2"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
            required
          />
        </div>

        <div>
          <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700 mb-1">
            Maximum Participants
          </label>
          <input
            type="number"
            id="maxParticipants"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 10)}
            min={minParticipants}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="pricePerPerson" className="block text-sm font-medium text-gray-700 mb-1">
          Price per Person ($)
        </label>
        <input
          type="number"
          id="pricePerPerson"
          value={pricePerPerson}
          onChange={(e) => setPricePerPerson(e.target.value)}
          min="0"
          step="0.01"
          placeholder="0.00"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Tell participants what to expect..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
        />
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="px-8"
        >
          {submitting ? 'Creating...' : lessonType === 'single' ? 'Create Lesson' : 'Create Recurring Lesson'}
        </Button>
      </div>
    </form>
  );
}

