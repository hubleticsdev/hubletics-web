'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { CoachProfileData } from '@/actions/onboarding/coach';

type Step2Props = {
  formData: CoachProfileData;
  setFormData: (data: CoachProfileData) => void;
};

const AVAILABLE_SPORTS = [
  'Basketball',
  'Soccer',
  'Tennis',
  'Baseball',
  'Football',
  'Volleyball',
  'Swimming',
  'Track & Field',
  'Golf',
  'Lacrosse',
  'Hockey',
  'Wrestling',
  'Gymnastics',
  'Martial Arts',
  'Boxing',
  'CrossFit',
  'Yoga',
  'Pilates',
  'Running',
  'Cycling',
];

export function Step2Specialties({ formData, setFormData }: Step2Props) {
  const [newTag, setNewTag] = useState<Record<string, string>>({});

  const addSport = (sport: string) => {
    // Check if sport already exists
    if (formData.specialties.some((s) => s.sport === sport)) {
      toast.error('Sport already added');
      return;
    }

    setFormData({
      ...formData,
      specialties: [...formData.specialties, { sport, tags: [] }],
    });
  };

  const removeSport = (sport: string) => {
    setFormData({
      ...formData,
      specialties: formData.specialties.filter((s) => s.sport !== sport),
    });
  };

  const addTag = (sport: string) => {
    const tag = newTag[sport]?.trim();
    if (!tag) {
      toast.error('Please enter a tag');
      return;
    }

    const specialty = formData.specialties.find((s) => s.sport === sport);
    if (!specialty) return;

    if (specialty.tags.includes(tag)) {
      toast.error('Tag already added');
      return;
    }

    setFormData({
      ...formData,
      specialties: formData.specialties.map((s) =>
        s.sport === sport ? { ...s, tags: [...s.tags, tag] } : s
      ),
    });

    // Clear input
    setNewTag({ ...newTag, [sport]: '' });
  };

  const removeTag = (sport: string, tagToRemove: string) => {
    setFormData({
      ...formData,
      specialties: formData.specialties.map((s) =>
        s.sport === sport
          ? { ...s, tags: s.tags.filter((t) => t !== tagToRemove) }
          : s
      ),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Your Specialties</h2>
        <p className="mt-2 text-gray-600">
          Select the sports you coach and add specific areas of expertise for each.
        </p>
      </div>

      {/* Sport Selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Select Sports <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {AVAILABLE_SPORTS.map((sport) => {
            const isSelected = formData.specialties.some((s) => s.sport === sport);
            return (
              <button
                key={sport}
                type="button"
                onClick={() => (isSelected ? removeSport(sport) : addSport(sport))}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  isSelected
                    ? 'bg-orange-50 border-[#FF6B4A] text-[#FF6B4A]'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {sport}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags for Each Sport */}
      {formData.specialties.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-gray-900">Add Expertise Tags</h3>
          {formData.specialties.map((specialty) => (
            <div key={specialty.sport} className="border-2 border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4">{specialty.sport}</h4>
              
              {/* Add Tag Input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTag[specialty.sport] || ''}
                  onChange={(e) =>
                    setNewTag({ ...newTag, [specialty.sport]: e.target.value })
                  }
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(specialty.sport);
                    }
                  }}
                  className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
                  placeholder="e.g., Youth Training, Advanced Techniques, etc."
                />
                <button
                  type="button"
                  onClick={() => addTag(specialty.sport)}
                  className="px-4 py-2 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                >
                  Add
                </button>
              </div>

              {/* Display Tags */}
              {specialty.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {specialty.tags.map((tag) => (
                    <div
                      key={tag}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(specialty.sport, tag)}
                        className="hover:text-orange-900"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No tags added yet. Add at least one tag to describe your expertise.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {formData.specialties.length === 0 && (
        <div className="text-center py-8 px-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
          <svg
            className="w-12 h-12 text-gray-400 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <p className="text-gray-600 font-medium">No sports selected yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Select at least one sport to get started
          </p>
        </div>
      )}
    </div>
  );
}

