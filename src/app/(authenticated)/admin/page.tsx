import { getPendingCoaches } from '@/actions/admin/coach-approval';
import { getAdminDashboardMetrics } from '@/actions/admin/dashboard';
import { getDisputedBookings } from '@/actions/admin/disputes';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [
    { coaches: pendingCoaches },
    dashboardMetrics,
    { bookings: disputedBookings = [] },
  ] = await Promise.all([
    getPendingCoaches(),
    getAdminDashboardMetrics(),
    getDisputedBookings(),
  ]);

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link href="/admin/coaches/pending" className="bg-white rounded-lg shadow p-6 hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer">
          <div className="text-sm text-gray-600 mb-2">Pending Coaches</div>
          <div className="text-3xl font-bold text-orange-600">
            {pendingCoaches.length}
          </div>
          <div className="text-xs text-gray-500 mt-2">Click to review →</div>
        </Link>
        
        <Link href="/admin/disputes" className="bg-white rounded-lg shadow p-6 hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer">
          <div className="text-sm text-gray-600 mb-2">Active Disputes</div>
          <div className="text-3xl font-bold text-red-600">
            {disputedBookings.length}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {disputedBookings.length > 0 ? 'Requires attention →' : 'All clear'}
          </div>
        </Link>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Active Coaches</div>
          <div className="text-3xl font-bold text-green-600">
            {activeCoaches.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Ready for bookings
          </div>
        </div>

        <Link href="/admin/bookings" className="bg-white rounded-lg shadow p-6 hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer">
          <div className="text-sm text-gray-600 mb-2">This Month</div>
          <div className="text-3xl font-bold text-gray-900">${dashboardMetrics.monthlyRevenue.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {dashboardMetrics.completedBookingsThisMonth} bookings →
          </div>
        </Link>
      </div>

      {/* Service Links Section */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Connected Services</h2>
          <p className="text-sm text-gray-600 mt-1">Quick access to external platforms and tools</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Stripe */}
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-[#635BFF] hover:shadow-md transition-all duration-200"
            >
              <div className="w-12 h-12 bg-[#635BFF] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-2.704 0-5.24-1.17-6.762-2.23l-.796 5.48C4.864 22.41 7.54 23 10.852 23c2.749 0 4.925-.69 6.476-2.05 1.621-1.42 2.423-3.335 2.423-5.693 0-3.73-2.498-5.417-5.775-6.107z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-[#635BFF] transition-colors">Stripe Dashboard</h3>
                <p className="text-xs text-gray-600">Payments & payouts</p>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-[#635BFF] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* Neon (Database) */}
            <a
              href="https://console.neon.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-[#00E599] hover:shadow-md transition-all duration-200"
            >
              <div className="w-12 h-12 bg-[#00E599] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-[#00E599] transition-colors">Neon Console</h3>
                <p className="text-xs text-gray-600">Database management</p>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-[#00E599] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* Pusher */}
            <a
              href="https://dashboard.pusher.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-[#300D4F] hover:shadow-md transition-all duration-200"
            >
              <div className="w-12 h-12 bg-[#300D4F] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-[#300D4F] transition-colors">Pusher Dashboard</h3>
                <p className="text-xs text-gray-600">Real-time messaging</p>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-[#300D4F] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* Vercel */}
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-black hover:shadow-md transition-all duration-200"
            >
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 19.5h20L12 2z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-black transition-colors">Vercel Dashboard</h3>
                <p className="text-xs text-gray-600">Hosting & deployments</p>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* Resend */}
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-black hover:shadow-md transition-all duration-200"
            >
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-black transition-colors">Resend Console</h3>
                <p className="text-xs text-gray-600">Email delivery</p>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* GitHub */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-[#24292e] hover:shadow-md transition-all duration-200"
            >
              <div className="w-12 h-12 bg-[#24292e] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-[#24292e] transition-colors">GitHub Actions</h3>
                <p className="text-xs text-gray-600">Cron jobs & workflows</p>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-[#24292e] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Recent Coach Applications
            </h2>
            <p className="text-sm text-gray-600 mt-1">Latest submissions awaiting review</p>
          </div>
          {pendingCoaches.length > 3 && (
            <Link
              href="/admin/coaches/pending"
              className="text-sm text-[#FF6B4A] hover:text-[#FF8C5A] font-semibold"
            >
              View All {pendingCoaches.length} →
            </Link>
          )}
        </div>
        <div className="p-6">
          {pendingCoaches.length === 0 ? (
            <p className="text-gray-600">No pending coach approvals.</p>
          ) : (
            <div className="space-y-4">
              {pendingCoaches.slice(0, 3).map((coach) => (
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
              {pendingCoaches.length > 3 && (
                <div className="pt-4 text-center border-t border-gray-200">
                  <Link
                    href="/admin/coaches/pending"
                    className="text-sm text-[#FF6B4A] hover:text-[#FF8C5A] font-semibold"
                  >
                    View All {pendingCoaches.length} Pending Coaches →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

