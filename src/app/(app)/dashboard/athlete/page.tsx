import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Compass,
  MessageCircle,
  Sparkles,
  UserCog,
} from 'lucide-react';
import { format } from 'date-fns';

import { getMyBookings, getUpcomingBookings } from '@/actions/bookings/queries';
import { AthleteBookingCard } from '@/components/bookings/athlete-booking-card';
import { getAthleteSpendSummary } from '@/actions/athlete/spend';
import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { athleteProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

type QuickAction = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type UpcomingBooking = Awaited<
  ReturnType<typeof getUpcomingBookings>
>['bookings'][number];

export default async function AthleteDashboard() {
  const session = await requireRole('client');

  const athlete = await db.query.athleteProfile.findFirst({
    where: eq(athleteProfile.userId, session.user.id),
  });

  if (!athlete) {
    redirect('/onboarding/athlete');
  }

  const { bookings: upcomingBookings } = await getUpcomingBookings();
  const { bookings: pendingBookings } = await getMyBookings('awaiting_coach');
  const spendSummary = await getAthleteSpendSummary();

  const sportsInterested = athlete.sportsInterested ?? [];
  const nextSession = upcomingBookings[0];

  const metrics = [
    {
      label: 'Upcoming sessions',
      value: upcomingBookings.length.toString(),
      caption: upcomingBookings.length > 0 ? 'Pack your gear!' : 'No sessions scheduled',
    },
    {
      label: 'Pending requests',
      value: pendingBookings.length.toString(),
      caption:
        pendingBookings.length > 0
          ? 'Awaiting coach confirmation'
          : 'Every request is confirmed',
    },
    {
      label: 'Active sports',
      value: sportsInterested.length.toString(),
      caption: 'Tailor your feed with interests',
    },
    {
      label: 'Lifetime spend',
      value: `$${spendSummary.totalSpent.toFixed(2)}`,
      caption: 'Track receipts inside billing',
    },
  ];

  const quickActions: QuickAction[] = [
    {
      href: '/coaches',
      title: 'Discover new coaches',
      description: 'Search by sport, experience, and availability to find your fit.',
      icon: Compass,
    },
    {
      href: '/dashboard/bookings',
      title: 'Review bookings',
      description: 'See upcoming sessions, history, and payment status.',
      icon: CalendarClock,
    },
    {
      href: '/dashboard/messages',
      title: 'Chat with coaches',
      description: 'Share training goals, locations, and updates in real time.',
      icon: MessageCircle,
    },
    {
      href: '/dashboard/profile',
      title: 'Customize profile',
      description: 'Update goals, availability, and parent/guardian contacts.',
      icon: UserCog,
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <HeroBanner
        athleteName={athlete.fullName}
        sportsInterested={sportsInterested}
        nextSession={nextSession}
      />

      <StatsStrip metrics={metrics} />

      <QuickActionsPanel actions={quickActions} />

      <BookingSection
        title="Pending requests"
        description="Coaches are reviewing these sessions. You'll get an email once they respond."
        badge={
          pendingBookings.length > 0
            ? `${pendingBookings.length} awaiting confirmation`
            : undefined
        }
        items={pendingBookings}
        empty={{
          icon: MessageCircle,
          title: 'No pending requests',
          description:
            'Every request has been answered. Browse coaches to plan your next training block.',
          action: { href: '/coaches', label: 'Find coaches' },
        }}
        renderItem={(booking) => <AthleteBookingCard key={booking.id} booking={booking} />}
      />

      <BookingSection
        title="Upcoming sessions"
        description="Review locations, bring the right equipment, and arrive early to lock in the reps."
        badge={
          upcomingBookings.length > 0
            ? `${upcomingBookings.length} booked`
            : undefined
        }
        items={upcomingBookings}
        empty={{
          icon: CalendarDays,
          title: 'No sessions scheduled',
          description:
            'Keep the momentum going by booking your next workout with a coach who fits your goals.',
          action: { href: '/coaches', label: 'Book a session' },
        }}
        renderItem={(booking) => <AthleteBookingCard key={booking.id} booking={booking} />}
      />

      <InterestsSection sportsInterested={sportsInterested} />
    </div>
  );
}

function HeroBanner({
  athleteName,
  sportsInterested,
  nextSession,
}: {
  athleteName: string;
  sportsInterested: string[];
  nextSession?: UpcomingBooking;
}) {
  const sportsLabel =
    sportsInterested.length === 0
      ? 'Add interests to personalise your recommendations.'
      : `${sportsInterested.length} sport${sportsInterested.length === 1 ? '' : 's'} on your radar.`;

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-gradient-to-br from-[#FF6B4A]/12 via-white to-[#FFB84D]/12 shadow-[0_45px_120px_-80px_rgba(15,23,42,0.7)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,107,74,0.18),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,184,77,0.18),transparent_60%)]" />

      <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex flex-col gap-6">
          <div className="space-y-4">
            <p className="inline-flex w-fit items-center rounded-full border border-[#FF6B4A]/30 bg-[#FF6B4A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-[#FF6B4A]">
              Athlete hub
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Welcome back, {athleteName}!
            </h1>
            <p className="max-w-xl text-base text-slate-600 sm:text-lg">
              Keep your training pipeline organized, measure progress, and stay connected with coaches. The more consistent you are, the faster your game levels up.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/60 bg-white/80 p-5 text-sm text-slate-600 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
                Training focus
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {sportsLabel}
              </p>
              <Link
                href="/dashboard/profile"
                className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-white shadow-[0_12px_30px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
              >
                Update interests
              </Link>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/80 p-5 text-sm text-slate-600 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
                Next steps
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Explore new coaches or message your favorites to plan upcoming sessions.
              </p>
              <Link
                href="/coaches"
                className="mt-4 inline-flex items-center justify-center rounded-full border border-[#FF6B4A]/30 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#FF6B4A] transition hover:border-[#FF6B4A]"
              >
                Browse coaches
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {nextSession ? (
            <NextSessionCard booking={nextSession} />
          ) : (
            <div className="rounded-3xl border border-white/70 bg-white/85 p-7 text-center shadow-[0_30px_90px_-70px_rgba(15,23,42,0.55)]">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Next session
              </p>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                No workouts booked yet
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Schedule a session with a coach to keep progressing toward your goals.
              </p>
              <Link
                href="/coaches"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-6 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
              >
                Book a coach
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatsStrip({
  metrics,
}: {
  metrics: { label: string; value: string; caption: string }[];
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_28px_80px_-70px_rgba(15,23,42,0.55)] backdrop-blur"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
            {metric.label}
          </span>
          <p className="mt-4 text-3xl font-semibold text-slate-900">{metric.value}</p>
          <p className="mt-2 text-xs text-slate-500">{metric.caption}</p>
        </div>
      ))}
    </section>
  );
}

function QuickActionsPanel({ actions }: { actions: QuickAction[] }) {
  return (
    <section className="rounded-[32px] border border-white/70 bg-white/90 shadow-[0_30px_90px_-75px_rgba(15,23,42,0.55)] backdrop-blur">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Jump back in
            </h2>
            <p className="text-sm text-slate-500">
              Fast access to the tools that keep your training momentum going.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-[#FF6B4A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
            Stay consistent
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {actions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="group flex items-start gap-4 rounded-2xl border border-slate-100/80 bg-white/75 p-5 transition hover:-translate-y-0.5 hover:border-[#FF6B4A]/40 hover:bg-white"
            >
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6B4A]/10 text-[#FF6B4A]">
                <action.icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-900">{action.title}</h3>
                <p className="text-sm text-slate-500">{action.description}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.32em] text-[#FF6B4A] opacity-0 transition group-hover:opacity-100">
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function BookingSection<T>({
  title,
  description,
  badge,
  items,
  empty,
  renderItem,
}: {
  title: string;
  description: string;
  badge?: string;
  items: T[];
  empty: {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: { href: string; label: string };
  };
  renderItem: (item: T) => React.ReactNode;
}) {
  const { icon: Icon, title: emptyTitle, description: emptyDescription, action } = empty;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        {badge && (
          <span className="text-sm font-semibold text-slate-500">{badge}</span>
        )}
      </div>

      {items.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">{items.map((item) => renderItem(item))}</div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-8 py-12 text-center text-sm text-slate-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF6B4A]/10 text-[#FF6B4A]">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">{emptyTitle}</h3>
          <p className="max-w-md text-sm text-slate-500">{emptyDescription}</p>
          {action && (
            <Link
              href={action.href}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-5 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-white shadow-[0_12px_30px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
            >
              {action.label}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function InterestsSection({ sportsInterested }: { sportsInterested: string[] }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.55)] backdrop-blur sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Sports you’re tracking
          </h2>
          <p className="text-sm text-slate-500">
            Tune recommendations by updating your interest list.
          </p>
        </div>
        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-2 rounded-full border border-[#FF6B4A]/30 bg-[#FF6B4A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]"
        >
          <Sparkles className="h-4 w-4" />
          Update interests
        </Link>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {sportsInterested.length > 0 ? (
          sportsInterested.map((sport) => (
            <Link
              key={sport}
              href={`/coaches?sport=${encodeURIComponent(sport)}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#FF6B4A]/50 hover:text-[#FF6B4A]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#FF6B4A] to-[#FFB84D]" />
              {sport}
            </Link>
          ))
        ) : (
          <p className="text-sm text-slate-500">
            Add your favorite sports to get personalized coach suggestions.
          </p>
        )}
      </div>
    </section>
  );
}

function NextSessionCard({ booking }: { booking: UpcomingBooking }) {
  const start = new Date(booking.scheduledStartAt);
  const end = new Date(booking.scheduledEndAt);
  const amount = booking.expectedGrossCents ? booking.expectedGrossCents / 100 : 0;
  const coachName = booking.coach?.name ?? 'Your coach';
  const locationName = booking.location?.name ?? 'Location to be confirmed';
  const durationLabel = Number.isFinite(booking.duration) ? `${booking.duration} min` : '—';

  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-7 shadow-[0_35px_100px_-70px_rgba(15,23,42,0.55)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
        Next session
      </p>
      <h3 className="mt-3 text-lg font-semibold text-slate-900">
        {coachName} · {locationName}
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        {format(start, 'EEEE, MMM d')} · {format(start, 'p')} – {format(end, 'p')}
      </p>
      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span>Duration</span>
          <span className="font-semibold text-slate-900">{durationLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Total</span>
          <span className="font-semibold text-[#FF6B4A]">
            ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}
          </span>
        </div>
      </div>
      {booking.clientMessage && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/90 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Note from your coach</p>
          <p className="mt-1 text-sm leading-relaxed">{booking.clientMessage}</p>
        </div>
      )}
    </div>
  );
}
