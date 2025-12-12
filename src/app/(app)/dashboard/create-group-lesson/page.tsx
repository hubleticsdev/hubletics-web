import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { CreateGroupLessonForm } from '@/components/group-bookings/create-group-lesson-form';

export default async function CreateGroupLessonPage() {
  const session = await getSession();

  if (!session || session.user.role !== 'coach') {
    redirect('/auth/signin');
  }

  const coach = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, session.user.id),
    columns: {
      allowPublicGroups: true,
      preferredLocations: true,
      weeklyAvailability: true,
    },
  });

  if (!coach?.allowPublicGroups) {
    redirect('/dashboard/profile?error=enable_public_groups');
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create Group Lesson</h1>
        <p className="mt-2 text-gray-600">
          Create a public group lesson that clients can join. Choose between a single lesson or recurring schedule.
        </p>
      </div>

      <CreateGroupLessonForm
        preferredLocations={coach.preferredLocations || []}
      />
    </div>
  );
}

