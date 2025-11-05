import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { coachProfile, booking } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { AvailabilityManager } from '@/components/availability/availability-manager';

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session || session.user.role !== 'coach') {
    redirect('/dashboard/coach');
  }

  // Fetch coach profile
  const profile = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, session.user.id),
  });

  if (!profile) {
    redirect('/onboarding/coach');
  }

  // Fetch upcoming bookings
  const now = new Date();
  const upcomingBookings = await db.query.booking.findMany({
    where: and(
      eq(booking.coachId, session.user.id),
      eq(booking.status, 'accepted'),
      gte(booking.scheduledStartAt, now)
    ),
    with: {
      client: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: (bookings, { asc }) => [asc(bookings.scheduledStartAt)],
  });

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manage Availability</h1>
          <p className="mt-2 text-gray-600">
            Set your weekly schedule and block off specific dates when you're unavailable
          </p>
        </div>

        <AvailabilityManager
          weeklyAvailability={profile.weeklyAvailability as Record<string, Array<{ start: string; end: string }>>}
          blockedDates={profile.blockedDates || []}
          sessionDuration={profile.sessionDuration}
          upcomingBookings={upcomingBookings.map((b) => ({
            id: b.id,
            scheduledStartAt: b.scheduledStartAt,
            scheduledEndAt: b.scheduledEndAt,
            clientName: b.client.name,
            clientImage: b.client.image,
          }))}
        />
      </div>
    </div>
  );
}
