'use client';

import { useState } from 'react';
import { PublicLessonsList } from './public-lessons-list';
import { JoinLessonModal } from './join-lesson-modal';

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

interface PublicLessonsListWrapperProps {
  lessons: PublicLesson[];
  canJoin: boolean;
  coachName: string;
}

export function PublicLessonsListWrapper({ lessons, canJoin, coachName }: PublicLessonsListWrapperProps) {
  const [selectedLesson, setSelectedLesson] = useState<PublicLesson | null>(null);

  const handleJoin = (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) {
      setSelectedLesson(lesson);
    }
  };

  return (
    <>
      <PublicLessonsList lessons={lessons} canJoin={canJoin} onJoin={handleJoin} />
      {selectedLesson && (
        <JoinLessonModal
          lesson={selectedLesson}
          coachName={coachName}
          isOpen={true}
          onClose={() => setSelectedLesson(null)}
        />
      )}
    </>
  );
}

