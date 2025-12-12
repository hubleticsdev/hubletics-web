import Link from 'next/link';
import { searchAthletes, getAvailableSports } from '@/actions/athletes/search';
import { AthleteCard } from '@/components/athletes/athlete-card';
import { requireRole } from '@/lib/auth/session';

interface SearchParams {
  q?: string;
  sport?: string;
  location?: string;
  minBudget?: string;
  maxBudget?: string;
}

export default async function CoachAthletesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole('coach');

  const params = await searchParams;

  const filters = {
    searchQuery: params.q,
    sport: params.sport,
    location: params.location,
    minBudget: params.minBudget ? parseFloat(params.minBudget) : undefined,
    maxBudget: params.maxBudget ? parseFloat(params.maxBudget) : undefined,
  };

  const [{ athletes, total }, availableSports] = await Promise.all([
    searchAthletes(filters),
    getAvailableSports(),
  ]);

  const appliedFilters = [
    filters.searchQuery && { label: 'Search', value: filters.searchQuery },
    filters.sport && { label: 'Sport', value: filters.sport },
    filters.location && { label: 'Location', value: filters.location },
    filters.minBudget && { label: 'Min Budget', value: `$${filters.minBudget}` },
    filters.maxBudget && { label: 'Max Budget', value: `$${filters.maxBudget}` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="relative isolate min-h-screen bg-slate-50 text-slate-900 pt-16">
      <header className="border-b border-slate-200 bg-white/95 pt-6 sm:pt-10 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <p className="inline-flex w-fit items-center rounded-full border border-[#FF6B4A]/30 bg-[#FF6B4A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
              Athlete directory
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Discover athletes looking for training
              </h1>
              <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
                Browse athlete profiles by sport, location, and budget. Message them to build your client base.
              </p>
            </div>
          </div>

          {appliedFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                Active filters
              </span>
              {appliedFilters.map((chip) => (
                <span
                  key={`${chip.label}-${chip.value}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700"
                >
                  <span className="text-xs uppercase tracking-[0.32em] text-slate-400">
                    {chip.label}
                  </span>
                  {chip.value}
                </span>
              ))}
              <Link
                href="/dashboard/coach/athletes"
                className="cursor-pointer inline-flex items-center rounded-full border border-transparent bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 transition hover:border-slate-200 hover:bg-slate-200"
              >
                Clear all
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="pb-14 pt-8 sm:pt-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-2xl border border-white/70 bg-white/90 p-6 shadow-[0_25px_80px_-60px_rgba(15,23,42,0.55)]">
            <form className="space-y-4">
              <div>
                <label htmlFor="search" className="block text-sm font-semibold text-slate-700 mb-2">
                  Search by name
                </label>
                <input
                  type="text"
                  id="search"
                  name="q"
                  defaultValue={filters.searchQuery}
                  placeholder="Enter athlete name..."
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-[#FF6B4A] focus:outline-none focus:ring-1 focus:ring-[#FF6B4A]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="sport" className="block text-sm font-semibold text-slate-700 mb-2">
                    Sport
                  </label>
                  <select
                    id="sport"
                    name="sport"
                    defaultValue={filters.sport || ''}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-[#FF6B4A] focus:outline-none focus:ring-1 focus:ring-[#FF6B4A]"
                  >
                    <option value="">All sports</option>
                    {availableSports.map((sport) => (
                      <option key={sport} value={sport}>
                        {sport}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-semibold text-slate-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    defaultValue={filters.location}
                    placeholder="City or State"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-[#FF6B4A] focus:outline-none focus:ring-1 focus:ring-[#FF6B4A]"
                  />
                </div>

                <div>
                  <label htmlFor="minBudget" className="block text-sm font-semibold text-slate-700 mb-2">
                    Min Budget
                  </label>
                  <input
                    type="number"
                    id="minBudget"
                    name="minBudget"
                    defaultValue={filters.minBudget}
                    placeholder="$0"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-[#FF6B4A] focus:outline-none focus:ring-1 focus:ring-[#FF6B4A]"
                  />
                </div>

                <div>
                  <label htmlFor="maxBudget" className="block text-sm font-semibold text-slate-700 mb-2">
                    Max Budget
                  </label>
                  <input
                    type="number"
                    id="maxBudget"
                    name="maxBudget"
                    defaultValue={filters.maxBudget}
                    placeholder="Any"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-[#FF6B4A] focus:outline-none focus:ring-1 focus:ring-[#FF6B4A]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="cursor-pointer inline-flex items-center justify-center rounded-full bg-linear-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-6 py-2 text-sm font-semibold uppercase tracking-[0.32em] text-white shadow-[0_12px_30px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
                >
                  Apply Filters
                </button>
              </div>
            </form>
          </div>

          <section className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {total === 0
                    ? 'No athletes found'
                    : `${total} ${total === 1 ? 'athlete' : 'athletes'} available`}
                </h2>
                <p className="text-sm text-slate-500">
                  Message athletes to introduce yourself and build your client base.
                </p>
              </div>
            </div>

            {athletes.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {athletes.map((athlete) => (
                  <AthleteCard key={athlete.id} athlete={athlete} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/80 px-10 py-16 text-center shadow-[0_28px_90px_-70px_rgba(15,23,42,0.45)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FF6B4A]/10 text-[#FF6B4A]">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-slate-900">No athletes match those filters</h3>
      <p className="max-w-md text-sm text-slate-500">
        Adjust your search criteria or clear filters to explore more athlete profiles.
      </p>
      <Link
        href="/dashboard/coach/athletes"
        className="cursor-pointer inline-flex items-center justify-center rounded-full bg-linear-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-6 py-2 text-sm font-semibold uppercase tracking-[0.32em] text-white shadow-[0_12px_30px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
      >
        View all athletes
      </Link>
    </div>
  );
}

