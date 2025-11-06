'use client';

import type { AthleteProfileData } from '@/actions/onboarding/athlete';

type Step4Props = {
  formData: AthleteProfileData;
  setFormData: (data: AthleteProfileData) => void;
};

export function Step4Bio({ formData, setFormData }: Step4Props) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Tell us your story</h2>
        <p className="mt-2 text-gray-600">
          Share a bit about yourself to help coaches understand your background and goals.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Bio (optional)
        </label>
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={8}
          className="block w-full rounded-lg border-2 border-gray-200 px-4 py-3 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-base resize-none"
          placeholder="Tell coaches about your sports background, what you're looking to improve, your goals, or what kind of coaching style works best for you..."
          maxLength={500}
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {(formData.bio || '').length}/500 characters
          </p>
          {(formData.bio || '').length > 450 && (
            <p className="text-xs text-orange-600 font-medium">
              {500 - (formData.bio || '').length} characters remaining
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-7 h-7 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-green-900">You're almost done!</h3>
            <p className="mt-1 text-sm text-green-800">
              Click "Complete Profile" to finish setting up your account. You'll be able to browse coaches and start booking sessions right away.
            </p>
          </div>
        </div>
      </div>

      {/* Preview Summary */}
      <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">
          Profile Summary
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Name:</span>
            <span className="font-semibold text-gray-900">{formData.fullName || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Location:</span>
            <span className="font-semibold text-gray-900">
              {formData.city && formData.state ? `${formData.city}, ${formData.state}` : 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Sports:</span>
            <span className="font-semibold text-gray-900">
              {formData.sports.length > 0 ? formData.sports.join(', ') : 'None selected'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Budget:</span>
            <span className="font-semibold text-gray-900">
              ${formData.budgetMin} - ${formData.budgetMax}/hr
            </span>
          </div>
          {formData.preferredTimes.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Availability:</span>
              <span className="font-semibold text-gray-900">
                {formData.preferredTimes.length} time slot{formData.preferredTimes.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
