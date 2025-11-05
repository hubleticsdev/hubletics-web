'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Clock, DollarSign, User, Loader2 } from 'lucide-react';
import { acceptBooking, declineBooking } from '@/actions/bookings/respond';
import { useRouter } from 'next/navigation';

type BookingStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed' | 'disputed';

interface Booking {
  id: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  duration: number;
  location: {
    name: string;
    address: string;
    notes?: string;
  };
  clientMessage: string | null;
  clientPaid: string;
  status: BookingStatus;
  coachRespondedAt: Date | null;
  client?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  coach?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

interface BookingsListProps {
  bookings: Booking[];
  userRole: 'client' | 'coach' | 'admin' | 'pending';
  userId: string;
}

export function BookingsList({ bookings, userRole, userId }: BookingsListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'pending' | 'upcoming' | 'past'>('all');
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();

  // Filter bookings based on selected filter
  const filteredBookings = bookings.filter((booking) => {
    const bookingDate = new Date(booking.scheduledStartAt);
    const isPast = bookingDate < now;
    const isUpcoming = bookingDate >= now && (booking.status === 'accepted' || booking.status === 'pending');
    const isPending = booking.status === 'pending';

    switch (filter) {
      case 'pending':
        return isPending;
      case 'upcoming':
        return isUpcoming && !isPast;
      case 'past':
        return isPast || booking.status === 'completed' || booking.status === 'cancelled';
      default:
        return true;
    }
  });

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'disputed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleAccept = async (bookingId: string) => {
    setProcessingBookingId(bookingId);
    setError(null);

    const result = await acceptBooking(bookingId);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Failed to accept booking');
      setProcessingBookingId(null);
    }
  };

  const handleDecline = async (bookingId: string) => {
    // TODO: Add a confirmation dialog with reason input
    const confirmed = confirm('Are you sure you want to decline this booking request?');
    if (!confirmed) return;

    setProcessingBookingId(bookingId);
    setError(null);

    const result = await declineBooking(bookingId);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Failed to decline booking');
      setProcessingBookingId(null);
    }
  };

  return (
    <div>
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                filter === 'all'
                  ? 'border-[#FF6B4A] text-[#FF6B4A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Bookings
            </button>
            {userRole === 'coach' && (
              <button
                onClick={() => setFilter('pending')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  filter === 'pending'
                    ? 'border-[#FF6B4A] text-[#FF6B4A]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pending Requests
                {bookings.filter((b) => b.status === 'pending').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-[#FF6B4A] text-white text-xs rounded-full">
                    {bookings.filter((b) => b.status === 'pending').length}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                filter === 'upcoming'
                  ? 'border-[#FF6B4A] text-[#FF6B4A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilter('past')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                filter === 'past'
                  ? 'border-[#FF6B4A] text-[#FF6B4A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Past
            </button>
          </nav>
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <Calendar className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings found</h3>
          <p className="text-gray-600">
            {filter === 'pending'
              ? 'You have no pending booking requests'
              : filter === 'upcoming'
              ? 'You have no upcoming sessions'
              : filter === 'past'
              ? 'You have no past sessions'
              : 'You have no bookings yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const otherUser = userRole === 'coach' ? booking.client : booking.coach;
            return (
              <div key={booking.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Status Badge */}
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(
                            booking.status
                          )}`}
                        >
                          {booking.status}
                        </span>
                        {booking.status === 'pending' && userRole === 'coach' && (
                          <span className="text-xs text-gray-500">Awaiting your response</span>
                        )}
                      </div>

                      {/* Other User Info */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {otherUser?.image ? (
                            <img src={otherUser.image} alt={otherUser.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{otherUser?.name}</div>
                          <div className="text-sm text-gray-500 capitalize">
                            {userRole === 'coach' ? 'Client' : 'Coach'}
                          </div>
                        </div>
                      </div>

                      {/* Booking Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-2">
                          <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{formatDate(booking.scheduledStartAt)}</div>
                            <div className="text-sm text-gray-600">
                              {formatTime(booking.scheduledStartAt)} - {formatTime(booking.scheduledEndAt)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{booking.duration} minutes</div>
                            <div className="text-sm text-gray-600">Session duration</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{booking.location.name}</div>
                            <div className="text-sm text-gray-600">{booking.location.address}</div>
                            {booking.location.notes && (
                              <div className="text-xs text-gray-500 mt-1">{booking.location.notes}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <DollarSign className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">${booking.clientPaid}</div>
                            <div className="text-sm text-gray-600">Total amount</div>
                          </div>
                        </div>
                      </div>

                      {/* Client Message */}
                      {booking.clientMessage && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Message from client:</div>
                          <div className="text-sm text-gray-600">{booking.clientMessage}</div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {booking.status === 'pending' && userRole === 'coach' && (
                      <div className="ml-6 flex flex-col gap-2">
                        <Button
                          type="button"
                          onClick={() => handleAccept(booking.id)}
                          disabled={processingBookingId === booking.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          {processingBookingId === booking.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Processing...
                            </>
                          ) : (
                            'Accept'
                          )}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleDecline(booking.id)}
                          disabled={processingBookingId === booking.id}
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          size="sm"
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
