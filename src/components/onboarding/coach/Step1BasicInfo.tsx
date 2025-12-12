'use client';

import { useState, useEffect } from 'react';
import { UploadButton } from '@/lib/uploadthing';
import { toast } from 'sonner';
import type { CoachProfileData } from '@/actions/onboarding/coach';
import { saveTempPhoto, saveTempVideo } from '@/actions/onboarding/save-temp-files';
import { checkUsernameAvailability } from '@/actions/auth/validate-username';
import { generateUsernameFromName } from '@/lib/validations';
import Image from 'next/image';

type Step1Props = {
  formData: CoachProfileData;
  setFormData: (data: CoachProfileData) => void;
  googleAvatar: string | null;
};

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export function Step1BasicInfo({ formData, setFormData, googleAvatar }: Step1Props) {
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [newCity, setNewCity] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState(false);

  const displayPhoto = formData.profilePhotoUrl || googleAvatar || null;

  useEffect(() => {
    if (formData.fullName && !formData.username) {
      const suggested = generateUsernameFromName(formData.fullName);
      setFormData({ ...formData, username: suggested });
    }
  }, [formData.fullName]);

  useEffect(() => {
    if (!formData.username || formData.username.length < 3) {
      setUsernameError(null);
      setUsernameAvailable(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setUsernameChecking(true);
      const result = await checkUsernameAvailability(formData.username);
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
  }, [formData.username]);

  const addCity = () => {
    const trimmedCity = newCity.trim();
    if (!trimmedCity) {
      toast.error('Please enter a city name');
      return;
    }
    if (formData.cities.includes(trimmedCity)) {
      toast.error('City already added');
      return;
    }
    setFormData({
      ...formData,
      cities: [...formData.cities, trimmedCity],
    });
    setNewCity('');
  };

  const removeCity = (cityToRemove: string) => {
    setFormData({
      ...formData,
      cities: formData.cities.filter((city) => city !== cityToRemove),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Welcome! Let&apos;s get started</h2>
        <p className="mt-2 text-gray-600">
          Tell us about yourself so athletes can learn who you are.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Profile Photo
        </label>
        <div className="flex items-start gap-6">
          <div className="shrink-0 relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-linear-to-br from-orange-100 to-red-100 border-2 border-orange-200 flex items-center justify-center">
              {displayPhoto ? (
                <Image
                  src={displayPhoto}
                  alt="Profile"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg
                  className="w-12 h-12 text-orange-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            {formData.profilePhotoUrl && (
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, profilePhotoUrl: '' });
                  toast.success('Photo removed. Upload a new one below.');
                }}
                className="absolute -top-1 -right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
                title="Remove photo"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="flex-1">
            {uploadingPhoto ? (
              <div className="flex items-center gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent"></div>
                <span className="text-sm font-medium text-orange-700">Uploading photo...</span>
              </div>
            ) : (
              <UploadButton
                endpoint="profileImage"
                onClientUploadComplete={async (res) => {
                  if (res?.[0]?.url) {
                    setFormData({ ...formData, profilePhotoUrl: res[0].url });
                    await saveTempPhoto(res[0].url);
                    toast.success('Profile photo uploaded!');
                  }
                  setUploadingPhoto(false);
                }}
                onUploadError={(error: Error) => {
                  toast.error(`Upload failed: ${error.message}`);
                  setUploadingPhoto(false);
                }}
                onUploadBegin={() => setUploadingPhoto(true)}
                disabled={uploadingPhoto}
                appearance={{
                  button:
                    'ut-ready:bg-gradient-to-r ut-ready:from-[#FF6B4A] ut-ready:to-[#FF8C5A] ut-uploading:cursor-not-allowed ut-ready:cursor-pointer ut-uploading:bg-gray-400 ut-button:text-white ut-button:font-semibold ut-button:rounded-lg ut-button:px-4 ut-button:py-2',
                  container: 'flex items-center',
                  allowedContent: 'text-xs text-gray-500 mt-2',
                }}
                content={{
                  button({ ready, isUploading }) {
                    if (isUploading) return 'Uploading...';
                    if (ready) return formData.profilePhotoUrl ? 'Change Photo' : 'Upload Photo';
                    return 'Getting ready...';
                  },
                }}
              />
            )}
            <p className="text-xs text-gray-500 mt-2">
              {googleAvatar && !formData.profilePhotoUrl
                ? 'Using your Google profile photo. Upload a new one to replace it.'
                : 'Recommended: 500x500px, max 4MB'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Intro Video <span className="text-red-500">*</span>
        </label>
        <div className="space-y-3">
          {formData.introVideoUrl ? (
            <div className="relative border-2 border-green-200 rounded-lg overflow-hidden bg-black">
              <video
                src={formData.introVideoUrl}
                controls
                className="w-full max-h-96 object-contain"
              >
                Your browser does not support the video tag.
              </video>
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, introVideoUrl: '' });
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
          ) : (
            <>
              <UploadButton
                endpoint="coachIntroVideo"
                onClientUploadComplete={async (res) => {
                  if (res?.[0]?.url) {
                    setFormData({ ...formData, introVideoUrl: res[0].url });
                    await saveTempVideo(res[0].url);
                    toast.success('Intro video uploaded!');
                  }
                  setUploadingVideo(false);
                }}
                onUploadError={(error: Error) => {
                  toast.error(`Upload failed: ${error.message}`);
                  setUploadingVideo(false);
                }}
                onUploadBegin={() => setUploadingVideo(true)}
                disabled={uploadingVideo}
                appearance={{
                  button:
                    'ut-ready:bg-gradient-to-r ut-ready:from-[#FF6B4A] ut-ready:to-[#FF8C5A] ut-uploading:cursor-not-allowed ut-ready:cursor-pointer ut-uploading:bg-gray-400 ut-button:text-white ut-button:font-semibold ut-button:rounded-lg ut-button:px-4 ut-button:py-2',
                  container: 'flex items-center',
                  allowedContent: 'text-xs text-gray-500 mt-2',
                }}
                content={{
                  button({ ready, isUploading }) {
                    if (isUploading) return 'Uploading...';
                    if (ready) return 'Upload Video';
                    return 'Getting ready...';
                  },
                }}
              />
              <p className="text-xs text-gray-500">
                Record a 30-60 second intro about yourself and your coaching style. Max 64MB.
              </p>
            </>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="fullName" className="block text-sm font-semibold text-gray-900 mb-2">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          id="fullName"
          type="text"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
          placeholder="e.g., John Smith"
        />
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-semibold text-gray-900 mb-2">
          Username <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <span className="text-gray-500 text-base">@</span>
          </div>
          <input
            id="username"
            type="text"
            value={formData.username}
            onChange={(e) => {
              const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
              setFormData({ ...formData, username: value });
            }}
            className={`block w-full rounded-lg border-2 px-4 py-3 pl-8 shadow-sm transition-colors focus:outline-none focus:ring-2 text-base ${
              usernameError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : usernameAvailable
                ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                : 'border-gray-200 focus:border-[#FF6B4A] focus:ring-[#FF6B4A]/20'
            }`}
            placeholder="your_username"
            maxLength={30}
          />
          {usernameChecking && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#FF6B4A] border-t-transparent"></div>
            </div>
          )}
          {!usernameChecking && usernameAvailable && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
              <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        {usernameError && (
          <p className="mt-1 text-sm text-red-600">{usernameError}</p>
        )}
        {!usernameError && usernameAvailable && (
          <p className="mt-1 text-sm text-green-600">Username is available!</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          3-30 characters. Letters, numbers, underscores, and hyphens only.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Cities You Serve <span className="text-red-500">*</span>
        </label>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCity();
                }
              }}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
              placeholder="e.g., Los Angeles"
            />
            <button
              type="button"
              onClick={addCity}
              className="px-6 py-3 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              Add
            </button>
          </div>
          {formData.cities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.cities.map((city) => (
                <div
                  key={city}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium"
                >
                  {city}
                  <button
                    type="button"
                    onClick={() => removeCity(city)}
                    className="hover:text-orange-900"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500">
            Add all cities where you offer coaching services
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="state" className="block text-sm font-semibold text-gray-900 mb-2">
          State <span className="text-red-500">*</span>
        </label>
        <select
          id="state"
          value={formData.state}
          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors bg-white"
        >
          <option value="">Select a state</option>
          {US_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

