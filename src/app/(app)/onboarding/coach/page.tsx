import { requireRole } from '@/lib/auth/session';
import { OnboardingWizard } from '@/components/onboarding/coach/OnboardingWizard';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function CoachOnboardingPage() {
  const session = await requireRole('coach');

  const userName = session.user.name || '';
  const googleAvatar = session.user.image || null;

  const userData = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: {
      onboardingPhotoUrl: true,
      onboardingVideoUrl: true,
    },
  });

  return (
    <OnboardingWizard
      initialName={userName}
      googleAvatar={googleAvatar}
      savedPhotoUrl={userData?.onboardingPhotoUrl || null}
      savedVideoUrl={userData?.onboardingVideoUrl || null}
    />
  );
}

