'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { setUserRole } from '@/actions/auth/set-role';
import { motion } from 'framer-motion';

export default function SelectRolePage() {
  const [selectedRole, setSelectedRole] = useState<'client' | 'coach' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }

    setLoading(true);

    try {
      const result = await setUserRole(selectedRole);

      if (!result.success) {
        toast.error(result.error || 'Failed to set role');
        setLoading(false);
        return;
      }

      toast.success('Role set successfully! Redirecting...');

      setTimeout(() => {
        window.location.href = '/auth/signin';
      }, 500);
    } catch (error) {
      console.error('Set role error:', error);
      toast.error('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-50 via-white to-orange-50/30 px-4 py-24">
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-linear-to-br from-[#FF6B4A] to-[#FF8C5A] rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Welcome to Hubletics! 👋
          </h1>
          <p className="text-xl text-gray-600">
            Let&apos;s get started. How do you want to use Hubletics?
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              type="button"
              onClick={() => setSelectedRole('client')}
              disabled={loading}
              className={`relative flex flex-col items-center justify-center rounded-xl border-3 p-8 transition-all duration-200 ${
                selectedRole === 'client'
                  ? 'border-[#FF6B4A] bg-orange-50 ring-4 ring-[#FF6B4A]/20 scale-105'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <svg
                className={`h-16 w-16 mb-4 ${selectedRole === 'client' ? 'text-[#FF6B4A]' : 'text-gray-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className={`text-xl font-bold mb-2 ${selectedRole === 'client' ? 'text-[#FF6B4A]' : 'text-gray-900'}`}>
                I&apos;m an Athlete/Client
              </span>
              <span className="text-sm text-gray-600 text-center">
                I want to find and book coaching sessions
              </span>
              {selectedRole === 'client' && (
                <div className="absolute top-4 right-4">
                  <svg className="w-8 h-8 text-[#FF6B4A]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('coach')}
              disabled={loading}
              className={`relative flex flex-col items-center justify-center rounded-xl border-3 p-8 transition-all duration-200 ${
                selectedRole === 'coach'
                  ? 'border-[#FF6B4A] bg-orange-50 ring-4 ring-[#FF6B4A]/20 scale-105'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <svg
                className={`h-16 w-16 mb-4 ${selectedRole === 'coach' ? 'text-[#FF6B4A]' : 'text-gray-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span className={`text-xl font-bold mb-2 ${selectedRole === 'coach' ? 'text-[#FF6B4A]' : 'text-gray-900'}`}>
                I&apos;m a Coach
              </span>
              <span className="text-sm text-gray-600 text-center">
                I want to offer coaching services to athletes
              </span>
              {selectedRole === 'coach' && (
                <div className="absolute top-4 right-4">
                  <svg className="w-8 h-8 text-[#FF6B4A]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={!selectedRole || loading}
              className="px-8 py-4 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white text-lg font-semibold rounded-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Setting up your account...' : 'Continue →'}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          You can&apos;t change this later, so choose carefully!
        </p>
      </motion.div>
    </div>
  );
}

