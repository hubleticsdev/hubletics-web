'use client';

import { useState } from 'react';
import { UploadButton } from '@/lib/uploadthing';
import { toast } from 'sonner';
import type { CoachProfileData } from '@/actions/onboarding/coach';
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

  // Use Google avatar as default if available and no custom photo uploaded
  const displayPhoto = formData.profilePhotoUrl || googleAvatar || null;

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
        <h2 className="text-3xl font-bold text-gray-900">Welcome! Let's get started</h2>
        <p className="mt-2 text-gray-600">
          Tell us about yourself so athletes can learn who you are.
        </p>
      </div>

      {/* Profile Photo Upload */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Profile Photo
        </label>
        <div className="flex items-start gap-6">
          {/* Avatar Preview */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-red-100 border-2 border-orange-200 flex items-center justify-center">
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
          </div>

          {/* Upload Button */}
          <div className="flex-1">
            <UploadButton
              endpoint="profileImage"
              onClientUploadComplete={(res) => {
                if (res?.[0]?.url) {
                  setFormData({ ...formData, profilePhotoUrl: res[0].url });
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
            />
            <p className="text-xs text-gray-500 mt-2">
              {googleAvatar && !formData.profilePhotoUrl
                ? 'Using your Google profile photo. Upload a new one to replace it.'
                : 'Recommended: 500x500px, max 4MB'}
            </p>
          </div>
        </div>
      </div>

      {/* Intro Video Upload - REQUIRED */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Intro Video <span className="text-red-500">*</span>
        </label>
        <div className="space-y-3">
          {formData.introVideoUrl && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 truncate">Video uploaded successfully!</p>
                <p className="text-xs text-green-600 truncate">{formData.introVideoUrl}</p>
              </div>
            </div>
          )}
          <UploadButton
            endpoint="coachIntroVideo"
            onClientUploadComplete={(res) => {
              if (res?.[0]?.url) {
                setFormData({ ...formData, introVideoUrl: res[0].url });
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
          />
          <p className="text-xs text-gray-500">
            Record a 30-60 second intro about yourself and your coaching style. Max 64MB.
          </p>
        </div>
      </div>

      {/* Full Name */}
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

      {/* Cities (Multiple) */}
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
              className="px-6 py-3 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
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

      {/* State */}
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

