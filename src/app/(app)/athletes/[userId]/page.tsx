import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { db } from '@/lib/db';
import { athleteProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { getHighResImageUrl } from '@/lib/utils';

type Athlete = NonNullable<
  Awaited<ReturnType<typeof db.query.athleteProfile.findFirst>>
>;

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getSession();

  // Fetch athlete profile
  const athlete = await db.query.athleteProfile.findFirst({
    where: eq(athleteProfile.userId, userId),
    with: {
      user: {
        columns: {
          name: true,
          username: true,
          image: true,
          email: false,
        },
      },
    },
  });

  if (!athlete) {
    notFound();
  }


  const displayImage = getHighResImageUrl(athlete.profilePhoto || athlete.user.image);
  const isOwner = !!session && session.user.id === userId;
  const isCoach = !!session && session.user.role === 'coach';
  const isAdmin = !!session && session.user.role === 'admin';
  const canMessageAthlete = (isCoach || isAdmin) && !isOwner;

  // Format budget display
  const budgetDisplay = (() => {
    const budget = athlete.budgetRange;
    if ('single' in budget) {
      return `$${budget.single}/session`;
    }
    return `$${budget.min} - $${budget.max}/session`;
  })();

  // Format location
  const locationDisplay = `${athlete.location.city}, ${athlete.location.state}`;

  return (
    <div className="relative isolate min-h-screen bg-slate-50 text-slate-900 pt-16">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href={isCoach ? '/dashboard/coach/athletes' : '/coaches'}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 transition hover:border-[#FF6B4A]/40 hover:text-[#FF6B4A]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
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
              Athlete profile
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-[36px] border border-white/70 bg-white/95 p-8 shadow-[0_45px_120px_-80px_rgba(15,23,42,0.7)] backdrop-blur sm:p-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="shrink-0">
              <div className="relative h-48 w-48 overflow-hidden rounded-[28px] shadow-[0_30px_90px_-60px_rgba(15,23,42,0.6)]">
                <Image src={displayImage} alt={athlete.fullName} fill sizes="192px" className="object-cover" />
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {athlete.fullName}
                  </h1>
                  <span className="text-xl font-normal text-slate-500">
                    @{athlete.user.username}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {locationDisplay}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#FF6B4A]/20 bg-gradient-to-br from-orange-50 to-red-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
                  Training budget
                </p>
                <p className="mt-2 text-2xl font-bold text-[#FF6B4A]">
                  {budgetDisplay}
                </p>
              </div>

              {canMessageAthlete && (
                <div className="pt-2">
                  <Link
                    href={`/dashboard/messages?new=${userId}`}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Message Athlete
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-10 md:grid-cols-2">
          <SportsInterestedSection athlete={athlete} />
          <ExperienceLevelsSection athlete={athlete} />
          <AthleteAboutSection athlete={athlete} />
        </section>
      </main>
    </div>
  );
}

function SportsInterestedSection({ athlete }: { athlete: Athlete }) {
  const sports = athlete.sportsInterested ?? [];
  return (
    <section className="space-y-4 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_35px_90px_-70px_rgba(15,23,42,0.55)] backdrop-blur">
      <h2 className="text-2xl font-semibold text-slate-900">Sports interested</h2>
      {sports.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sports.map((sport, index) => (
            <span
              key={`${sport}-${index}`}
              className="inline-flex items-center rounded-full border border-[#FF6B4A]/35 bg-[#FF6B4A]/10 px-3 py-1 text-sm font-semibold text-[#FF6B4A]"
            >
              {sport}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-slate-600">
          This athlete hasn’t added sports yet.
        </p>
      )}
    </section>
  );
}

function ExperienceLevelsSection({ athlete }: { athlete: Athlete }) {
  const experienceEntries = Object.entries(athlete.experienceLevel ?? {});
  return (
    <section className="space-y-4 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_35px_90px_-70px_rgba(15,23,42,0.55)] backdrop-blur">
      <h2 className="text-2xl font-semibold text-slate-900">Experience levels</h2>
      {experienceEntries.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {experienceEntries.map(([sport, exp]) => (
            <div key={sport} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-semibold text-slate-900">{sport}</p>
              <p className="text-sm capitalize text-slate-600">{exp.level}</p>
              {exp.notes && (
                <p className="mt-1 text-xs text-slate-500">{exp.notes}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-slate-600">
          No experience levels shared yet.
        </p>
      )}
    </section>
  );
}

function AthleteAboutSection({ athlete }: { athlete: Athlete }) {
  return (
    <section className="space-y-4 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_35px_90px_-70px_rgba(15,23,42,0.55)] backdrop-blur md:col-span-2">
      <h2 className="text-2xl font-semibold text-slate-900">About</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
        {athlete.bio ||
          'This athlete is updating their bio. Message them to learn more about their goals and training preferences.'}
      </p>
    </section>
  );
}
