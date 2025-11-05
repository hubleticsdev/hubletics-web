'use client';

import Image from 'next/image';

interface UpcomingBookingsProps {
  bookings: Array<{
    id: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    clientName: string;
    clientImage: string | null;
  }>;
}

export function UpcomingBookings({ bookings }: UpcomingBookingsProps) {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500">No upcoming sessions</p>
      </div>
    );
  }

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: Date, end: Date) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.round(diff / 60000);
    return `${minutes} min`;
  };

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto">
      {bookings.map((booking) => (
        <div
          key={booking.id}
          className="p-3 border border-gray-200 rounded-lg hover:border-[#FF6B4A] transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
              <Image
                src={booking.clientImage || '/placeholder-avatar.png'}
                alt={booking.clientName}
                width={32}
                height={32}
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {booking.clientName}
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>{formatDateTime(booking.scheduledStartAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{formatDuration(booking.scheduledStartAt, booking.scheduledEndAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
