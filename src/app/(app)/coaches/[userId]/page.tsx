import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';

import { getCoachBookings } from '@/actions/coaches/availability';
import { getCoachPublicProfile } from '@/actions/coaches/search';
import { BookingModalTrigger } from '@/components/bookings/booking-modal-trigger';
import { getSession } from '@/lib/auth/session';
import { ReviewsList } from '@/components/reviews/reviews-list';
import { getCoachReviews } from '@/actions/reviews/create';
import { getPublicGroupLessons } from '@/actions/group-bookings/queries';
import { PublicLessonsListWrapper } from '@/components/group-bookings/public-lessons-list-wrapper';

export default async function CoachProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const coach = await getCoachPublicProfile(userId);
  const session = await getSession();

  if (!coach) {
    notFound();
  }

  const displayImage = coach.profilePhoto || coach.user.image || '/placeholder-avatar.png';
  const reputationScore = parseFloat(coach.reputationScore as unknown as string);
  const rating = Number.isFinite(reputationScore) ? reputationScore / 20 : 0;
  const coachHourlyRate = Number.parseFloat(coach.hourlyRate as unknown as string);

  const locationDisplay = coach.location
    ? `${coach.location.cities.join(', ')}, ${coach.location.state}`
    : 'Location shared after booking';

  const canBook = !!session && session.user.role === 'client';
  const isOwner = !!session && session.user.id === userId;

  const { bookings: existingBookings } = await getCoachBookings(userId);
  const { reviews } = await getCoachReviews(userId, 20);
  const { lessons: publicLessons } = await getPublicGroupLessons(userId);

  const sortedBookings = [...existingBookings].sort(
    (a, b) =>
      new Date(a.scheduledStartAt).getTime() -
      new Date(b.scheduledStartAt).getTime(),
  );

  const rawAvailability = coach.weeklyAvailability || {};
  const availability = Object.keys(rawAvailability).length > 0
    ? Object.fromEntries(
        Object.entries(rawAvailability).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ])
      )
    : {
        monday: [{ start: '09:00', end: '17:00' }],
        tuesday: [{ start: '09:00', end: '17:00' }],
        wednesday: [{ start: '09:00', end: '17:00' }],
        thursday: [{ start: '09:00', end: '17:00' }],
        friday: [{ start: '09:00', end: '17:00' }],
      };

  const blockedDates = coach.blockedDates || [];
  const sessionDuration = coach.sessionDuration || 60;
  const nextSession = sortedBookings.find(
    (booking) => new Date(booking.scheduledStartAt) >= new Date(),
  );

  return (
    <div className="relative isolate min-h-screen bg-slate-50 text-slate-900 pt-16">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/coaches"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 transition hover:border-[#FF6B4A]/40 hover:text-[#FF6B4A]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to coaches
          </Link>
          <div className="flex items-center gap-3">
            {isOwner && (
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-2 rounded-full border border-[#FF6B4A]/40 bg-[#FF6B4A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A] transition hover:bg-[#FF6B4A]/20"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </Link>
            )}
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Verified coach profile
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:auto-rows-min lg:items-start">
          <section className="rounded-[36px] border border-white/70 bg-white/95 p-8 shadow-[0_45px_120px_-80px_rgba(15,23,42,0.7)] backdrop-blur sm:p-12 lg:col-start-1">
            <ProfileSummary
              coach={coach}
              displayImage={displayImage}
              rating={rating}
              locationDisplay={locationDisplay}
            />
          </section>

          <aside className="self-start lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-4">
            <BookingSummary
              canBook={canBook}
              coach={coach}
              userId={userId}
              sessionDuration={sessionDuration}
              availability={availability}
              blockedDates={blockedDates}
              existingBookings={existingBookings}
              nextSession={nextSession}
              introVideo={coach.introVideo}
              coachHourlyRate={coachHourlyRate}
            />
          </aside>

          <div className="grid gap-10 md:grid-cols-2 lg:col-start-1">
            <AboutSection coach={coach} />
            <ExperienceSection coach={coach} />
          </div>

          {publicLessons && publicLessons.length > 0 && (
            <section className="space-y-6 lg:col-start-1">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">Upcoming Group Lessons</h2>
              </div>
              <PublicLessonsListWrapper
                lessons={publicLessons}
                canJoin={canBook}
                coachName={coach.fullName}
              />
            </section>
          )}

          <section className="space-y-6 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_35px_100px_-70px_rgba(15,23,42,0.55)] backdrop-blur lg:col-start-1">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">
                Reviews {coach.totalReviews > 0 && `(${coach.totalReviews})`}
              </h2>
              {coach.totalReviews > 0 && reputationScore > 0 && (
                <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 shadow-sm backdrop-blur">
                  <svg className="h-5 w-5 text-[#FF6B4A]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-semibold text-slate-900">{rating.toFixed(1)}</span>
                  <span className="text-sm text-slate-600">average</span>
                </div>
              )}
            </div>
            <ReviewsList reviews={reviews} coachName={coach.fullName} />
          </section>
        </div>
      </main>
    </div>
  );
}

