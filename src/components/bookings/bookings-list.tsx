'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Calendar, MapPin, Clock, DollarSign, User, Loader2, Star, AlertCircle, Users, MessageCircle, Flag } from 'lucide-react';
import { acceptBooking, declineBooking } from '@/actions/bookings/respond';
import { leavePublicLesson, cancelPrivateGroupBooking, coachCancelGroupLesson } from '@/actions/group-bookings/cancel';
import { initiateDispute } from '@/actions/admin/disputes';
import Link from 'next/link';
import { ReviewModal } from '@/components/reviews/review-modal';
import { PaymentModal } from '@/components/bookings/payment-modal';
import { ParticipantsModal } from '@/components/group-bookings/participants-modal';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';

type BookingStatus = 'pending' | 'awaiting_payment' | 'accepted' | 'declined' | 'cancelled' | 'completed' | 'disputed' | 'open';

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
  paymentDueAt?: Date | null;
  isGroupBooking?: boolean;
  groupType?: 'private' | 'public' | null;
  maxParticipants?: number | null;
  currentParticipants?: number | null;
  pricePerPerson?: string | null;
  organizerId?: string | null;
  pendingParticipantsCount?: number;
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
  review?: {
    id: string;
    rating: number;
  } | null;
}

interface BookingsListProps {
  bookings: Booking[];
  userRole: 'client' | 'coach' | 'admin' | 'pending';
  userId: string;
}

