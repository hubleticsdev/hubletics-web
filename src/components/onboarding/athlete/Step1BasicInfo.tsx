'use client';

import { useState, useEffect, useCallback } from 'react';
import { UploadButton } from '@/lib/uploadthing';
import { toast } from 'sonner';
import type { AthleteProfileData } from '@/actions/onboarding/athlete';
import { saveTempPhoto } from '@/actions/onboarding/save-temp-files';
import { checkUsernameAvailability } from '@/actions/auth/validate-username';
import { generateUsernameFromName } from '@/lib/validations';
import Image from 'next/image';

type Step1Props = {
  formData: AthleteProfileData;
  setFormData: (data: AthleteProfileData) => void;
  googleAvatar: string | null;
};

export function Step1BasicInfo({ formData, setFormData, googleAvatar }: Step1Props) {
  const [uploading, setUploading] = useState(false);
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Welcome! Let's get started</h2>
        <p className="mt-2 text-gray-600">
          Tell us about yourself so coaches can learn who you are.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Profile Photo
        </label>
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0 relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-200 flex items-center justify-center">
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
                  className="w-12 h-12 text-blue-400"
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
            {uploading ? (
              <div className="flex items-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-sm font-medium text-blue-700">Uploading photo...</span>
              </div>
            ) : (
              <UploadButton
                endpoint="profileImage"
                onClientUploadComplete={async (res) => {
                  if (res && res[0]) {
                    setFormData({ ...formData, profilePhotoUrl: res[0].url });
                    await saveTempPhoto(res[0].url);
                    toast.success('Profile photo uploaded!');
                    setUploading(false);
                  }
                }}
                onUploadError={(error: Error) => {
                  toast.error(`Upload failed: ${error.message}`);
                  setUploading(false);
                }}
                onUploadBegin={() => {
                  setUploading(true);
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
                    if (ready) return formData.profilePhotoUrl ? 'Change Photo' : 'Upload Photo';
                    return 'Getting ready...';
                  },
                }}
              />
            )}
            <p className="mt-2 text-xs text-gray-500">
              {googleAvatar && !formData.profilePhotoUrl
                ? "We're using your Google profile photo. Upload a different one if you'd like!"
                : "Upload a clear photo of yourself. Max file size: 4MB."
              }
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          className="block w-full rounded-lg border-2 border-gray-200 px-4 py-3 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-base"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Username <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <span className="text-gray-500 text-base">@</span>
          </div>
          <input
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
                : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
            }`}
            placeholder="your_username"
            maxLength={30}
          />
          {usernameChecking && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="block w-full rounded-lg border-2 border-gray-200 px-4 py-3 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-base"
            placeholder="Wichita"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            State <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
            className="block w-full rounded-lg border-2 border-gray-200 px-4 py-3 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-base uppercase"
            placeholder="KS"
            maxLength={2}
          />
        </div>
      </div>
    </div>
  );
}
