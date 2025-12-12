import { requireRole } from '@/lib/auth/session';
import { getDisputedBookings } from '@/actions/admin/disputes';
import { DisputesList } from '@/components/admin/disputes-list';
import { Pagination } from '@/components/ui/pagination';
import { getPaginationOptions } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

interface AdminDisputesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminDisputesPage({ searchParams }: AdminDisputesPageProps) {
  await requireRole('admin');

  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string') {
      searchParamsObj.set(key, value);
    }
  });

  const { page, limit } = getPaginationOptions(searchParamsObj);

  const result = await getDisputedBookings(page, limit);

  if (!result.success) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Disputes</h1>
          <p className="text-gray-600 mt-2">Manage booking disputes and issues</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Failed to load disputes. Please try again.</p>
        </div>
      </div>
    );
  }

  const { bookings = [], pagination } = result;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Disputes</h1>
        <p className="text-gray-600 mt-2">Manage booking disputes and refunds</p>
      </div>

      {bookings.length === 0 ? (
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Disputes</h2>
            <p className="text-gray-600">
              All bookings are running smoothly! Disputed bookings will appear here for review and resolution.
            </p>
          </div>
        </div>
      ) : (
        <DisputesList bookings={bookings} />
      )}

      {pagination && (
        <Pagination
          pagination={pagination}
          baseUrl="/admin/disputes"
        />
      )}
    </div>
  );
}
