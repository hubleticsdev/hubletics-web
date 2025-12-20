import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getMyBookings } from '@/actions/bookings/queries';
import { BookingsList } from '@/components/bookings/bookings-list';

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { bookings: bookingsData } = await getMyBookings();
  
  // getMyBookings already returns bookings with status, but flattening detail fields
  // for backward compatibility with BookingsList component
  const bookingsWithStatus = bookingsData.map((b) => {
    const flattened = {
      ...b,
      // Flatten detail table fields
      expectedGrossCents: b.bookingType === 'individual' 
        ? b.individualDetails?.clientPaysCents 
        : b.bookingType === 'private_group'
        ? b.privateGroupDetails?.totalGrossCents
        : null,
      coachPayoutCents: b.bookingType === 'individual'
        ? b.individualDetails?.coachPayoutCents
        : b.bookingType === 'private_group'
        ? b.privateGroupDetails?.coachPayoutCents
        : null,
      platformFeeCents: b.bookingType === 'individual'
        ? b.individualDetails?.platformFeeCents
        : b.bookingType === 'private_group'
        ? b.privateGroupDetails?.platformFeeCents
        : null,
      clientMessage: b.bookingType === 'individual'
        ? b.individualDetails?.clientMessage
        : b.bookingType === 'private_group'
        ? b.privateGroupDetails?.clientMessage
        : b.bookingType === 'public_group'
        ? b.publicGroupDetails?.clientMessage
        : null,
      isGroupBooking: b.bookingType === 'private_group' || b.bookingType === 'public_group',
      groupType: (b.bookingType === 'private_group' ? 'private' : b.bookingType === 'public_group' ? 'public' : null) as 'private' | 'public' | null,
      maxParticipants: b.bookingType === 'public_group' ? b.publicGroupDetails?.maxParticipants : null,
      currentParticipants: b.bookingType === 'public_group' ? b.publicGroupDetails?.currentParticipants : null,
      pricePerPerson: b.bookingType === 'public_group' ? b.publicGroupDetails?.pricePerPerson : b.bookingType === 'private_group' ? b.privateGroupDetails?.pricePerPerson : null,
      organizerId: b.bookingType === 'private_group' ? b.privateGroupDetails?.organizerId : null,
      client: b.bookingType === 'individual' ? b.individualDetails?.client : b.bookingType === 'private_group' ? b.privateGroupDetails?.organizer : null,
      paymentDueAt: b.bookingType === 'individual' 
        ? b.individualDetails?.paymentDueAt 
        : b.bookingType === 'private_group'
        ? b.privateGroupDetails?.paymentDueAt
        : null,
    };
    return flattened;
  });

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
          bookings={bookingsWithStatus}
          userRole={session.user.role as 'client' | 'coach' | 'admin' | 'pending'}
          userId={session.user.id}
        />
      </div>
    </div>
  );
}
