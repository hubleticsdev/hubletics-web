'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createAthleteProfile, type AthleteProfileData } from '@/actions/onboarding/athlete';
import { Step1BasicInfo } from './Step1BasicInfo';
import { Step2Sports } from './Step2Sports';
import { Step3Budget } from './Step3Budget';
import { Step4Bio } from './Step4Bio';

type OnboardingWizardProps = {
  initialName: string;
  googleAvatar: string | null;
  savedPhotoUrl: string | null;
};

export function OnboardingWizard({ initialName, googleAvatar, savedPhotoUrl }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<AthleteProfileData>({
    username: '',
    fullName: initialName || '',
    city: '',
    state: '',
    profilePhotoUrl: savedPhotoUrl,
    sports: [],
    experienceLevels: {},
    notes: '',
    budgetMin: 30,
    budgetMax: 100,
    preferredTimes: [],
    bio: '',
  });

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.username || !formData.fullName || !formData.city || !formData.state) {
        toast.error('Please fill in all required fields');
        return;
      }
      if (formData.username.length < 3) {
        toast.error('Username must be at least 3 characters');
        return;
      }
    } else if (currentStep === 2) {
      if (formData.sports.length === 0) {
        toast.error('Please select at least one sport');
        return;
      }
      for (const sport of formData.sports) {
        if (!formData.experienceLevels[sport]) {
          toast.error(`Please select an experience level for ${sport}`);
          return;
        }
      }
    } else if (currentStep === 3) {
      if (formData.budgetMin <= 0 || formData.budgetMax <= 0) {
        toast.error('Please enter a valid budget range');
        return;
      }
      if (formData.budgetMin > formData.budgetMax) {
        toast.error('Minimum budget cannot be greater than maximum budget');
        return;
      }
    }

    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (loading) return;
    
    setLoading(true);

    try {
      const result = await createAthleteProfile(formData);

      if (result.alreadyExists) {
        toast.info('Profile already exists! Redirecting...');
      } else {
        toast.success('Profile created successfully!');
      }

      setTimeout(() => {
        window.location.href = '/dashboard/athlete';
      }, 500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50/30 py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Your Athlete Profile</h1>
              <p className="text-sm text-gray-600 mt-1">
                Step {currentStep} of 4
              </p>
            </div>
            <span className="text-sm font-semibold text-[#FF6B4A]">
              {Math.round((currentStep / 4) * 100)}% Complete
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] transition-all duration-500 ease-out rounded-full shadow-sm"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          {currentStep === 1 && (
            <Step1BasicInfo formData={formData} setFormData={setFormData} googleAvatar={googleAvatar} />
          )}

          {currentStep === 2 && (
            <Step2Sports formData={formData} setFormData={setFormData} />
          )}

          {currentStep === 3 && (
            <Step3Budget formData={formData} setFormData={setFormData} />
          )}

          {currentStep === 4 && (
            <Step4Bio formData={formData} setFormData={setFormData} />
          )}

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
              {currentStep < 4 ? (
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
