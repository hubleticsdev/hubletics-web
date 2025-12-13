import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { athleteProfile, coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ProfileForm } from '@/components/profile/profile-form';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  let profile = null;
  if (session.user.role === 'client') {
    profile = await db.query.athleteProfile.findFirst({
      where: eq(athleteProfile.userId, session.user.id),
    });
  } else if (session.user.role === 'coach') {
    profile = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, session.user.id),
    });
  }

  if (!profile) {
    if (session.user.role === 'client') {
      redirect('/onboarding/athlete');
    } else if (session.user.role === 'coach') {
      redirect('/onboarding/coach');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="mt-2 text-gray-600">
            Update your account information and profile details
          </p>
        </div>

        <ProfileForm
          user={{
            id: session.user.id,
            name: session.user.name,
            username: session.user.username ?? '',
            email: session.user.email,
            image: session.user.image ?? null,
            role: session.user.role as 'client' | 'coach' | 'admin' | 'pending',
          }}
          profile={profile!}
        />
      </div>
    </div>
  );
}
