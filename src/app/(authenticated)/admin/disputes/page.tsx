import { requireRole } from '@/lib/auth/session';

export default async function AdminDisputesPage() {
  await requireRole('admin');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Disputes</h1>
        <p className="text-gray-600 mt-2">Manage booking disputes and issues</p>
      </div>

      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Disputes Yet</h2>
          <p className="text-gray-600">
            Dispute management functionality will be available once bookings are active. This page
            will allow admins to review and resolve issues between coaches and clients.
          </p>
        </div>
      </div>
    </div>
  );
}
