import Link from 'next/link';

import { searchCoaches, getAvailableSpecialties } from '@/actions/coaches/search';
import { CoachCard } from '@/components/coaches/coach-card';
import { SearchFilters } from '@/components/coaches/search-filters';

interface SearchParams {
  q?: string;
  sport?: string;
  location?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
}

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  
  const filters = {
    searchQuery: params.q,
    sport: params.sport,
    location: params.location,
    minPrice: params.minPrice ? parseFloat(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? parseFloat(params.maxPrice) : undefined,
    minRating: params.minRating ? parseFloat(params.minRating) : undefined,
  };

  const [{ coaches, total }, specialties] = await Promise.all([
    searchCoaches(filters),
    getAvailableSpecialties(),
  ]);

  const appliedFilters = [
    filters.searchQuery && { label: 'Search', value: filters.searchQuery },
    filters.sport && { label: 'Sport', value: filters.sport },
    filters.location && { label: 'Location', value: filters.location },
    filters.minPrice && { label: 'Min $/hr', value: `$${filters.minPrice}` },
    filters.maxPrice && { label: 'Max $/hr', value: `$${filters.maxPrice}` },
    filters.minRating && {
      label: 'Rating',
      value: `${Number(filters.minRating) / 20 >= 1 ? (Number(filters.minRating) / 20).toFixed(1) : filters.minRating}/5`,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="relative isolate min-h-screen bg-slate-50 text-slate-900 pt-16">
      <header className="border-b border-slate-200 bg-white/95 pt-6 sm:pt-10 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <p className="inline-flex w-fit items-center rounded-full border border-[#FF6B4A]/30 bg-[#FF6B4A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#FF6B4A]">
              Coach marketplace
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Discover coaches ready to train on your terms
              </h1>
              <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
                Browse verified professionals by sport, location, and budget. Book directly once you find the right fit.
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
                  <span className="text-xs uppercase tracking-[0.32em] text-slate-400">{chip.label}</span>
                  {chip.value}
                </span>
              ))}
              <Link
                href="/coaches"
                className="inline-flex items-center rounded-full border border-transparent bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 transition hover:border-slate-200 hover:bg-slate-200"
              >
                Clear all
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="pb-14 pt-8 sm:pt-10">
        <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 sm:px-6 lg:grid-cols-[320px,1fr] lg:px-8">
          <aside>
            <SearchFilters specialties={specialties} className="mb-0 shadow-[0_25px_80px_-60px_rgba(15,23,42,0.55)]" />
          </aside>

          <section className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {total === 0
                    ? 'No coaches found'
                    : `${total} ${total === 1 ? 'coach' : 'coaches'} available`}
                </h2>
                <p className="text-sm text-slate-500">
                  Profiles are updated daily with new availability and pricing.
                </p>
              </div>
            </div>

            {coaches.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {coaches.map((coach) => (
                  <CoachCard key={coach.id} coach={coach} />
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
      <h3 className="text-xl font-semibold text-slate-900">No coaches match those filters</h3>
      <p className="max-w-md text-sm text-slate-500">
        Adjust your search criteria or clear filters to explore more profiles across sports and locations.
      </p>
      <Link
        href="/coaches"
        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-6 py-2 text-sm font-semibold uppercase tracking-[0.32em] text-white shadow-[0_12px_30px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
      >
        View all coaches
      </Link>
    </div>
  );
}
