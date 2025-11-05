'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateUserAccount, updateAthleteProfile, updateCoachProfile } from '@/actions/profile/update';

interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: 'client' | 'coach' | 'admin' | 'pending';
}

interface ProfileFormProps {
  user: User;
  profile: any;
}

export function ProfileForm({ user, profile }: ProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Account fields (common to all)
  const [name, setName] = useState(user.name);

  // Athlete-specific fields
  const [athleteData, setAthleteData] = useState(
    user.role === 'client' && profile
      ? {
          fullName: profile.fullName || '',
          profilePhoto: profile.profilePhoto || '',
          location: profile.location || { city: '', state: '' },
          sportsInterested: profile.sportsInterested || [],
          experienceLevel: profile.experienceLevel || {},
          budgetRange: profile.budgetRange || { min: 0, max: 0 },
          availability: profile.availability || {},
          bio: profile.bio || '',
        }
      : null
  );

  // Coach-specific fields
  const [coachData, setCoachData] = useState(
    user.role === 'coach' && profile
      ? {
          fullName: profile.fullName || '',
          profilePhoto: profile.profilePhoto || '',
          introVideo: profile.introVideo || '',
          location: profile.location || { cities: [], state: '' },
          specialties: profile.specialties || [],
          bio: profile.bio || '',
          certifications: profile.certifications || [],
          accomplishments: profile.accomplishments || '',
          hourlyRate: profile.hourlyRate || '',
          preferredLocations: profile.preferredLocations || [],
        }
      : null
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Update account info if changed
      if (name !== user.name) {
        const result = await updateUserAccount({ name });
        if (!result.success) {
          setError(result.error || 'Failed to update account');
          setSaving(false);
          return;
        }
      }

      // Update profile based on role
      if (user.role === 'client' && athleteData) {
        const result = await updateAthleteProfile(athleteData);
        if (!result.success) {
          setError(result.error || 'Failed to update profile');
          setSaving(false);
          return;
        }
      } else if (user.role === 'coach' && coachData) {
        const result = await updateCoachProfile(coachData);
        if (!result.success) {
          setError(result.error || 'Failed to update profile');
          setSaving(false);
          return;
        }
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Account Section */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600">
              {user.email}
            </div>
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed for security reasons</p>
          </div>
        </div>
      </div>

      {/* Athlete Profile Section */}
      {user.role === 'client' && athleteData && (
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Athlete Profile</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                value={athleteData.fullName}
                onChange={(e) =>
                  setAthleteData({ ...athleteData, fullName: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                id="bio"
                rows={4}
                value={athleteData.bio}
                onChange={(e) =>
                  setAthleteData({ ...athleteData, bio: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                placeholder="Tell coaches about yourself..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  value={athleteData.location.city}
                  onChange={(e) =>
                    setAthleteData({
                      ...athleteData,
                      location: { ...athleteData.location, city: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  value={athleteData.location.state}
                  onChange={(e) =>
                    setAthleteData({
                      ...athleteData,
                      location: { ...athleteData.location, state: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sports Interested In
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {athleteData.sportsInterested.map((sport: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-[#FF6B4A] text-white rounded-full text-sm flex items-center gap-2"
                  >
                    {sport}
                    <button
                      type="button"
                      onClick={() =>
                        setAthleteData({
                          ...athleteData,
                          sportsInterested: athleteData.sportsInterested.filter(
                            (_: string, i: number) => i !== idx
                          ),
                        })
                      }
                      className="hover:text-gray-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="Add a sport..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    e.preventDefault();
                    setAthleteData({
                      ...athleteData,
                      sportsInterested: [
                        ...athleteData.sportsInterested,
                        e.currentTarget.value.trim(),
                      ],
                    });
                    e.currentTarget.value = '';
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Press Enter to add</p>
            </div>
          </div>
        </div>
      )}

      {/* Coach Profile Section */}
      {user.role === 'coach' && coachData && (
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Coach Profile</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="coachFullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="coachFullName"
                value={coachData.fullName}
                onChange={(e) =>
                  setCoachData({ ...coachData, fullName: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="coachBio" className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                id="coachBio"
                rows={4}
                value={coachData.bio}
                onChange={(e) =>
                  setCoachData({ ...coachData, bio: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                placeholder="Tell athletes about your coaching experience..."
              />
            </div>

            <div>
              <label htmlFor="introVideo" className="block text-sm font-medium text-gray-700 mb-1">
                Intro Video URL
              </label>
              <input
                type="url"
                id="introVideo"
                value={coachData.introVideo}
                onChange={(e) =>
                  setCoachData({ ...coachData, introVideo: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                placeholder="https://..."
              />
            </div>

            <div>
              <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700 mb-1">
                Hourly Rate ($)
              </label>
              <input
                type="number"
                id="hourlyRate"
                value={coachData.hourlyRate}
                onChange={(e) =>
                  setCoachData({ ...coachData, hourlyRate: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label htmlFor="coachState" className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                id="coachState"
                value={coachData.location.state}
                onChange={(e) =>
                  setCoachData({
                    ...coachData,
                    location: { ...coachData.location, state: e.target.value },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cities You Serve
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {coachData.location.cities.map((city: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-[#FF6B4A] text-white rounded-full text-sm flex items-center gap-2"
                  >
                    {city}
                    <button
                      type="button"
                      onClick={() =>
                        setCoachData({
                          ...coachData,
                          location: {
                            ...coachData.location,
                            cities: coachData.location.cities.filter((_: string, i: number) => i !== idx),
                          },
                        })
                      }
                      className="hover:text-gray-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="Add a city..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    e.preventDefault();
                    setCoachData({
                      ...coachData,
                      location: {
                        ...coachData.location,
                        cities: [...coachData.location.cities, e.currentTarget.value.trim()],
                      },
                    });
                    e.currentTarget.value = '';
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Press Enter to add</p>
            </div>

            <div>
              <label htmlFor="accomplishments" className="block text-sm font-medium text-gray-700 mb-1">
                Accomplishments
              </label>
              <textarea
                id="accomplishments"
                rows={3}
                value={coachData.accomplishments}
                onChange={(e) =>
                  setCoachData({ ...coachData, accomplishments: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
                placeholder="Notable achievements, awards, etc..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="mx-6 mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">Profile updated successfully!</p>
        </div>
      )}

      {/* Save Button */}
      <div className="p-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-8"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
