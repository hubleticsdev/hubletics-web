import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { BookingsList } from '@/components/bookings/bookings-list';

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  let bookings;

  if (session.user.role === 'coach') {
    bookings = await db.query.booking.findMany({
      where: eq(booking.coachId, session.user.id),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        review: {
          columns: {
            id: true,
            rating: true,
          },
        },
      },
      orderBy: [desc(booking.scheduledStartAt)],
    });
  } else {
    bookings = await db.query.booking.findMany({
      where: eq(booking.clientId, session.user.id),
      with: {
        coach: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        review: {
          columns: {
            id: true,
            rating: true,
          },
        },
      },
      orderBy: [desc(booking.scheduledStartAt)],
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {session.user.role === 'coach' ? 'My Bookings' : 'My Sessions'}
          </h1>
          <p className="mt-2 text-gray-600">
            {session.user.role === 'coach'
              ? 'Manage your coaching sessions and booking requests'
              : 'View and manage your training sessions'}
          </p>
        </div>

        <BookingsList
          bookings={bookings}
          userRole={session.user.role as 'client' | 'coach' | 'admin' | 'pending'}
          userId={session.user.id}
        />
      </div>
    </div>
  );
}
