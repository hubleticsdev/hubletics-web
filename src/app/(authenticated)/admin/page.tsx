import { getPendingCoaches } from '@/actions/admin/coach-approval';
import { getAdminDashboardMetrics } from '@/actions/admin/dashboard';
import { db } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const { coaches: pendingCoaches } = await getPendingCoaches();
  const dashboardMetrics = await getAdminDashboardMetrics();

  // Get active coaches count (approved + Stripe onboarding complete)
  const activeCoaches = await db.query.coachProfile.findMany({
    where: (coaches, { and, eq }) =>
      and(
        eq(coaches.adminApprovalStatus, 'approved'),
        eq(coaches.stripeOnboardingComplete, true)
      ),
  });

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Admin Dashboard
      </h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Pending Coaches</div>
          <div className="text-3xl font-bold text-orange-600">
            {pendingCoaches.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Active Coaches</div>
          <div className="text-3xl font-bold text-green-600">
            {activeCoaches.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Ready for bookings
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Users</div>
          <div className="text-3xl font-bold text-gray-900">{dashboardMetrics.totalUsers}</div>
          <div className="text-xs text-gray-500 mt-1">Active accounts</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">This Month Revenue</div>
          <div className="text-3xl font-bold text-gray-900">${dashboardMetrics.monthlyRevenue.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {dashboardMetrics.completedBookingsThisMonth} bookings completed
          </div>
        </div>
      </div>

      {/* Pending Coaches */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Pending Coach Approvals
          </h2>
        </div>
        <div className="p-6">
          {pendingCoaches.length === 0 ? (
            <p className="text-gray-600">No pending coach approvals.</p>
          ) : (
            <div className="space-y-4">
              {pendingCoaches.map((coach) => (
                <div
                  key={coach.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    {coach.profilePhoto ? (
                      <img
                        src={coach.profilePhoto}
                        alt={coach.fullName}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                        <span className="text-orange-600 font-semibold">
                          {coach.fullName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {coach.fullName}
                      </h3>
                      <p className="text-sm text-gray-600">{coach.user.email}</p>
                      <p className="text-xs text-gray-500">
                        Submitted {new Date(coach.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/admin/coaches/${coach.userId}`}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

