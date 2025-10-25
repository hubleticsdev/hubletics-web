import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

/**
 * Refresh page for Stripe onboarding
 * If the onboarding link expires, Stripe redirects here
 * We redirect back to start the onboarding flow again
 */
export default async function StripeOnboardingRefreshPage() {
  const session = await getSession();

  if (!session || session.user.role !== 'coach') {
    redirect('/auth/signin');
  }

  // Redirect back to onboarding to generate a new link
  redirect('/coach/stripe/onboarding');
}

