import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { athleteProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getMyBookings, getUpcomingBookings } from '@/actions/bookings/queries';
import { AthleteBookingCard } from '@/components/bookings/athlete-booking-card';

export default async function AthleteDashboard() {
  const session = await requireRole('client');

  const athlete = await db.query.athleteProfile.findFirst({
    where: eq(athleteProfile.userId, session.user.id),
  });

  if (!athlete) {
    redirect('/onboarding/athlete');
  }

  // Fetch bookings
  const { bookings: upcomingBookings } = await getUpcomingBookings();
  const { bookings: pendingBookings } = await getMyBookings('pending');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {athlete.fullName}!
        </h1>
        <p className="text-gray-600">Find your perfect coach and book your next session</p>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Sessions</div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Upcoming Sessions</div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Favorite Coaches</div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Spent</div>
          <div className="text-3xl font-bold text-gray-900">$0</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/coaches"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <svg
              className="h-6 w-6 text-orange-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-gray-900">Find a Coach</h3>
              <p className="text-sm text-gray-600">Browse available coaches</p>
            </div>
          </Link>
          <Link
            href="/dashboard/bookings"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <svg
              className="h-6 w-6 text-orange-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-gray-900">My Bookings</h3>
              <p className="text-sm text-gray-600">View your schedule</p>
            </div>
          </Link>
          <Link
            href="/dashboard/messages"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <svg
              className="h-6 w-6 text-orange-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-gray-900">Messages</h3>
              <p className="text-sm text-gray-600">Chat with coaches</p>
            </div>
          </Link>
          <Link
            href="/dashboard/profile"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <svg
              className="h-6 w-6 text-orange-600 mr-3"
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
            <div>
              <h3 className="font-semibold text-gray-900">Edit Profile</h3>
              <p className="text-sm text-gray-600">Update your information</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Pending Booking Requests */}
      {pendingBookings.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Pending Requests
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({pendingBookings.length})
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendingBookings.map((booking) => (
              <AthleteBookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Sessions */}
      {upcomingBookings.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Upcoming Sessions
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({upcomingBookings.length})
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {upcomingBookings.map((booking) => (
              <AthleteBookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </div>
      )}

      {/* Sports You're Interested In */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Your Sports</h2>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-3">
            {athlete.sportsInterested.map((sport) => (
              <Link
                key={sport}
                href={`/coaches?sport=${encodeURIComponent(sport)}`}
                className="px-4 py-2 bg-orange-100 text-orange-800 rounded-full hover:bg-orange-200"
              >
                {sport}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
