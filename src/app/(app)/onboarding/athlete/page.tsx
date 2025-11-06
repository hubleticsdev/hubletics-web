import { getSession } from '@/lib/auth/session';
import { OnboardingWizard } from '@/components/onboarding/athlete/OnboardingWizard';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function AthleteOnboardingPage() {
  const session = await getSession();

  const userName = session?.user?.name || '';
  const googleAvatar = session?.user?.image || null;
  const userId = session?.user?.id || '';

  // Fetch temp onboarding files from user table to prevent orphaned uploads
  const userData = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: {
      onboardingPhotoUrl: true,
    },
  });

  return (
    <OnboardingWizard
      initialName={userName}
      googleAvatar={googleAvatar}
      savedPhotoUrl={userData?.onboardingPhotoUrl || null}
    />
  );
}
