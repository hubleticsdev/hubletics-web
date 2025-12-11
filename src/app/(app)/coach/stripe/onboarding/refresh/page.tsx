import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function StripeOnboardingRefreshPage() {
  const session = await getSession();

  if (!session || session.user.role !== 'coach') {
    redirect('/auth/signin');
  }

  redirect('/coach/stripe/onboarding');
}

