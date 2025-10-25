import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getPendingBookingRequests, getUpcomingBookings } from '@/actions/bookings/queries';
import { CoachBookingCard } from '@/components/bookings/coach-booking-card';

export default async function CoachDashboard() {
  const session = await requireRole('coach');

  const coach = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, session.user.id),
  });

  if (!coach) {
    redirect('/onboarding/coach');
  }

  const needsApproval = coach.adminApprovalStatus === 'pending';
  const needsStripeOnboarding = coach.adminApprovalStatus === 'approved' && !coach.stripeOnboardingComplete;
  const isFullyOnboarded = coach.adminApprovalStatus === 'approved' && coach.stripeOnboardingComplete;

  // Fetch pending booking requests and upcoming sessions
  const { bookings: pendingRequests } = await getPendingBookingRequests();
  const { bookings: upcomingSessions } = await getUpcomingBookings();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {coach.fullName}!
        </h1>
        <p className="text-gray-600">Here's your coaching dashboard</p>
      </div>

      {/* Status Alerts */}
      {needsApproval && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-yellow-900">
                Profile Under Review
              </h3>
              <p className="text-yellow-800 mt-1">
                Your coach profile is currently being reviewed by our admin team.
                We'll email you within 24-48 hours once your profile has been approved.
              </p>
            </div>
          </div>
        </div>
      )}

      {needsStripeOnboarding && (
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-blue-900">
                Complete Your Payment Setup
              </h3>
              <p className="text-blue-800 mt-1 mb-4">
                Your profile has been approved! Complete your payment setup to start accepting bookings.
                This takes about 5 minutes.
              </p>
              <Link
                href="/coach/stripe/onboarding"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Complete Payment Setup
              </Link>
            </div>
          </div>
        </div>
      )}

      {isFullyOnboarded && (
        <div className="mb-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-green-900">
                You're All Set!
              </h3>
              <p className="text-green-800 mt-1">
                Your profile is approved and payment setup is complete. You can now accept bookings!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Booking Requests */}
      {isFullyOnboarded && pendingRequests.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Pending Booking Requests
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({pendingRequests.length})
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendingRequests.map((booking) => (
              <CoachBookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Bookings</div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Upcoming Sessions</div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Earnings</div>
          <div className="text-3xl font-bold text-gray-900">$0</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Reputation</div>
          <div className="text-3xl font-bold text-gray-900">
            {coach.reputationScore} ★
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {coach.totalReviews} reviews
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <h3 className="font-semibold text-gray-900">View Bookings</h3>
              <p className="text-sm text-gray-600">Manage your schedule</p>
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
              <p className="text-sm text-gray-600">Chat with clients</p>
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
          <Link
            href="/dashboard/availability"
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-gray-900">Availability</h3>
              <p className="text-sm text-gray-600">Manage your schedule</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
