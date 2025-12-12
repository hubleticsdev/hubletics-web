'use client';

import type { AthleteProfileData } from '@/actions/onboarding/athlete';

type Step3Props = {
  formData: AthleteProfileData;
  setFormData: (data: AthleteProfileData) => void;
};

const TIME_SLOTS = [
  'Weekday Mornings',
  'Weekday Afternoons',
  'Weekday Evenings',
  'Weekend Mornings',
  'Weekend Afternoons',
  'Weekend Evenings',
];

export function Step3Budget({ formData, setFormData }: Step3Props) {
  const toggleTimeSlot = (time: string) => {
    if (formData.preferredTimes.includes(time)) {
      setFormData({
        ...formData,
        preferredTimes: formData.preferredTimes.filter(t => t !== time),
      });
    } else {
      setFormData({
        ...formData,
        preferredTimes: [...formData.preferredTimes, time],
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Budget & Availability</h2>
        <p className="mt-2 text-gray-600">
          Help coaches understand your budget and when you&apos;re typically available for training.
        </p>
      </div>

      {/* Budget Range */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-4">
          Hourly Budget Range <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Minimum ($/hr)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                $
              </span>
              <input
                type="number"
                value={formData.budgetMin}
                onChange={(e) => setFormData({ ...formData, budgetMin: parseInt(e.target.value) || 0 })}
                className="block w-full pl-8 pr-4 py-3 rounded-lg border-2 border-gray-200 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-base font-semibold"
                min="1"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Maximum ($/hr)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                $
              </span>
              <input
                type="number"
                value={formData.budgetMax}
                onChange={(e) => setFormData({ ...formData, budgetMax: parseInt(e.target.value) || 0 })}
                className="block w-full pl-8 pr-4 py-3 rounded-lg border-2 border-gray-200 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-base font-semibold"
                min="1"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Your budget range:</span> ${formData.budgetMin} - ${formData.budgetMax} per hour
          </p>
          <p className="text-xs text-blue-700 mt-1">
            This helps match you with coaches in your price range
          </p>
        </div>
      </div>

      {/* Preferred Times */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Preferred Training Times (optional)
        </label>
        <p className="text-sm text-gray-600 mb-4">
          Select general time preferences to help coaches understand your availability.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TIME_SLOTS.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => toggleTimeSlot(time)}
              className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                formData.preferredTimes.includes(time)
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
        {formData.preferredTimes.length > 0 && (
          <p className="mt-3 text-sm text-gray-600">
            Selected {formData.preferredTimes.length} time slot{formData.preferredTimes.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