function ProfileSummary({
  coach,
  displayImage,
  rating,
  locationDisplay,
}: {
  coach: NonNullable<Awaited<ReturnType<typeof getCoachPublicProfile>>>;
  displayImage: string;
  rating: number;
  locationDisplay: string;
}) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex-shrink-0">
        <div className="relative h-48 w-48 overflow-hidden rounded-[28px] shadow-[0_30px_90px_-60px_rgba(15,23,42,0.6)]">
          <Image src={displayImage} alt={coach.fullName} fill className="object-cover" />
        </div>
      </div>
      <div className="flex-1 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {coach.fullName}
            </h1>
            <span className="text-xl text-slate-500 font-normal">
              @{coach.user.username}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <RatingDisplay rating={rating} reviews={coach.totalReviews} />
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {locationDisplay}
            </span>
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {coach.totalLessonsCompleted} sessions completed
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Specialties
          </h2>
          <div className="flex flex-wrap gap-3">
            {coach.specialties.map((specialty, index) => (
              <div key={`${specialty.sport}-${index}`} className="space-y-1">
                <span className="inline-flex items-center rounded-full border border-[#FF6B4A]/35 bg-[#FF6B4A]/10 px-3 py-1 text-sm font-semibold text-[#FF6B4A]">
                  {specialty.sport}
                </span>
                {specialty.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {specialty.tags.map((tag, tagIndex) => (
                      <span
                        key={`${specialty.sport}-${tag}-${tagIndex}`}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingSummary({
  canBook,
  coach,
  userId,
  sessionDuration,
  availability,
  blockedDates,
  existingBookings,
  nextSession,
  introVideo,
  coachHourlyRate,
}: {
  canBook: boolean;
  coach: NonNullable<Awaited<ReturnType<typeof getCoachPublicProfile>>>;
  userId: string;
  sessionDuration: number;
  availability: Record<string, Array<{ start: string; end: string }>>;
  blockedDates: string[];
  existingBookings: Array<{ scheduledStartAt: Date; scheduledEndAt: Date }>;
  nextSession?: { scheduledStartAt: Date; scheduledEndAt: Date };
  introVideo?: string | null;
  coachHourlyRate: number;
}) {
  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_35px_100px_-70px_rgba(15,23,42,0.55)] backdrop-blur">
      {introVideo && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-black/5">
          <video src={introVideo} controls className="aspect-video w-full bg-black object-cover">
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
          Hourly rate
        </p>
        <p className="text-4xl font-semibold text-[#FF6B4A]">
          ${Number.isFinite(coachHourlyRate) ? coachHourlyRate.toFixed(2) : '0.00'}
          <span className="ml-1 text-base font-medium text-slate-500">/hr</span>
        </p>
        <p className="text-sm text-slate-500">
          Session duration: {sessionDuration} minutes
        </p>
      </div>

      {nextSession ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Next confirmed session</p>
          <p className="mt-1 text-sm text-slate-500">
            {format(nextSession.scheduledStartAt, 'EEEE, MMM d')} · {format(nextSession.scheduledStartAt, 'p')} –{' '}
            {format(nextSession.scheduledEndAt, 'p')}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">No sessions booked yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Choose a time slot that works for you to get started with {coach.fullName.split(' ')[0]}.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Training philosophy</p>
        <p className="mt-1 leading-relaxed">
          Message this coach to hear about their approach to player development and session structure.
        </p>
      </div>

      {canBook ? (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/dashboard/messages?new=${userId}`}
            className="inline-flex items-center justify-center rounded-full border border-[#FF6B4A]/40 bg-white px-6 py-2 text-sm font-semibold text-[#FF6B4A] transition hover:border-[#FF6B4A]"
          >
            Message coach
          </Link>
          <BookingModalTrigger
            coachId={coach.userId}
            coachName={coach.fullName}
            hourlyRate={coachHourlyRate}
            sessionDuration={sessionDuration}
            availability={availability}
            blockedDates={blockedDates}
            existingBookings={existingBookings}
            preferredLocations={coach.preferredLocations || []}
            allowPrivateGroups={coach.allowPrivateGroups || false}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-600">
          Sign in as an athlete to book sessions or chat with this coach.
        </div>
      )}
    </div>
  );
}

function AboutSection({
  coach,
}: {
  coach: NonNullable<Awaited<ReturnType<typeof getCoachPublicProfile>>>;
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_35px_90px_-70px_rgba(15,23,42,0.55)] backdrop-blur">
      <h2 className="text-2xl font-semibold text-slate-900">About {coach.fullName.split(' ')[0]}</h2>
      <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
        {coach.bio || 'This coach is updating their bio. Message them to learn more about their coaching style and experience.'}
      </p>
    </section>
  );
}

function ExperienceSection({
  coach,
}: {
  coach: NonNullable<Awaited<ReturnType<typeof getCoachPublicProfile>>>;
}) {
  const certifications = Array.isArray(coach.certifications)
    ? coach.certifications
    : [];
  const accomplishmentsText = coach.accomplishments || '';
  const hasCertifications = certifications.length > 0;
  const hasAccomplishments = accomplishmentsText.length > 0;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.55)] backdrop-blur">
        <h3 className="text-xl font-semibold text-slate-900">Experience highlights</h3>
        <ul className="mt-4 space-y-3 text-sm text-slate-600">
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-[#FF6B4A]" />
            Experienced coach working with youth, prep, and competitive athletes.
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-[#FF6B4A]" />
            {coach.totalLessonsCompleted} Hubletics sessions completed with verified feedback.
          </li>
        </ul>
      </div>

      {hasCertifications && (
        <div className="rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.55)] backdrop-blur">
          <h3 className="text-xl font-semibold text-slate-900">Certifications</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {certifications.map((cert, index) => (
              <li key={`${cert.name}-${index}`}>
                {cert.name} - {cert.org} ({new Date(cert.issueDate).getFullYear()})
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasAccomplishments && (
        <div className="rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.55)] backdrop-blur">
          <h3 className="text-xl font-semibold text-slate-900">Notable accomplishments</h3>
          <p className="mt-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {accomplishmentsText}
          </p>
        </div>
      )}
    </section>
  );
}

function RatingDisplay({
  rating,
  reviews,
}: {
  rating: number;
  reviews: number;
}) {
  const rounded = Math.round((rating || 0) * 10) / 10;
  return (
    <span className="inline-flex items-center gap-2">
      <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="font-semibold text-slate-900">{rounded.toFixed(1)}</span>
      <span className="text-xs text-slate-500">({reviews} reviews)</span>
    </span>
  );
}
