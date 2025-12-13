import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Image from 'next/image';
import { Pagination } from '@/components/ui/pagination';
import { getPaginationOptions, createPaginationResult, getOffset } from '@/lib/pagination';
import { deriveUiBookingStatus, formatUiBookingStatus } from '@/lib/booking-status';
import { formatDateWithTimezone } from '@/lib/utils/date';

export const dynamic = 'force-dynamic';

interface AdminBookingsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminBookingsPage({ searchParams }: AdminBookingsPageProps) {
  await requireRole('admin');

  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string') {
      searchParamsObj.set(key, value);
    }
  });

  const { page, limit } = getPaginationOptions(searchParamsObj);
  const offset = getOffset(page, limit);

  const totalBookings = await db.$count(booking);

  const rawBookings = await db.query.booking.findMany({
    with: {
      client: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      coach: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: [desc(booking.createdAt)],
    limit,
    offset,
  });

  const bookings = rawBookings.map((b) => ({
    ...b,
    status: deriveUiBookingStatus({
      approvalStatus: b.approvalStatus,
      paymentStatus: b.paymentStatus,
      fulfillmentStatus: b.fulfillmentStatus,
      capacityStatus: b.capacityStatus,
    }),
  }));

  const formatDollars = (cents?: number | null) =>
    cents !== undefined && cents !== null ? (cents / 100).toFixed(2) : '0.00';

  const paginationResult = createPaginationResult(bookings, totalBookings, { page, limit });

  const stats = {
    total: totalBookings,
    pending: bookings.filter((b) => b.status === 'awaiting_coach' || b.status === 'awaiting_payment').length,
    accepted: bookings.filter((b) => b.status === 'confirmed').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => ['cancelled', 'declined', 'expired'].includes(b.status)).length,
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Bookings</h1>
        <p className="text-gray-600 mt-2">Manage all bookings in the system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Pending</div>
          <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Accepted</div>
          <div className="text-3xl font-bold text-green-600">{stats.accepted}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Completed</div>
          <div className="text-3xl font-bold text-blue-600">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Cancelled</div>
          <div className="text-3xl font-bold text-red-600">{stats.cancelled}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {bookings.length === 0 ? (
          <div className="p-12 text-center text-gray-600">No bookings yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {bookings.map((booking) => (
              <div key={booking.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-6 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                          <Image
                            src={booking.client.image || '/placeholder-avatar.png'}
                            alt={booking.client.name}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{booking.client.name}</p>
                          <p className="text-xs text-gray-500">Client</p>
                        </div>
                      </div>

                      <div className="text-gray-400">→</div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                          <Image
                            src={booking.coach.image || '/placeholder-avatar.png'}
                            alt={booking.coach.name}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{booking.coach.name}</p>
                          <p className="text-xs text-gray-500">Coach</p>
                        </div>
                      </div>
                    </div>

                    <div className="ml-13 space-y-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">Date:</span>{' '}
                        {formatDateWithTimezone(new Date(booking.scheduledStartAt), 'America/Chicago')}
                      </p>
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">Duration:</span> {booking.duration} minutes
                      </p>
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">Total:</span>{' '}
                        ${formatDollars(booking.expectedGrossCents)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      booking.status === 'completed'
                        ? 'bg-blue-100 text-blue-800'
                        : booking.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : booking.status === 'awaiting_coach'
                            ? 'bg-yellow-100 text-yellow-800'
                            : booking.status === 'awaiting_payment'
                              ? 'bg-orange-100 text-orange-800'
                              : booking.status === 'open'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {formatUiBookingStatus(booking.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Pagination
        pagination={paginationResult.pagination}
        baseUrl="/admin/bookings"
      />
    </div>
  );
}
