'use client';

import Link from 'next/link';
import { authPaths } from '@/lib/paths';
import { motion, useInView } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useMemo, useRef } from 'react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const brandGradient = 'from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D]';

const heroBullets = [
  {
    title: 'Background-checked & certified',
    description: 'We verify identity, credentials, and experience for every coach before they meet your athletes.',
  },
  {
    title: 'Facility-friendly scheduling',
    description: 'Book sessions at public courts, fields, and parks that keep training affordable and flexible.',
  },
  {
    title: 'Protected payments',
    description: 'Stripe-powered escrow holds funds securely until training is complete, so everyone has peace of mind.',
  },
];

const heroMetrics = [
  { value: '52,000+', label: 'Training sessions completed' },
  { value: '4.9/5', label: 'Average coach rating' },
  { value: '92%', label: 'Athlete retention after month one' },
];

const journeySteps = [
  {
    title: 'Create your profile',
    description: 'Share your goals, sport, location, timeline, and budget so we can surface the right experts instantly.',
  },
  {
    title: 'Match & message',
    description: 'Browse curated coach matches, chat in-app, and review availability synced with their real calendars.',
  },
  {
    title: 'Book & train',
    description: 'Lock in a session, meet at the confirmed venue, and track progress with feedback logged after every workout.',
  },
];

const athleteBenefits = [
  {
    title: 'Skill-specific progressions',
    description: 'Structured drills and homework tailored to your position, age group, and competition calendar.',
  },
  {
    title: 'Flexible pricing & venues',
    description: 'Compare hourly rates, split sessions with teammates, or host clinics at community facilities.',
  },
  {
    title: 'Accountability built in',
    description: 'Session reminders, progress notes, and post-training reflections keep your development on track.',
  },
];

const coachBenefits = [
  {
    title: 'Instant online presence',
    description: 'Launch a polished profile with intro video, certifications, testimonials, and packages in minutes.',
  },
  {
    title: 'Automated bookings & payouts',
    description: 'Sync your calendar, approve requests, and get paid automatically after each completed session.',
  },
  {
    title: 'Grow beyond your zip code',
    description: 'Reach motivated athletes across your metro area with built-in marketing and referral incentives.',
  },
];

const platformHighlights = [
  {
    title: 'Unified operations',
    description: 'Messaging, scheduling, payments, and reviews live together so you never juggle another spreadsheet.',
  },
  {
    title: 'Real-time trust signals',
    description: 'Live availability, response times, safety verifications, and ratings help athletes book with confidence.',
  },
  {
    title: 'Insights that matter',
    description: 'Track session volume, revenue, and athlete progress to refine coaching packages and pricing.',
  },
];

const sportsShowcase = [
  'Basketball',
  'Soccer',
  'Tennis',
  'Volleyball',
  'Track & Field',
  'Swimming',
  'Baseball',
  'Golf',
  'Wrestling',
  'Cheer & Dance',
  'Lacrosse',
  'Softball',
];

const floatingCardMotion: Pick<
  ComponentProps<typeof motion.div>,
  'initial' | 'animate' | 'transition'
