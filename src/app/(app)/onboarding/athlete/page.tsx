import { getSession } from '@/lib/auth/session';
import { OnboardingWizard } from '@/components/onboarding/athlete/OnboardingWizard';

export default async function AthleteOnboardingPage() {
  // The proxy.ts already verified:
  // 1. User is authenticated
  // 2. User has role='client'
  // 3. User's profile is incomplete
  // 
  // Using cached getSession() here prevents duplicate DB queries
  // (proxy.ts already fetched the session, so this will use the cached result)
  const session = await getSession();

  // Session will always exist here due to proxy checks, but satisfy TypeScript
  const userName = session?.user?.name || '';
  const googleAvatar = session?.user?.image || null;

  return <OnboardingWizard initialName={userName} googleAvatar={googleAvatar} />;
}
