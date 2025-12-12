'use client';

import type { AthleteProfileData } from '@/actions/onboarding/athlete';
import { SPORTS, EXPERIENCE_LEVELS } from '@/lib/constants';

type Step2Props = {
  formData: AthleteProfileData;
  setFormData: (data: AthleteProfileData) => void;
};

const SPORTS_OPTIONS = SPORTS;

const EXPERIENCE_LEVELS_OPTIONS = EXPERIENCE_LEVELS;

export function Step2Sports({ formData, setFormData }: Step2Props) {
  const toggleSport = (sport: string) => {
    if (formData.sports.includes(sport)) {
      const newSports = formData.sports.filter(s => s !== sport);
      const newLevels = { ...formData.experienceLevels };
      delete newLevels[sport];
      setFormData({
        ...formData,
        sports: newSports,
        experienceLevels: newLevels,
      });
    } else {
      setFormData({
        ...formData,
        sports: [...formData.sports, sport],
      });
    }
  };

  const setExperienceLevel = (sport: string, level: string) => {
    setFormData({
      ...formData,
      experienceLevels: {
        ...formData.experienceLevels,
        [sport]: level,
      },
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">What sports are you interested in?</h2>
        <p className="mt-2 text-gray-600">
          Select all the sports you&apos;d like coaching in and your experience level for each.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-4">
          Select Sports <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SPORTS_OPTIONS.map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => toggleSport(sport)}
              className={`px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                formData.sports.includes(sport)
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md scale-105'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {sport}
            </button>
          ))}
        </div>
      </div>
      
      {formData.sports.length > 0 && (
        <div className="space-y-5">
          <label className="block text-sm font-semibold text-gray-900">
            Experience Levels <span className="text-red-500">*</span>
          </label>
          {formData.sports.map((sport) => (
            <div key={sport} className="border-2 border-gray-200 rounded-lg p-5 bg-gray-50">
              <p className="text-sm font-semibold text-gray-900 mb-3">{sport}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EXPERIENCE_LEVELS_OPTIONS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setExperienceLevel(sport, level)}
                    className={`px-3 py-2 rounded-md text-sm border-2 transition-all font-medium ${
                      formData.experienceLevels[sport] === level
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