> = {
  initial: { y: 0 },
  animate: { y: [-6, 6, -6] },
  transition: {
    duration: 10,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const fadeUp = (delay = 0, distance = 40) => ({
  hidden: { opacity: 0, y: distance },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
}) as Variants;

function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const variants = useMemo(() => fadeUp(delay), [delay]);

  return { ref, inView, variants };
}

type RevealProps = ComponentProps<typeof motion.div> & { delay?: number };

function Reveal({ children, delay = 0, className, ...rest }: RevealProps) {
  const { ref, inView, variants } = useReveal(delay);

  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      <HeroSection />
      <SportsTicker />
      <JourneySection />
      <AudienceSplit />
      <HighlightsGrid />
      <FinalCTA />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <DecorationLayer />
      <div className="mx-auto grid max-w-6xl gap-16 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:px-8">
        <div className="relative z-10 space-y-10">
          <Reveal delay={0.05} className="inline-flex items-center gap-2 rounded-full border border-[#FF6B4A]/40 bg-[#FF6B4A]/10 px-4 py-2 text-sm font-medium text-[#FF6B4A]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B4A]" />
            Train anywhere. Level up everywhere.
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              The coaching marketplace built for public courts, fields, and competitive dreams.
            </h1>
          </Reveal>

          <Reveal delay={0.18}>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              Hubletics connects athletes with vetted freelance coaches, handles the logistics, and keeps every session affordable by meeting at the facilities you already love.
            </p>
          </Reveal>

          <Reveal delay={0.26} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={authPaths.signUp()}
              className="group inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-8 py-3 text-base font-semibold text-white shadow-[0_18px_40px_-20px_rgba(255,107,74,0.7)] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C5A]"
            >
              I need a coach
            </Link>
            <Link
              href={authPaths.signUp()}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-3 text-base font-semibold text-slate-900 transition hover:border-[#FF6B4A] hover:text-[#FF6B4A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B4A]/40"
            >
              I coach athletes
            </Link>
          </Reveal>

          <Reveal delay={0.34} className="grid gap-6 rounded-3xl border border-slate-100/60 bg-white/70 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
            {heroBullets.map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#FF6B4A]/10 text-[#FF6B4A]">
                  <CheckIcon />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </Reveal>

          <Reveal delay={0.42}>
            <div className="flex flex-col gap-4 border-t border-slate-200/60 pt-6 sm:flex-row">
              {heroMetrics.map((metric) => (
                <div key={metric.label} className="flex flex-1 flex-col">
                  <span className="bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
                    {metric.value}
                  </span>
                  <span className="text-sm font-medium uppercase tracking-[0.35em] text-slate-500">
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <motion.div
          className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center gap-6"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="pointer-events-none absolute inset-0 -top-16 rounded-[44px] bg-gradient-to-br from-[#FF6B4A]/15 via-[#FF8C5A]/10 to-[#FFB84D]/15 blur-[120px]" />

          <motion.div
            className="relative w-full overflow-hidden rounded-[38px] border border-white/60 bg-white/85 shadow-[0_40px_80px_-55px_rgba(15,23,42,0.7)] backdrop-blur"
            {...floatingCardMotion}
          >
            <div className="space-y-6 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Upcoming session</p>
                  <p className="text-lg font-semibold text-slate-900">Saturday Skills Lab</p>
                </div>
                <span className="rounded-full bg-[#FF6B4A]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-[#FF6B4A]">
                  Confirmed
                </span>
              </div>

              <div className="grid gap-4 rounded-3xl bg-slate-50/70 p-4">
                <InfoRow label="Coach" value="Jordan Avery" />
                <InfoRow label="Sport" value="Basketball · Guard Play" />
                <InfoRow label="Location" value="Prospect Park Courts" />
                <InfoRow label="Session focus" value="Footwork · Reads · Conditioning" />
              </div>

              <div className="grid gap-4 rounded-3xl border border-slate-100 bg-white/90 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Athlete snapshot</p>
                    <p className="text-xs text-slate-500">4 weeks into pre-season prep</p>
                  </div>
                  <span className="rounded-full bg-gradient-to-r from-[#FF6B4A] to-[#FFB84D] px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-white">
                    +18% progress
                  </span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <MetricTile label="Last eval" value="4.7 ★" />
                  <MetricTile label="Focus" value="Handle" />
                  <MetricTile label="Next check-in" value="Mar 12" />
                </dl>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="relative w-full rounded-[30px] border border-white/60 bg-white/80 p-6 text-left shadow-[0_30px_70px_-55px_rgba(15,23,42,0.65)] backdrop-blur sm:max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Response time
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <p className="text-3xl font-semibold text-slate-900">8m avg</p>
              <span className="rounded-full bg-[#FF6B4A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-[#FF6B4A]">
                Faster than 92% of other platforms
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Coaches on Hubletics reply quickly so athletes can lock in sessions without the back-and-forth.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-slate-600">
      <span>{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function DecorationLayer() {
  return (
    <div aria-hidden="true" className="pointer-events-none">
      <div className="absolute inset-x-0 top-[-180px] h-[420px] bg-[radial-gradient(circle_at_top,rgba(255,107,74,0.18),transparent_60%)]" />
      <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_right,rgba(255,184,77,0.18),transparent_65%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[length:160px_160px]" />
    </div>
  );
}

function SportsTicker() {
  return (
    <section className="relative border-y border-slate-100 bg-slate-50/60 py-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 px-4 text-sm font-medium uppercase tracking-[0.35em] text-slate-500 sm:gap-6">
        {sportsShowcase.map((sport) => (
          <span key={sport} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#FF6B4A] to-[#FFB84D]" />
            {sport}
          </span>
        ))}
      </div>
    </section>
  );
}

function JourneySection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <p className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
            How it works
          </p>
          <h2 className="mt-6 text-3xl font-semibold leading-[1.15] text-slate-900 sm:text-4xl">
            Three steps from idea to locked-in training sessions.
          </h2>
        </Reveal>

        <div className="relative mt-16 grid gap-12 sm:gap-16">
          <span className="pointer-events-none absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-[#FF6B4A] via-[#FF8C5A] to-transparent sm:block" />
          {journeySteps.map((step, index) => (
            <Reveal key={step.title} delay={0.1 * (index + 1)} className="relative rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_24px_60px_-50px_rgba(15,23,42,0.45)] sm:pl-20">
              <div className="absolute -left-3 top-6 hidden h-6 w-6 rounded-full border-4 border-white bg-gradient-to-br from-[#FF6B4A] to-[#FFB84D] shadow-[0_10px_30px_-20px_rgba(255,107,74,0.8)] sm:block" />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <span className="inline-flex items-center rounded-full bg-[#FF6B4A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
                    Step {index + 1}
                  </span>
                  <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
                  <p className="text-base leading-relaxed text-slate-600">{step.description}</p>
                </div>
                <div className="rounded-2xl bg-slate-50/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Avg time: {index === 0 ? '3 mins' : index === 1 ? 'under 24 hrs' : 'book instantly'}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function AudienceSplit() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50 py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,107,74,0.07),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,184,77,0.08),transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2">
          <Reveal className="space-y-6 rounded-[40px] border border-white/80 bg-white/80 p-10 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.55)] backdrop-blur">
            <p className="inline-flex items-center rounded-full border border-[#FF6B4A]/40 bg-[#FF6B4A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
              For athletes & parents
            </p>
            <h3 className="text-3xl font-semibold text-slate-900">Turn aspirations into routines that stick.</h3>
            <p className="text-base leading-relaxed text-slate-600">
              Whether you are gearing up for tryouts or rebuilding confidence after injury, Hubletics pairs you with coaches who translate goals into measurable performance gains.
            </p>
            <ul className="space-y-4">
              {athleteBenefits.map((benefit) => (
                <li key={benefit.title} className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6B4A]/10 text-[#FF6B4A]">
                    <CheckIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{benefit.title}</p>
                    <p className="text-sm text-slate-600">{benefit.description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href={authPaths.signUp()}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-[#FF6B4A] hover:text-[#FF6B4A]"
            >
              Create athlete profile
            </Link>
          </Reveal>

          <Reveal delay={0.2} className="space-y-6 rounded-[40px] border border-white/80 bg-white/80 p-10 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.55)] backdrop-blur">
            <p className="inline-flex items-center rounded-full border border-[#FF8C5A]/40 bg-[#FF8C5A]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
              For coaches & trainers
            </p>
            <h3 className="text-3xl font-semibold text-slate-900">Unlock more time on the field and less time on admin work.</h3>
            <p className="text-base leading-relaxed text-slate-600">
              Keep your pipeline full, automate payments, and let Hubletics handle reminders, waivers, and reporting while you focus on coaching impact.
            </p>
            <ul className="space-y-4">
              {coachBenefits.map((benefit) => (
                <li key={benefit.title} className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#FF8C5A]/10 text-[#FF6B4A]">
                    <CheckIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{benefit.title}</p>
                    <p className="text-sm text-slate-600">{benefit.description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href={authPaths.signUp()}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-[#FF6B4A] hover:text-[#FF6B4A]"
            >
              Apply to coach on Hubletics
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HighlightsGrid() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <p className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
            Why Hubletics works
          </p>
          <h2 className="mt-6 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Built for live operations, financial clarity, and athletic growth.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {platformHighlights.map((highlight, idx) => (
            <Reveal
              key={highlight.title}
              delay={0.12 * (idx + 1)}
              className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-[0_30px_70px_-60px_rgba(15,23,42,0.55)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_40px_90px_-65px_rgba(255,107,74,0.35)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#FF6B4A]/5 opacity-0 transition group-hover:opacity-100" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6B4A]/15 to-[#FFB84D]/20 text-[#FF6B4A]">
                <span className="text-lg font-semibold">0{idx + 1}</span>
              </div>
              <h3 className="relative text-xl font-semibold text-slate-900">{highlight.title}</h3>
              <p className="relative text-sm leading-relaxed text-slate-600">{highlight.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative isolate overflow-hidden px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FF6B4A]/18 via-[#FF8C5A]/8 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,184,77,0.22),transparent_65%)]" />
      <div className="relative mx-auto w-full max-w-5xl rounded-[48px] border border-white/70 bg-white/85 px-6 py-20 text-center shadow-[0_40px_100px_-60px_rgba(15,23,42,0.55)] backdrop-blur sm:px-12">
        <Reveal>
          <p className="inline-flex items-center justify-center rounded-full border border-white/70 bg-white/80 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-[#FF6B4A]">
            Start today
          </p>
          <h2 className="mt-6 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Ready to run your next season smarter?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Join thousands of athletes and coaches who rely on Hubletics to coordinate training, stay accountable, and celebrate every breakthrough.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={authPaths.signUp()}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-8 py-3 text-base font-semibold text-white transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C5A]"
          >
            Claim your free profile
          </Link>
          <Link
            href="mailto:hello@hubletics.com"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-3 text-base font-semibold text-slate-900 transition hover:border-[#FF6B4A] hover:text-[#FF6B4A]"
          >
            Talk with our team
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
