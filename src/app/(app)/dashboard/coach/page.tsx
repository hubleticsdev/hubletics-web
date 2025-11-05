import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CreditCard,
  Inbox,
  MessageCircle,
  ShieldCheck,
  Target,
  UserCog,
} from 'lucide-react';
import { format } from 'date-fns';

import { getPendingBookingRequests, getUpcomingBookings } from '@/actions/bookings/queries';
import { CoachBookingCard } from '@/components/bookings/coach-booking-card';
import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

type StatusTone = 'warning' | 'info' | 'success';

type StatusBanner = {
  tone: StatusTone;
  title: string;
  description: string;
  cta?: { href: string; label: string };
  icon: LucideIcon;
};

type QuickAction = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type UpcomingBooking = Awaited<
  ReturnType<typeof getUpcomingBookings>
>['bookings'][number];

export default async function CoachDashboard() {
  const session = await requireRole('coach');

  const coach = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, session.user.id),
  });

  if (!coach) {
    redirect('/onboarding/coach');
  }

  const needsApproval = coach.adminApprovalStatus === 'pending';
  const needsStripeOnboarding =
    coach.adminApprovalStatus === 'approved' && !coach.stripeOnboardingComplete;
  const isFullyOnboarded =
    coach.adminApprovalStatus === 'approved' && coach.stripeOnboardingComplete;

  const { bookings: pendingRequests } = await getPendingBookingRequests();
  const { bookings: upcomingSessions } = await getUpcomingBookings();

  const reputationScoreValue = (() => {
    const raw = coach.reputationScore;
    const numeric =
      typeof raw === 'number'
        ? raw
        : Number.parseFloat(typeof raw === 'string' ? raw : '0');
    return Number.isFinite(numeric) ? numeric : 0;
  })();

  const reviewsCount = (() => {
    const raw = coach.totalReviews;
    const numeric =
      typeof raw === 'number'
        ? raw
        : Number.parseInt(typeof raw === 'string' ? raw : '0', 10);
    return Number.isFinite(numeric) ? numeric : 0;
  })();

  const statusBanners: StatusBanner[] = [];

  if (needsApproval) {
    statusBanners.push({
      tone: 'warning',
      title: 'Profile under review',
      description:
        "Our team is validating your certifications and background. We'll email you within 24–48 hours with an update.",
      icon: AlertTriangle,
    });
  }

  if (needsStripeOnboarding) {
    statusBanners.push({
      tone: 'info',
      title: 'Payment setup required',
      description:
        'You have the green light! Connect your Stripe Express account to start accepting bookings and payouts.',
      cta: {
        href: '/coach/stripe/onboarding',
        label: 'Complete payment setup',
      },
      icon: CreditCard,
    });
  }

  if (isFullyOnboarded) {
    statusBanners.push({
      tone: 'success',
      title: "You're live on Hubletics",
      description:
        'Your profile is verified, payments are enabled, and new athletes can book you instantly.',
      icon: ShieldCheck,
    });
  }

  const metrics = [
    {
      label: 'Pending requests',
      value: pendingRequests.length.toString(),
      caption:
        pendingRequests.length > 0
          ? 'Respond to earn new clients'
          : 'All caught up',
    },
    {
      label: 'Upcoming sessions',
      value: upcomingSessions.length.toString(),
      caption: 'Next 7 days',
    },
    {
      label: 'Reputation score',
      value: `${reputationScoreValue.toFixed(1)} ★`,
      caption: `${reviewsCount} reviews`,
    },
    {
      label: 'Lifetime earnings',
      value: '$0',
      caption: 'Payouts arrive 24h after sessions',
    },
  ];

  const quickActions: QuickAction[] = [
    {
      href: '/dashboard/bookings',
      title: 'Respond to bookings',
      description: 'Confirm, reschedule, or decline athlete requests.',
      icon: CalendarClock,
    },
    {
      href: '/dashboard/messages',
      title: 'Message athletes',
      description: 'Coordinate logistics and share prep work in chat.',
      icon: MessageCircle,
    },
    {
      href: '/dashboard/profile',
      title: 'Update profile',
      description: 'Refresh certifications, intro video, and pricing.',
      icon: UserCog,
    },
    {
      href: '/dashboard/availability',
      title: 'Manage availability',
      description: 'Sync new time slots and block travel days.',
      icon: Target,
    },
  ];

  const nextSession = upcomingSessions[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <HeroBanner
        coachName={coach.fullName}
        statuses={statusBanners}
        nextSession={nextSession}
      />

      <StatsStrip metrics={metrics} />

      <QuickActionsPanel
        actions={quickActions}
        highlightCount={pendingRequests.length}
      />

      <BookingSection
        title="Pending booking requests"
        description="Review details, message athletes, and confirm the sessions that fit."
        badge={
          isFullyOnboarded && pendingRequests.length > 0
            ? `${pendingRequests.length} awaiting response`
            : undefined
        }
        items={pendingRequests}
        empty={{
          icon: Inbox,
          title: 'No pending requests',
          description:
            'You have answered every inquiry. Keep an eye on your messages for new leads.',
        }}
        renderItem={(booking) => <CoachBookingCard key={booking.id} booking={booking} />}
      />

      <BookingSection
        title="Upcoming sessions"
        description="Prepare drills and equipment so athletes arrive ready to work."
        badge={
          upcomingSessions.length > 0
            ? `${upcomingSessions.length} on the calendar`
            : undefined
        }
        items={upcomingSessions}
        empty={{
          icon: CalendarDays,
          title: 'No sessions scheduled',
          description:
            'Secure more bookings by updating availability and responding quickly to new requests.',
        }}
        renderItem={(booking) => <CoachBookingCard key={booking.id} booking={booking} />}
      />
    </div>
  );
}

