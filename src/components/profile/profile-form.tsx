'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { AthleteProfile, CoachProfile } from '@/lib/db/schema';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { updateUserAccount, updateAthleteProfile, updateCoachProfile } from '@/actions/profile/update';
import { checkUsernameAvailability } from '@/actions/auth/validate-username';
import { UploadButton } from '@/lib/uploadthing';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  image: string | null;
  role: 'client' | 'coach' | 'admin' | 'pending';
}

interface AthleteFormData {
  fullName: string;
  profilePhoto: string;
  location: { city: string; state: string };
  sportsInterested: string[];
  experienceLevel: Record<string, { level: string; notes?: string }>;
  budgetRange: { min: number; max: number } | { single: number };
  availability: Record<string, Array<{ start: string; end: string }>>;
  bio: string;
}

interface CoachFormData {
  fullName: string;
  profilePhoto: string;
  introVideo: string;
  location: { cities: string[]; state: string };
  specialties: Array<{ sport: string; tags: string[] }>;
  bio: string;
  certifications: Array<{
    name: string;
    org: string;
    issueDate: string;
    expDate?: string;
    fileUrl: string;
  }>;
  accomplishments: string;
  hourlyRate: string;
  preferredLocations: Array<{ name: string; address: string; notes?: string }>;
  groupBookingsEnabled: boolean;
  allowPrivateGroups: boolean;
  allowPublicGroups: boolean;
}

interface ProfileFormProps {
  user: User;
  profile: AthleteProfile | CoachProfile;
}

