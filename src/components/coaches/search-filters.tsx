'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

interface SearchFiltersProps {
  specialties: string[];
  className?: string;
}

export function SearchFilters({ specialties, className }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sport, setSport] = useState(searchParams.get('sport') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');

  const handleSearch = () => {
    const params = new URLSearchParams();

    if (searchQuery) params.set('q', searchQuery);
    if (sport) params.set('sport', sport);
    if (location) params.set('location', location);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (minRating) params.set('minRating', minRating);

    router.push(`/coaches?${params.toString()}`);
  };

  const handleReset = () => {
    setSearchQuery('');
    setSport('');
    setLocation('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    router.push('/coaches');
  };

  return (
    <div
      className={cn(
        'rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <h2 className="text-xl font-bold text-gray-900 mb-4">Filter Coaches</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search by Name
          </label>
          <input
            type="text"
            id="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter coach name..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <div>
          <label htmlFor="sport" className="block text-sm font-medium text-gray-700 mb-1">
            Sport / Specialty
          </label>
          <select
            id="sport"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
          >
            <option value="">All Sports</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State, or Country"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <div>
          <label htmlFor="minPrice" className="block text-sm font-medium text-gray-700 mb-1">
            Min Price ($/hr)
          </label>
          <input
            type="number"
            id="minPrice"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="0"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="maxPrice" className="block text-sm font-medium text-gray-700 mb-1">
            Max Price ($/hr)
          </label>
          <input
            type="number"
            id="maxPrice"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="500"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="minRating" className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Rating
          </label>
          <select
            id="minRating"
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B4A] focus:border-transparent"
          >
            <option value="">Any Rating</option>
            <option value="80">4.0+ Stars</option>
            <option value="85">4.25+ Stars</option>
            <option value="90">4.5+ Stars</option>
            <option value="95">4.75+ Stars</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleSearch}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] px-6 py-2 text-sm font-semibold uppercase tracking-[0.32em] text-white shadow-[0_12px_30px_-18px_rgba(255,107,74,0.8)] transition hover:scale-[1.02]"
        >
          Apply Filters
        </button>
        <button
          onClick={handleReset}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#FF6B4A]/40 hover:text-[#FF6B4A]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