function HeroBanner({
  coachName,
  statuses,
  nextSession,
}: {
  coachName: string;
  statuses: StatusBanner[];
  nextSession?: UpcomingBooking;
}) {
  return (
    <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-gradient-to-br from-[#FF6B4A]/12 via-white to-[#FFB84D]/12 shadow-[0_45px_120px_-80px_rgba(15,23,42,0.7)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,107,74,0.18),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,184,77,0.18),transparent_60%)]" />

      <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex flex-col gap-6">
          <div className="space-y-4">
            <p className="inline-flex w-fit items-center rounded-full border border-[#FF6B4A]/30 bg-[#FF6B4A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-[#FF6B4A]">
              Coach HQ
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Welcome back, {coachName}!
            </h1>
            <p className="max-w-xl text-base text-slate-600 sm:text-lg">
              Monitor bookings, respond to athletes, and keep your coaching business in rhythm. The more responsive you are, the higher you climb in athlete searches.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {statuses.length > 0 ? (
              statuses.map((status) => <StatusCard key={status.title} {...status} />)
            ) : (
              <div className="rounded-2xl border border-white/60 bg-white/80 p-5 text-sm text-slate-600 shadow-sm">
                Everything looks good. Keep sharing highlights from recent sessions to stay top of mind for athletes.
              </div>
            )}
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
                Your calendar is open
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Update availability or respond to new requests to fill your week.
              </p>
              <Link
                href="/dashboard/availability"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-6 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
              >
                Add availability
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

function QuickActionsPanel({
  actions,
  highlightCount,
}: {
  actions: QuickAction[];
  highlightCount: number;
}) {
  return (
    <section className="rounded-[32px] border border-white/70 bg-white/90 shadow-[0_30px_90px_-75px_rgba(15,23,42,0.55)] backdrop-blur">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Quick actions
            </h2>
            <p className="text-sm text-slate-500">
              Keep your operations tight with the top workflows at hand.
            </p>
          </div>
          {highlightCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-[#FF6B4A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
              {highlightCount} requests waiting
            </span>
          )}
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

function StatusCard({ tone, title, description, cta, icon: Icon }: StatusBanner) {
  const toneClasses: Record<StatusTone, string> = {
    warning: 'border-amber-200/70 bg-amber-50 text-amber-800',
    info: 'border-slate-200/70 bg-white text-slate-700',
    success: 'border-emerald-200/70 bg-emerald-50 text-emerald-800',
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border px-4 py-4 shadow-sm sm:flex-row sm:items-start sm:justify-between',
        toneClasses[tone],
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-[#FF6B4A]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex w-fit items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_25px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function NextSessionCard({ booking }: { booking: UpcomingBooking }) {
  const start = new Date(booking.scheduledStartAt);
  const end = new Date(booking.scheduledEndAt);
  const amount = Number.parseFloat(booking.clientPaid ?? '0');
  const locationName = booking.location?.name ?? 'Location to be confirmed';
  const locationAddress = booking.location?.address ?? 'Address shared after confirmation';
  const durationLabel = Number.isFinite(booking.duration) ? `${booking.duration} min` : '—';

  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-7 shadow-[0_35px_100px_-70px_rgba(15,23,42,0.55)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
        Next session
      </p>
      <h3 className="mt-3 text-lg font-semibold text-slate-900">
        {booking.client?.name ?? 'Athlete'} · {locationName}
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
          <span>Address</span>
          <span className="max-w-[60%] truncate text-right font-semibold text-slate-900">
            {locationAddress}
          </span>
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
          <p className="font-semibold text-slate-900">
            Note from {booking.client?.name ?? 'athlete'}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{booking.clientMessage}</p>
        </div>
      )}
    </div>
  );
}
