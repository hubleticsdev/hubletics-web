import Link from 'next/link';
import Image from 'next/image';
import { AthleteSearchResult } from '@/actions/athletes/search';

export function AthleteCard({ athlete }: { athlete: AthleteSearchResult }) {
  const displayImage = athlete.profilePhoto || '/placeholder-avatar.png';
  const locationDisplay = `${athlete.location.city}, ${athlete.location.state}`;

  const budgetDisplay = (() => {
    const budget = athlete.budgetRange;
    if ('single' in budget) {
      return `$${budget.single}`;
    }
    return `$${budget.min}-${budget.max}`;
  })();

  const usernameDisplay = athlete.user.username ? `@${athlete.user.username}` : '';

  return (
    <Link
      href={`/athletes/${athlete.userId}`}
      className="group bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-xl hover:border-[#FF6B4A] transition-all duration-200 overflow-hidden"
    >
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        <Image
          src={displayImage}
          alt={athlete.fullName}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-200"
        />
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full shadow-md">
          <span className="text-sm text-gray-600">Budget</span>
          <span className="ml-1 text-lg font-bold text-[#FF6B4A]">{budgetDisplay}</span>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-2">
          <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#FF6B4A] transition-colors inline">
            {athlete.fullName}
          </h3>
          {usernameDisplay && (
            <span className="text-sm text-gray-500 ml-2">
              {usernameDisplay}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-gray-600 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-sm">{locationDisplay}</span>
        </div>

        {athlete.bio && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{athlete.bio}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {athlete.sportsInterested.slice(0, 3).map((sport, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-orange-50 text-[#FF6B4A] text-xs font-medium rounded-full"
            >
              {sport}
            </span>
          ))}
          {athlete.sportsInterested.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
              +{athlete.sportsInterested.length - 3} more
            </span>
          )}
        </div>

        {Object.keys(athlete.experienceLevel).length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Experience
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(athlete.experienceLevel)
                .slice(0, 2)
                .map(([sport, exp]) => (
                  <div key={sport} className="text-xs text-gray-600">
                    <span className="font-medium">{sport}:</span>{' '}
                    <span className="capitalize">{exp.level}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
