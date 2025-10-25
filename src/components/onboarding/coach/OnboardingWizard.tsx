'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createCoachProfile, type CoachProfileData } from '@/actions/onboarding/coach';
import { Step1BasicInfo } from './Step1BasicInfo';
import { Step2Specialties } from './Step2Specialties';
import { Step3Certifications } from './Step3Certifications';
import { Step4Bio } from './Step4Bio';
import { Step5Rates } from './Step5Rates';

type OnboardingWizardProps = {
  initialName: string;
  googleAvatar: string | null;
};

export function OnboardingWizard({ initialName, googleAvatar }: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<CoachProfileData>({
    fullName: initialName || '',
    profilePhotoUrl: null,
    introVideoUrl: '',
    cities: [],
    state: '',
    specialties: [],
    bio: '',
    accomplishments: '',
    certifications: [],
    hourlyRate: 50,
    sessionDuration: 60,
    weeklyAvailability: {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    },
    preferredLocations: [],
  });

  const handleNext = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      if (!formData.fullName.trim()) {
        toast.error('Please enter your full name');
        return;
      }
      if (!formData.introVideoUrl) {
        toast.error('Please upload an intro video');
        return;
      }
      if (formData.cities.length === 0) {
        toast.error('Please select at least one city');
        return;
      }
      if (!formData.state) {
        toast.error('Please select a state');
        return;
      }
    }

    if (currentStep === 2) {
      if (formData.specialties.length === 0) {
        toast.error('Please select at least one sport specialty');
        return;
      }
      // Validate each specialty has at least one tag
      for (const specialty of formData.specialties) {
        if (specialty.tags.length === 0) {
          toast.error(`Please add at least one tag for ${specialty.sport}`);
          return;
        }
      }
    }

    // Step 3 (Certifications) is optional, can skip

    if (currentStep === 4) {
      if (!formData.bio.trim()) {
        toast.error('Please write a bio');
        return;
      }
    }

    if (currentStep === 5) {
      if (formData.hourlyRate <= 0) {
        toast.error('Please set a valid hourly rate');
        return;
      }
      // Check if at least one availability slot is set
      const hasAvailability = Object.values(formData.weeklyAvailability).some(
        (slots) => slots.length > 0
      );
      if (!hasAvailability) {
        toast.error('Please set at least one availability slot');
        return;
      }
    }

    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    // Prevent double-submit
    if (loading) return;

    setLoading(true);

    try {
      const result = await createCoachProfile(formData);

      if (result.alreadyExists) {
        toast.info('Profile already exists! Redirecting...');
      } else {
        toast.success('Profile created successfully! Awaiting admin approval...');
      }

      // Redirect to dashboard
      router.push('/dashboard/coach');
      router.refresh();
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50/30 py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Your Coach Profile</h1>
              <p className="text-sm text-gray-600 mt-1">
                Step {currentStep} of 5
              </p>
            </div>
            <span className="text-sm font-semibold text-[#FF6B4A]">
              {Math.round((currentStep / 5) * 100)}% Complete
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] transition-all duration-500 ease-out rounded-full shadow-sm"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          {currentStep === 1 && (
            <Step1BasicInfo formData={formData} setFormData={setFormData} googleAvatar={googleAvatar} />
          )}

          {currentStep === 2 && (
            <Step2Specialties formData={formData} setFormData={setFormData} />
          )}

          {currentStep === 3 && (
            <Step3Certifications formData={formData} setFormData={setFormData} />
          )}

          {currentStep === 4 && (
            <Step4Bio formData={formData} setFormData={setFormData} />
          )}

          {currentStep === 5 && (
            <Step5Rates formData={formData} setFormData={setFormData} />
          )}

          {/* Navigation buttons */}
          <div className="mt-10 flex items-center justify-between pt-6 border-t border-gray-200">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="px-6 py-2 bg-white text-gray-700 font-medium rounded-lg border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Back
                </button>
              )}
            </div>
            <div>
              {currentStep < 5 ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-2 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                >
                  Continue →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? 'Creating Profile...' : 'Complete Profile ✓'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

