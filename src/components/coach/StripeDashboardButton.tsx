'use client';

import { useState } from 'react';
import { getStripeLoginLink } from '@/actions/coach/earnings';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function StripeDashboardButton() {
  const [loading, setLoading] = useState(false);

  const handleAccessDashboard = async () => {
    try {
      setLoading(true);
      const result = await getStripeLoginLink();

      if ('error' in result) {
        toast.error(result.error);
        return;
      }

      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error accessing Stripe dashboard:', error);
      toast.error('Failed to access Stripe dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleAccessDashboard}
      disabled={loading}
      size="lg"
      className="bg-[#FF6B4A] hover:bg-[#FF6B4A]/90 text-white font-medium"
    >
      {loading ? (
        <>
          <svg
            className="w-4 h-4 animate-spin mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Loading...
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          Access Stripe Dashboard
        </>
      )}
    </Button>
  );
}
