'use client';

import Link from 'next/link';
import { Users, Calendar, MapPin, DollarSign, MessageCircle, Trash2 } from 'lucide-react';
import { formatDateOnly, formatTimeOnly } from '@/lib/utils/date';
import { formatUiBookingStatus } from '@/lib/booking-status';
import type { UiBookingStatus } from '@/lib/booking-status';
import { Button } from '@/components/ui/button';

interface PublicGroupLessonCardProps {
    booking: {
        id: string;
        scheduledStartAt: Date;
        scheduledEndAt?: Date;
        duration?: number;
        location?: {
            name: string;
            address: string;
            notes?: string;
        };
        status: UiBookingStatus;
        pricePerPerson?: string | null;
        maxParticipants?: number | null;
        currentParticipants?: number | null;
        description?: string | null;
    };
    timezone?: string;
    onCancel?: () => void;
}

export function PublicGroupLessonCard({
    booking,
    timezone = 'America/Chicago',
    onCancel
}: PublicGroupLessonCardProps) {
    const startDate = new Date(booking.scheduledStartAt);
    const endDate = booking.scheduledEndAt ? new Date(booking.scheduledEndAt) : null;

    const statusClass = (() => {
        switch (booking.status) {
            case 'open':
                return 'bg-teal-100 text-teal-800';
            case 'confirmed':
                return 'bg-green-100 text-green-800';
            case 'completed':
                return 'bg-blue-100 text-blue-800';
            case 'cancelled':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    })();

    const spotsLeft = (booking.maxParticipants || 0) - (booking.currentParticipants || 0);

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="h-5 w-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Public Group Lesson</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass}`}>
                            {formatUiBookingStatus(booking.status)}
                        </span>
                        <span className="text-sm text-gray-600">
                            {booking.currentParticipants || 0}/{booking.maxParticipants || 0} joined
                            {spotsLeft > 0 && ` • ${spotsLeft} spots left`}
                        </span>
                    </div>
                </div>
                {booking.pricePerPerson && (
                    <div className="text-right">
                        <div className="text-lg font-bold text-[#FF6B4A]">
                            ${parseFloat(booking.pricePerPerson).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">per person</div>
                    </div>
                )}
            </div>

            {/* Details */}
            <div className="space-y-3 mb-4">
                <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-[#FF6B4A] mt-0.5 shrink-0" />
                    <div>
                        <div className="font-medium text-gray-900">
                            {formatDateOnly(startDate, timezone)}
                        </div>
                        <div className="text-sm text-gray-600">
                            {formatTimeOnly(startDate, timezone)}
                            {endDate && booking.duration && (
                                <> - {formatTimeOnly(endDate, timezone)} ({booking.duration} min)</>
                            )}
                        </div>
                    </div>
                </div>

                {booking.location && (
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-[#FF6B4A] mt-0.5 shrink-0" />
                        <div>
                            <div className="font-medium text-gray-900">{booking.location.name}</div>
                            <div className="text-sm text-gray-600">{booking.location.address}</div>
                            {booking.location.notes && (
                                <div className="text-sm text-gray-500 italic mt-1">{booking.location.notes}</div>
                            )}
                        </div>
                    </div>
                )}

                {booking.description && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">{booking.description}</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                {booking.status !== 'cancelled' && (
                    <Link href={`/dashboard/messages/group/${booking.id}`} className="flex-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                        >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Group Chat
                        </Button>
                    </Link>
                )}
                {onCancel && booking.status !== 'cancelled' && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cancel
                    </Button>
                )}
            </div>
        </div>
    );
}
