import { requireRole } from '@/lib/auth/session';
import { getPendingCoaches } from '@/actions/admin/coach-approval';
import Link from 'next/link';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function PendingCoachesPage() {
  await requireRole('admin');

  const { coaches: pendingCoaches } = await getPendingCoaches();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pending Coach Approvals</h1>
        <p className="text-gray-600 mt-2">
          Review and approve coach applications
        </p>
      </div>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Review Guidelines</h3>
            <p className="text-sm text-blue-800">
              Verify certifications, check background, and review profile quality before approval. 
              Rejected coaches can be contacted for improvements.
            </p>
          </div>
        </div>
      </div>

      {pendingCoaches.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Pending Applications
            </h2>
            <p className="text-gray-600">
              All coach applications have been reviewed. New applications will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {pendingCoaches.length} Application{pendingCoaches.length !== 1 ? 's' : ''} Awaiting Review
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Click &quot;Review&quot; to view full details and approve/reject
                </p>
              </div>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-semibold rounded-full">
                {pendingCoaches.length} Pending
              </span>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingCoaches.map((coach) => (
              <div
                key={coach.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {coach.profilePhoto ? (
                      <Image
                        src={coach.profilePhoto}
                        alt={coach.fullName}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-linear-to-br from-orange-100 to-red-100 flex items-center justify-center border-2 border-orange-200">
                        <span className="text-orange-600 font-bold text-xl">
                          {coach.fullName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {coach.fullName}
                      </h3>
                      <p className="text-sm text-gray-600">{coach.user.email}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        @{coach.user.username}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-500">
                          📅 Submitted {new Date(coach.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-500">
                          💰 ${parseFloat(coach.hourlyRate).toFixed(2)}/hr
                        </span>
                        <span className="text-xs text-gray-500">
                          🎯 {coach.specialties.length} specialt{coach.specialties.length !== 1 ? 'ies' : 'y'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/admin/coaches/${coach.userId}`}
                    className="px-6 py-2.5 bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
                  >
                    Review Application
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

