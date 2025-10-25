import { searchCoaches, getAvailableSpecialties } from '@/actions/coaches/search';
import { CoachCard } from '@/components/coaches/coach-card';
import { SearchFilters } from '@/components/coaches/search-filters';
import Link from 'next/link';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50/30 py-16">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Find Your Perfect Coach
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Connect with world-class coaches and take your performance to the next level
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filters */}
        <SearchFilters specialties={specialties} />

        {/* Results Count */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {total === 0 ? 'No coaches found' : `${total} ${total === 1 ? 'Coach' : 'Coaches'} Available`}
          </h2>
          {Object.values(filters).some((v) => v !== undefined) && (
            <p className="text-gray-600 mt-1">
              Showing filtered results
            </p>
          )}
        </div>

        {/* Coach Grid */}
        {coaches.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Coaches Found
            </h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your filters or search criteria
            </p>
            <Link
              href="/coaches"
              className="inline-block px-6 py-3 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200"
            >
              View All Coaches
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