export function ProfileForm({ user, profile }: ProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState(false);

  useEffect(() => {
    if (username === user.username) {
      setUsernameError(null);
      setUsernameAvailable(false);
      return;
    }

    if (!username || username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      setUsernameAvailable(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setUsernameChecking(true);
      const result = await checkUsernameAvailability(username);
      setUsernameChecking(false);
      
      if (result.available) {
        setUsernameError(null);
        setUsernameAvailable(true);
      } else {
        setUsernameError(result.error || 'Username unavailable');
        setUsernameAvailable(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, user.username]);

  const [athleteData, setAthleteData] = useState<AthleteFormData | null>(
    user.role === 'client' && profile
      ? {
          fullName: (profile as AthleteProfile).fullName || '',
          profilePhoto: (profile as AthleteProfile).profilePhoto || '',
          location: (profile as AthleteProfile).location || { city: '', state: '' },
          sportsInterested: (profile as AthleteProfile).sportsInterested || [],
          experienceLevel: (profile as AthleteProfile).experienceLevel || {},
          budgetRange: (profile as AthleteProfile).budgetRange || { min: 0, max: 0 },
          availability: (profile as AthleteProfile).availability || {},
          bio: (profile as AthleteProfile).bio || '',
        }
      : null
  );

  const [coachData, setCoachData] = useState<CoachFormData | null>(
    user.role === 'coach' && profile
      ? {
          fullName: (profile as CoachProfile).fullName || '',
          profilePhoto: (profile as CoachProfile).profilePhoto || '',
          introVideo: (profile as CoachProfile).introVideo || '',
          location: (profile as CoachProfile).location || { cities: [], state: '' },
          specialties: (profile as CoachProfile).specialties || [],
          bio: (profile as CoachProfile).bio || '',
          certifications: (profile as CoachProfile).certifications || [],
          accomplishments: (profile as CoachProfile).accomplishments || '',
          hourlyRate: (profile as CoachProfile).hourlyRate?.toString() || '',
          preferredLocations: (profile as CoachProfile).preferredLocations || [],
          groupBookingsEnabled: (profile as CoachProfile).groupBookingsEnabled || false,
          allowPrivateGroups: (profile as CoachProfile).allowPrivateGroups || false,
          allowPublicGroups: (profile as CoachProfile).allowPublicGroups || false,
        }
      : null
  );

  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationForm, setLocationForm] = useState<{
    name: string;
    address: string;
    notes: string;
  }>({
    name: '',
    address: '',
    notes: '',
  });
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);

  const openLocationDialog = (index?: number) => {
    if (index !== undefined && coachData) {
      const location = coachData.preferredLocations[index];
      setLocationForm({
        name: location.name,
        address: location.address,
        notes: location.notes || '',
      });
      setEditingLocationIndex(index);
    } else {
      setLocationForm({ name: '', address: '', notes: '' });
      setEditingLocationIndex(null);
    }
    setLocationDialogOpen(true);
  };

  const saveLocation = () => {
    if (!locationForm.name.trim() || !locationForm.address.trim()) {
      return;
    }

    if (!coachData) return;

    const newLocation = {
      name: locationForm.name.trim(),
      address: locationForm.address.trim(),
      notes: locationForm.notes.trim(),
    };

    if (editingLocationIndex !== null) {
      const updatedLocations = [...coachData.preferredLocations];
      updatedLocations[editingLocationIndex] = newLocation;
      setCoachData({ ...coachData, preferredLocations: updatedLocations });
    } else {
      setCoachData({
        ...coachData,
        preferredLocations: [...coachData.preferredLocations, newLocation],
      });
    }

    setLocationDialogOpen(false);
    setLocationForm({ name: '', address: '', notes: '' });
    setEditingLocationIndex(null);
  };

  const handleSave = async () => {
    if (username !== user.username && (usernameError || !usernameAvailable)) {
      setError('Please fix username errors before saving');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (name !== user.name || username !== user.username) {
        const result = await updateUserAccount({ name, username });
        if (!result.success) {
          setError(result.error || 'Failed to update account');
          setSaving(false);
          return;
        }
      }

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
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
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
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span className="text-gray-500">@</span>
              </div>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                  setUsername(value);
                }}
                className={`w-full px-4 py-2 pl-8 border rounded-lg focus:ring-2 focus:border-transparent ${
                  usernameError
                    ? 'border-red-500 focus:ring-red-500'
                    : usernameAvailable && username !== user.username
                    ? 'border-green-500 focus:ring-green-500'
                    : 'border-gray-300 focus:ring-[#FF6B4A]'
                }`}
                maxLength={30}
              />
              {usernameChecking && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#FF6B4A] border-t-transparent"></div>
                </div>
              )}
              {!usernameChecking && usernameAvailable && username !== user.username && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            {usernameError && (
              <p className="text-xs text-red-600 mt-1">{usernameError}</p>
            )}
            {!usernameError && usernameAvailable && username !== user.username && (
              <p className="text-xs text-green-600 mt-1">Username is available!</p>
            )}
            <p className="text-xs text-gray-500 mt-1">3-30 characters. Letters, numbers, underscores, and hyphens only.</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Intro Video
              </label>
              {coachData.introVideo ? (
                <div className="space-y-3">
                  <div className="relative border-2 border-green-200 rounded-lg overflow-hidden bg-black">
                    <video
                      src={coachData.introVideo}
                      controls
                      className="w-full max-h-96 object-contain"
                    >
                      Your browser does not support the video tag.
                    </video>
                    <button
                      type="button"
                      onClick={() => {
                        setCoachData({ ...coachData, introVideo: '' });
                        toast.success('Video removed. Upload a new one below.');
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                      title="Remove video"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <div className="absolute bottom-2 left-2 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-full flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Video uploaded
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Upload a new video to replace the current one
                  </div>
                </div>
              ) : null}
              <div className="mt-2">
                <UploadButton
                  endpoint="coachIntroVideo"
                  onClientUploadComplete={async (res) => {
                    if (res?.[0]?.url) {
                      setCoachData({ ...coachData, introVideo: res[0].url });
                      toast.success('Intro video uploaded!');
                    }
                  }}
                  onUploadError={(error: Error) => {
                    toast.error(`Upload failed: ${error.message}`);
                  }}
                  appearance={{
                    button:
                      'ut-ready:bg-gradient-to-r ut-ready:from-[#FF6B4A] ut-ready:to-[#FF8C5A] ut-uploading:cursor-not-allowed ut-ready:cursor-pointer ut-uploading:bg-gray-400 ut-button:text-white ut-button:font-semibold ut-button:rounded-lg ut-button:px-4 ut-button:py-2',
                    container: 'flex items-center',
                    allowedContent: 'text-xs text-gray-500 mt-2',
                  }}
                  content={{
                    button({ ready, isUploading }) {
                      if (isUploading) return 'Uploading...';
                      if (ready) return coachData.introVideo ? 'Replace Video' : 'Upload Video';
                      return 'Getting ready...';
                    },
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Recommended: MP4 format, max 64MB. Your old video will be automatically deleted when you upload a new one.
              </p>
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

            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferred Training Locations</h3>
              <p className="text-sm text-gray-600 mb-4">
                Add the locations where you typically train clients. Athletes will see these as options when booking.
              </p>

              {coachData.preferredLocations.length > 0 && (
                <div className="space-y-3 mb-4">
                  {coachData.preferredLocations.map((location: { name: string; address: string; notes?: string }, index: number) => (
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
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => openLocationDialog(index)}
                          className="text-gray-500 hover:text-[#FF6B4A] transition-colors p-1"
                          title="Edit location"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCoachData({
                              ...coachData,
                              preferredLocations: coachData.preferredLocations.filter((_: unknown, i: number) => i !== index),
                            });
                          }}
                          className="text-red-500 hover:text-red-700 transition-colors p-1"
                          title="Delete location"
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
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => openLocationDialog()}
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
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Booking Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="groupBookingsEnabled"
                    checked={coachData.groupBookingsEnabled}
                    onChange={(e) =>
                      setCoachData({ ...coachData, groupBookingsEnabled: e.target.checked })
                    }
                    className="w-4 h-4 text-[#FF6B4A] border-gray-300 rounded focus:ring-[#FF6B4A]"
                  />
                  <label htmlFor="groupBookingsEnabled" className="text-sm font-medium text-gray-900">
                    Enable Group Bookings
                  </label>
                </div>

                {coachData.groupBookingsEnabled && (
                  <>
                    <div className="ml-7 space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="allowPrivateGroups"
                          checked={coachData.allowPrivateGroups}
                          onChange={(e) =>
                            setCoachData({ ...coachData, allowPrivateGroups: e.target.checked })
                          }
                          className="w-4 h-4 text-[#FF6B4A] border-gray-300 rounded focus:ring-[#FF6B4A]"
                        />
                        <label htmlFor="allowPrivateGroups" className="text-sm text-gray-700">
                          Allow Private Group Lessons (client books for multiple people)
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="allowPublicGroups"
                          checked={coachData.allowPublicGroups}
                          onChange={(e) =>
                            setCoachData({ ...coachData, allowPublicGroups: e.target.checked })
                          }
                          className="w-4 h-4 text-[#FF6B4A] border-gray-300 rounded focus:ring-[#FF6B4A]"
                        />
                        <label htmlFor="allowPublicGroups" className="text-sm text-gray-700">
                          Allow Public Group Lessons (you create open lessons)
                        </label>
                      </div>
                    </div>

                    {coachData.allowPrivateGroups && (
                      <div className="ml-7 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-gray-700 mb-2">
                          ⚙️ <strong>Next step:</strong> Configure your pricing tiers for private groups
                        </p>
                        <a
                          href="/dashboard/group-pricing"
                          className="text-sm text-[#FF6B4A] hover:underline font-medium"
                        >
                          Set up pricing tiers →
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      <div className="p-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-8"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingLocationIndex !== null ? 'Edit Location' : 'Add Location'}
            </DialogTitle>
            <DialogDescription>
              Add a location where you train clients. Athletes will choose from these when booking.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="location-name" className="text-sm font-medium text-gray-900">
                Location Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="location-name"
                placeholder="e.g., Central Park Tennis Courts"
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="location-address" className="text-sm font-medium text-gray-900">
                Address <span className="text-red-500">*</span>
              </label>
              <Input
                id="location-address"
                placeholder="e.g., Central Park, New York, NY 10019"
                value={locationForm.address}
                onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="location-notes" className="text-sm font-medium text-gray-900">
                Notes (Optional)
              </label>
              <Textarea
                id="location-notes"
                placeholder="e.g., Meet at the south entrance near the fountain"
                value={locationForm.notes}
                onChange={(e) => setLocationForm({ ...locationForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLocationDialogOpen(false);
                setLocationForm({ name: '', address: '', notes: '' });
                setEditingLocationIndex(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveLocation}
              disabled={!locationForm.name.trim() || !locationForm.address.trim()}
            >
              {editingLocationIndex !== null ? 'Update' : 'Add'} Location
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
