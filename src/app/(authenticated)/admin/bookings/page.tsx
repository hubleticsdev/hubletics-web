import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  await requireRole('admin');

  const bookings = await db.query.booking.findMany({
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
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    accepted: bookings.filter((b) => b.status === 'accepted').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
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
                        {new Date(booking.scheduledStartAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">Duration:</span> {booking.duration} minutes
                      </p>
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">Total:</span> ${booking.clientPaid}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      booking.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : booking.status === 'accepted'
                          ? 'bg-green-100 text-green-800'
                          : booking.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
