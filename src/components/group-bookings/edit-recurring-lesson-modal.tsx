'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { editRecurringLesson } from '@/actions/group-bookings/edit-recurring';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface EditRecurringLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: {
    id: string;
    title: string;
    description: string | null;
    dayOfWeek: number;
    startTime: string;
    duration: number;
    maxParticipants: number;
    minParticipants: number;
    pricePerPerson: string;
    location: {
      name: string;
      address: string;
      notes?: string;
    };
    startDate: string;
    endDate: string | null;
  } | null;
  preferredLocations: Array<{ name: string; address: string; notes?: string }>;
  onSuccess?: () => void;
}

const daysOfWeek = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function EditRecurringLessonModal({
  isOpen,
  onClose,
  lesson,
  preferredLocations,
  onSuccess
}: EditRecurringLessonModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [minParticipants, setMinParticipants] = useState(5);
  const [pricePerPerson, setPricePerPerson] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [locationIndex, setLocationIndex] = useState(0);
  const [customLocation, setCustomLocation] = useState({ name: '', address: '', notes: '' });
  const [useCustomLocation, setUseCustomLocation] = useState(false);

  useEffect(() => {
    if (lesson && isOpen) {
      setTitle(lesson.title);
      setDescription(lesson.description || '');
      setDayOfWeek(lesson.dayOfWeek);
      setStartTime(lesson.startTime);
      setDuration(lesson.duration);
      setMaxParticipants(lesson.maxParticipants);
      setMinParticipants(lesson.minParticipants);
      setPricePerPerson(lesson.pricePerPerson);
      setStartDate(lesson.startDate);
      setEndDate(lesson.endDate || '');

      // Try to match location with preferred locations
      const matchingIndex = preferredLocations.findIndex(
        loc => loc.name === lesson.location.name && loc.address === lesson.location.address
      );

      if (matchingIndex >= 0) {
        setLocationIndex(matchingIndex);
        setUseCustomLocation(false);
      } else {
        setCustomLocation({
          name: lesson.location.name,
          address: lesson.location.address,
          notes: lesson.location.notes || '',
        });
        setUseCustomLocation(true);
      }
    }
  }, [lesson, isOpen, preferredLocations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lesson) return;

    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!startTime) {
      toast.error('Start time is required');
      return;
    }

    if (!startDate) {
      toast.error('Start date is required');
      return;
    }

    if (!pricePerPerson || parseFloat(pricePerPerson) <= 0) {
      toast.error('Please enter a valid price per person');
      return;
    }

    if (maxParticipants < minParticipants) {
      toast.error('Maximum participants must be greater than or equal to minimum');
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
      const result = await editRecurringLesson({
        id: lesson.id,
        title: title.trim(),
        description: description.trim() || undefined,
        dayOfWeek,
        startTime,
        duration,
        maxParticipants,
        minParticipants,
        pricePerPerson: parseFloat(pricePerPerson),
        location,
        startDate,
        endDate: endDate || undefined,
      });

      if (result.success) {
        toast.success('Recurring lesson updated successfully!');
        onClose();
        onSuccess?.();
      } else {
        toast.error(result.error || 'Failed to update lesson');
      }
    } catch (error) {
      toast.error('An error occurred while updating the lesson');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDayOfWeek(1);
    setStartTime('');
    setDuration(60);
    setMaxParticipants(10);
    setMinParticipants(5);
    setPricePerPerson('');
    setStartDate('');
    setEndDate('');
    setLocationIndex(0);
    setCustomLocation({ name: '', address: '', notes: '' });
    setUseCustomLocation(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!lesson) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Recurring Lesson</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Lesson Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Basketball Fundamentals"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of the lesson"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">Day of Week *</Label>
              <select
                id="dayOfWeek"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                required
              >
                {daysOfWeek.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                max="480"
                step="15"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricePerPerson">Price per Person *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="pricePerPerson"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerPerson}
                  onChange={(e) => setPricePerPerson(e.target.value)}
                  className="pl-8"
                  placeholder="25.00"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minParticipants">Minimum Participants *</Label>
              <Input
                id="minParticipants"
                type="number"
                min="0"
                max="50"
                value={minParticipants}
                onChange={(e) => setMinParticipants(parseInt(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxParticipants">Maximum Participants *</Label>
              <Input
                id="maxParticipants"
                type="number"
                min="1"
                max="50"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <Label>Location *</Label>

            {preferredLocations.length > 0 && (
              <select
                value={useCustomLocation ? '-1' : locationIndex.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '-1') {
                    setUseCustomLocation(true);
                  } else {
                    setLocationIndex(parseInt(value));
                    setUseCustomLocation(false);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              >
                {preferredLocations.map((location, index) => (
                  <option key={index} value={index.toString()}>
                    {location.name}
                  </option>
                ))}
                <option value="-1">Custom location</option>
              </select>
            )}

            {useCustomLocation && (
              <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                <div className="space-y-2">
                  <Label htmlFor="customName">Location Name *</Label>
                  <Input
                    id="customName"
                    value={customLocation.name}
                    onChange={(e) => setCustomLocation(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Central Park Basketball Court"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customAddress">Address *</Label>
                  <Input
                    id="customAddress"
                    value={customLocation.address}
                    onChange={(e) => setCustomLocation(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Full address"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customNotes">Notes</Label>
                  <Textarea
                    id="customNotes"
                    value={customLocation.notes || ''}
                    onChange={(e) => setCustomLocation(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes about the location"
                    rows={2}
                  />
                </div>
              </div>
            )}

            {!useCustomLocation && preferredLocations[locationIndex] && (
              <div className="p-4 border rounded-lg bg-blue-50">
                <div className="font-medium text-blue-900">{preferredLocations[locationIndex].name}</div>
                <div className="text-blue-700">{preferredLocations[locationIndex].address}</div>
                {preferredLocations[locationIndex].notes && (
                  <div className="text-blue-600 text-sm mt-1">{preferredLocations[locationIndex].notes}</div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Lesson
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
