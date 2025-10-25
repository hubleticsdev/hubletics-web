'use client';

import type { CoachProfileData } from '@/actions/onboarding/coach';

type Step4Props = {
  formData: CoachProfileData;
  setFormData: (data: CoachProfileData) => void;
};

export function Step4Bio({ formData, setFormData }: Step4Props) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Tell Your Story</h2>
        <p className="mt-2 text-gray-600">
          Share your coaching philosophy, experience, and what makes you unique.
        </p>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="block text-sm font-semibold text-gray-900 mb-2">
          Bio <span className="text-red-500">*</span>
        </label>
        <textarea
          id="bio"
          rows={8}
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors resize-none"
          placeholder="Tell athletes about your coaching experience, philosophy, and approach. What makes you unique as a coach? What should athletes know about training with you?"
        />
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-gray-500">
            Write at least 100 characters to help athletes understand your coaching style.
          </p>
          <p className="text-xs text-gray-500">
            {formData.bio.length} characters
          </p>
        </div>
      </div>

      {/* Accomplishments */}
      <div>
        <label htmlFor="accomplishments" className="block text-sm font-semibold text-gray-900 mb-2">
          Notable Accomplishments (Optional)
        </label>
        <textarea
          id="accomplishments"
          rows={6}
          value={formData.accomplishments}
          onChange={(e) => setFormData({ ...formData, accomplishments: e.target.value })}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors resize-none"
          placeholder="List any notable achievements, awards, competitions won, or athletes you've coached to success. This helps build credibility.&#10;&#10;Examples:&#10;• Coached 15+ athletes to state championships&#10;• Former D1 college athlete&#10;• 10+ years of professional coaching experience&#10;• Certified strength and conditioning specialist"
        />
        <p className="text-xs text-gray-500 mt-2">
          Highlight your most impressive achievements to stand out to potential clients.
        </p>
      </div>

      {/* Preview Card */}
      {formData.bio && (
        <div className="mt-8 p-6 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-100 rounded-lg">
          <h3 className="text-sm font-semibold text-orange-900 mb-3">Profile Preview</h3>
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-bold text-gray-900 mb-2">{formData.fullName}</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{formData.bio}</p>
            {formData.accomplishments && (
              <>
                <h5 className="font-semibold text-gray-900 mt-4 mb-2">Accomplishments</h5>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {formData.accomplishments}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

