'use client';

import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, DollarSign } from 'lucide-react';
import { formatBookingDateTime } from '@/lib/utils/date';

interface PublicLesson {
  id: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  duration: number;
  location: {
    name: string;
    address: string;
  };
  maxParticipants: number | null;
  minParticipants: number | null;
  pricePerPerson: string | null;
  currentParticipants: number;
  clientMessage: string | null;
}

interface PublicLessonsListProps {
  lessons: PublicLesson[];
  canJoin: boolean;
  onJoin: (lessonId: string) => void;
}

export function PublicLessonsList({ lessons, canJoin, onJoin }: PublicLessonsListProps) {
  if (lessons.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No upcoming group lessons</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lessons.map((lesson) => {
        if (!lesson.maxParticipants || !lesson.pricePerPerson) return null;
        
        const spotsLeft = lesson.maxParticipants - lesson.currentParticipants;
        const isAlmostFull = spotsLeft <= 2 && spotsLeft > 0;
        const isFull = spotsLeft === 0;

        return (
          <div
            key={lesson.id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="h-5 w-5 text-[#FF6B4A]" />
                  <span className="text-lg font-semibold text-gray-900">
                    {formatBookingDateTime(new Date(lesson.scheduledStartAt))}
                  </span>
                </div>

                {lesson.clientMessage && (
                  <p className="text-gray-700 mb-3">{lesson.clientMessage}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{lesson.location.name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>
                      {lesson.currentParticipants}/{lesson.maxParticipants} joined
                      {lesson.minParticipants && ` (min: ${lesson.minParticipants})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-semibold text-gray-900">
                      ${parseFloat(lesson.pricePerPerson).toFixed(2)}/person
                    </span>
                  </div>
                </div>
              </div>

              <div className="ml-6 flex flex-col items-end gap-2">
                {isFull ? (
                  <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium text-sm">
                    Full
                  </div>
                ) : isAlmostFull ? (
                  <div className="px-4 py-2 bg-orange-50 text-orange-700 rounded-lg font-medium text-sm border border-orange-200">
                    {spotsLeft} spot{spotsLeft > 1 ? 's' : ''} left!
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium text-sm">
                    {spotsLeft} spots available
                  </div>
                )}

                {canJoin && !isFull && (
                  <Button
                    onClick={() => onJoin(lesson.id)}
                    className="bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90"
                  >
                    Join Lesson
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

