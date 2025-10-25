'use client';

import { useState } from 'react';
import { UploadButton } from '@/lib/uploadthing';
import { toast } from 'sonner';
import type { AthleteProfileData } from '@/actions/onboarding/athlete';
import Image from 'next/image';

type Step1Props = {
  formData: AthleteProfileData;
  setFormData: (data: AthleteProfileData) => void;
  googleAvatar: string | null;
};

export function Step1BasicInfo({ formData, setFormData, googleAvatar }: Step1Props) {
  const [uploading, setUploading] = useState(false);
  
  // Use Google avatar as default if available and no custom photo uploaded
  const displayPhoto = formData.profilePhotoUrl || googleAvatar || null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Welcome! Let's get started</h2>
        <p className="mt-2 text-gray-600">
          Tell us about yourself so coaches can learn who you are.
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
          </div>

          {/* Upload Button */}
          <div className="flex-1">
            <UploadButton
              endpoint="profileImage"
              onClientUploadComplete={(res) => {
                if (res && res[0]) {
                  setFormData({ ...formData, profilePhotoUrl: res[0].url });
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
            />
            <p className="mt-2 text-xs text-gray-500">
              {googleAvatar 
                ? "We're using your Google profile photo. Upload a different one if you'd like!"
                : "Upload a clear photo of yourself. Max file size: 4MB."
              }
            </p>
            {uploading && (
              <p className="mt-2 text-sm text-blue-600 font-medium">Uploading...</p>
            )}
          </div>
        </div>
      </div>

      {/* Full Name */}
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

      {/* Location */}
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