export function BookingsList({ bookings, userRole, userId }: BookingsListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'pending' | 'upcoming' | 'past'>('all');
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({});
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<{
    id: string;
    coachName: string;
  } | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{
    id: string;
    coachName: string;
    amount: number;
    paymentDueAt: Date;
  } | null>(null);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [bookingToDecline, setBookingToDecline] = useState<string | null>(null);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [selectedBookingForParticipants, setSelectedBookingForParticipants] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [bookingToLeave, setBookingToLeave] = useState<string | null>(null);
  const [cancelGroupDialogOpen, setCancelGroupDialogOpen] = useState(false);
  const [groupToCancel, setGroupToCancel] = useState<string | null>(null);
  const [coachCancelDialogOpen, setCoachCancelDialogOpen] = useState(false);
  const [groupToCancelByCoach, setGroupToCancelByCoach] = useState<string | null>(null);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [bookingToDispute, setBookingToDispute] = useState<Booking | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const now = new Date();

  const filteredBookings = bookings.filter((booking) => {
    const bookingDate = new Date(booking.scheduledStartAt);
    const isPast = bookingDate < now;
    const isUpcoming = bookingDate >= now && (booking.status === 'accepted' || booking.status === 'pending');
    const isPending = booking.status === 'pending';

    let statusMatch = true;
    switch (filter) {
      case 'pending':
        statusMatch = isPending;
        break;
      case 'upcoming':
        statusMatch = isUpcoming && !isPast;
        break;
      case 'past':
        statusMatch = isPast || booking.status === 'completed' || booking.status === 'cancelled';
        break;
      default:
        statusMatch = true;
    }

    let dateMatch = true;
    if (dateRange.start || dateRange.end) {
      const bookingStart = new Date(booking.scheduledStartAt);
      if (dateRange.start && bookingStart < dateRange.start) {
        dateMatch = false;
      }
      if (dateRange.end) {
        const endOfDay = new Date(dateRange.end);
        endOfDay.setHours(23, 59, 59, 999);
        if (bookingStart > endOfDay) {
          dateMatch = false;
        }
      }
    }

    return statusMatch && dateMatch;
  });

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'awaiting_payment':
        return 'bg-orange-100 text-orange-800';
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
      case 'open':
        return 'bg-teal-100 text-teal-800';
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

  const handleDecline = (bookingId: string) => {
    setBookingToDecline(bookingId);
    setDeclineDialogOpen(true);
  };

  const confirmDecline = async () => {
    if (!bookingToDecline) return;

    setProcessingBookingId(bookingToDecline);
    setError(null);
    setDeclineDialogOpen(false);

    const result = await declineBooking(bookingToDecline);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Failed to decline booking');
      setProcessingBookingId(null);
    }

    setBookingToDecline(null);
  };

  const handleLeavePublicLesson = (bookingId: string) => {
    setBookingToLeave(bookingId);
    setLeaveDialogOpen(true);
  };

  const confirmLeavePublicLesson = async () => {
    if (!bookingToLeave) return;

    setProcessingBookingId(bookingToLeave);
    setError(null);
    setLeaveDialogOpen(false);

    const result = await leavePublicLesson(bookingToLeave);

    if (result.success) {
      toast.success('Successfully left the lesson');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to leave lesson');
      setError(result.error || 'Failed to leave lesson');
      setProcessingBookingId(null);
    }

    setBookingToLeave(null);
  };

  const handleReportIssue = (booking: Booking) => {
    setBookingToDispute(booking);
    setDisputeDialogOpen(true);
  };

  const confirmDispute = async () => {
    if (!bookingToDispute || !disputeReason.trim()) {
      toast.error('Please provide a reason for the dispute');
      return;
    }

    setProcessingBookingId(bookingToDispute.id);
    setError(null);
    setDisputeDialogOpen(false);

    const initiatedBy = userRole === 'client' ? 'client' : 'coach';
    const result = await initiateDispute(bookingToDispute.id, disputeReason, initiatedBy);

    if (result.success) {
      toast.success('Dispute submitted. Our team will review and contact you shortly.');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to submit dispute');
      setError(result.error || 'Failed to submit dispute');
      setProcessingBookingId(null);
    }

    setBookingToDispute(null);
    setDisputeReason('');
  };

  const handleCancelPrivateGroup = (bookingId: string) => {
    setGroupToCancel(bookingId);
    setCancelGroupDialogOpen(true);
  };

  const confirmCancelPrivateGroup = async () => {
    if (!groupToCancel) return;

    setProcessingBookingId(groupToCancel);
    setError(null);
    setCancelGroupDialogOpen(false);

    const result = await cancelPrivateGroupBooking(groupToCancel);

    if (result.success) {
      toast.success('Group booking cancelled successfully');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to cancel booking');
      setError(result.error || 'Failed to cancel booking');
      setProcessingBookingId(null);
    }

    setGroupToCancel(null);
  };

  const handleCoachCancelGroup = (bookingId: string) => {
    setGroupToCancelByCoach(bookingId);
    setCoachCancelDialogOpen(true);
  };

  const confirmCoachCancelGroup = async () => {
    if (!groupToCancelByCoach) return;

    setProcessingBookingId(groupToCancelByCoach);
    setError(null);
    setCoachCancelDialogOpen(false);

    const result = await coachCancelGroupLesson(groupToCancelByCoach);

    if (result.success) {
      toast.success('Group lesson cancelled successfully');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to cancel lesson');
      setError(result.error || 'Failed to cancel lesson');
      setProcessingBookingId(null);
    }

    setGroupToCancelByCoach(null);
  };

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

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

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Filter by date:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange(prev => ({
                  ...prev,
                  start: e.target.value ? new Date(e.target.value) : undefined
                }))}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
                placeholder="From date"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange(prev => ({
                  ...prev,
                  end: e.target.value ? new Date(e.target.value) : undefined
                }))}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
                placeholder="To date"
              />
              {(dateRange.start || dateRange.end) && (
                <button
                  onClick={() => setDateRange({})}
                  className="px-3 py-1 text-sm text-[#FF6B4A] hover:text-[#FF8C5A] font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(
                            booking.status
                          )}`}
                        >
                          {booking.status}
                        </span>
                        {booking.isGroupBooking && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {booking.groupType === 'public' ? 'PUBLIC GROUP' : 'PRIVATE GROUP'}
                          </span>
                        )}
                        {booking.pendingParticipantsCount && booking.pendingParticipantsCount > 0 && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {booking.pendingParticipantsCount} pending approval
                          </span>
                        )}
                        {booking.status === 'pending' && userRole === 'coach' && (
                          <span className="text-xs text-gray-500">Awaiting your response</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {otherUser?.image ? (
                            <Image src={otherUser.image} alt={otherUser.name} width={48} height={48} className="object-cover" />
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
                            <div className="text-sm text-gray-600">
                              {booking.isGroupBooking && booking.pricePerPerson 
                                ? `$${booking.pricePerPerson}/person` 
                                : 'Total amount'}
                            </div>
                          </div>
                        </div>

                        {booking.isGroupBooking && (
                          <div className="flex items-start gap-2">
                            <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {booking.currentParticipants || 0}/{booking.maxParticipants || 0} joined
                              </div>
                              <div className="text-sm text-gray-600">Participants</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {booking.clientMessage && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Message from client:</div>
                          <div className="text-sm text-gray-600">{booking.clientMessage}</div>
                        </div>
                      )}
                    </div>

                    <div className="ml-6 flex flex-col gap-2">
                      {booking.status === 'pending' && userRole === 'coach' && (
                        <>
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
                        </>
                      )}

                      {booking.isGroupBooking && (
                        <>
                          <Link href={`/dashboard/group-chat/${booking.id}`}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-blue-300 text-blue-600 hover:bg-blue-50"
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Group Chat
                            </Button>
                          </Link>
                          <Button
                            type="button"
                            onClick={() => {
                              setSelectedBookingForParticipants(booking.id);
                              setParticipantsModalOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="border-purple-300 text-purple-600 hover:bg-purple-50"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            View Participants
                          </Button>
                        </>
                      )}

                      {booking.isGroupBooking && userRole === 'client' && booking.groupType === 'public' && 
                       (booking.status === 'open' || booking.status === 'accepted') && 
                       new Date() < new Date(booking.scheduledStartAt) && (
                        <Button
                          type="button"
                          onClick={() => handleLeavePublicLesson(booking.id)}
                          disabled={processingBookingId === booking.id}
                          variant="outline"
                          className="border-orange-300 text-orange-600 hover:bg-orange-50"
                          size="sm"
                        >
                          {processingBookingId === booking.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Leave Lesson
                        </Button>
                      )}

                      {booking.isGroupBooking && userRole === 'client' && booking.groupType === 'private' && 
                       booking.organizerId === userId &&
                       ['pending', 'awaiting_payment', 'accepted'].includes(booking.status) && 
                       new Date() < new Date(booking.scheduledStartAt) && (
                        <Button
                          type="button"
                          onClick={() => handleCancelPrivateGroup(booking.id)}
                          disabled={processingBookingId === booking.id}
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          size="sm"
                        >
                          {processingBookingId === booking.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Cancel Group
                        </Button>
                      )}

                      {booking.isGroupBooking && userRole === 'coach' && 
                       (booking.status === 'open' || booking.status === 'accepted') && 
                       new Date() < new Date(booking.scheduledStartAt) && (
                        <Button
                          type="button"
                          onClick={() => handleCoachCancelGroup(booking.id)}
                          disabled={processingBookingId === booking.id}
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          size="sm"
                        >
                          {processingBookingId === booking.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Cancel Lesson
                        </Button>
                      )}

                      {(booking.status === 'accepted' || booking.status === 'completed') && (
                        <Button
                          type="button"
                          onClick={() => handleReportIssue(booking)}
                          disabled={processingBookingId === booking.id}
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          size="sm"
                        >
                          <Flag className="h-4 w-4 mr-2" />
                          Report Issue
                        </Button>
                      )}

                      {booking.status === 'awaiting_payment' && userRole === 'client' && booking.paymentDueAt && (
                        <>
                          <Button
                            type="button"
                            onClick={() => {
                              if (booking.paymentDueAt) {
                                setSelectedPayment({
                                  id: booking.id,
                                  coachName: booking.coach?.name || 'Coach',
                                  amount: parseFloat(booking.clientPaid),
                                  paymentDueAt: new Date(booking.paymentDueAt),
                                });
                                setPaymentModalOpen(true);
                              }
                            }}
                            className="bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90 text-white"
                            size="sm"
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Pay Now
                          </Button>
                          <div className="px-2 py-1 bg-orange-50 rounded text-xs text-orange-700 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            <CountdownTimer deadline={new Date(booking.paymentDueAt)} />
                          </div>
                        </>
                      )}

                      {booking.status === 'completed' && userRole === 'client' && !booking.review && (
                        <Button
                          type="button"
                          onClick={() => {
                            setSelectedBooking({
                              id: booking.id,
                              coachName: booking.coach?.name || 'Coach',
                            });
                            setReviewModalOpen(true);
                          }}
                          className="bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90 text-white"
                          size="sm"
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Leave Review
                        </Button>
                      )}

                      {booking.status === 'completed' && userRole === 'client' && booking.review && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-md border border-green-200">
                          <Star className="h-4 w-4 text-[#FF6B4A] fill-[#FF6B4A]" />
                          <span className="text-sm text-green-800 font-medium">Review submitted</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBooking && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setSelectedBooking(null);
          }}
          bookingId={selectedBooking.id}
          coachName={selectedBooking.coachName}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {selectedPayment && (
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedPayment(null);
          }}
          bookingId={selectedPayment.id}
          coachName={selectedPayment.coachName}
          amount={selectedPayment.amount}
          paymentDueAt={selectedPayment.paymentDueAt}
          onSuccess={() => {
            router.refresh();
            setPaymentModalOpen(false);
            setSelectedPayment(null);
          }}
        />
      )}

      {selectedBookingForParticipants && (
        <ParticipantsModal
          isOpen={participantsModalOpen}
          onClose={() => {
            setParticipantsModalOpen(false);
            setSelectedBookingForParticipants(null);
          }}
          bookingId={selectedBookingForParticipants}
        />
      )}

      <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Booking Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline this booking request? The client will be notified and can book a different time slot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDecline}
              className="bg-red-600 hover:bg-red-700"
            >
              Decline Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group Lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this group lesson? You will be refunded if you already paid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLeavePublicLesson}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Leave Lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelGroupDialogOpen} onOpenChange={setCancelGroupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Group Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this group booking? All participants will be notified and you will be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelPrivateGroup}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={coachCancelDialogOpen} onOpenChange={setCoachCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Group Lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this group lesson? All participants will be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCoachCancelGroup}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Issue Dialog */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>
              Let us know if there was a problem with this booking. Our support team will review your case.
            </DialogDescription>
          </DialogHeader>

          {bookingToDispute && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {userRole === 'coach' ? bookingToDispute.client?.name : bookingToDispute.coach?.name}
                </p>
                <p className="text-xs text-gray-600">
                  {new Date(bookingToDispute.scheduledStartAt).toLocaleDateString()} at{' '}
                  {new Date(bookingToDispute.scheduledStartAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe the issue
                </label>
                <Textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Please provide details about what went wrong..."
                  rows={5}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Be specific to help us resolve this quickly. Include times, locations, and any relevant details.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDisputeDialogOpen(false)}
                  disabled={processingBookingId === bookingToDispute.id}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDispute}
                  disabled={processingBookingId === bookingToDispute.id || !disputeReason.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {processingBookingId === bookingToDispute.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Report'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CountdownTimer({ deadline }: { deadline: Date }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = deadline.getTime() - now;

      if (distance < 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m left`);
      } else {
        setTimeLeft(`${minutes}m left`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);

    return () => clearInterval(interval);
  }, [deadline]);

  return <span>{timeLeft}</span>;
}
