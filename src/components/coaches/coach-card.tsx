import Link from 'next/link';
import Image from 'next/image';
import { CoachSearchResult } from '@/actions/coaches/search';

export function CoachCard({ coach }: { coach: CoachSearchResult }) {
  const displayImage = coach.profilePhoto || coach.user.image || '/placeholder-avatar.png';
  const rating = parseFloat(coach.reputationScore) / 20; // Convert 0-100 to 0-5 stars
  const hourlyRate = parseFloat(coach.hourlyRate);
  const locationDisplay = `${coach.location.cities.join(', ')}, ${coach.location.state}`;

  return (
    <Link
      href={`/coaches/${coach.userId}`}
      className="group bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-xl hover:border-[#FF6B4A] transition-all duration-200 overflow-hidden"
    >
      {/* Coach Image */}
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        <Image
          src={displayImage}
          alt={coach.fullName}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-200"
        />
        {/* Price Badge */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full shadow-md">
          <span className="text-lg font-bold text-[#FF6B4A]">
            ${hourlyRate}
          </span>
          <span className="text-sm text-gray-600">/hr</span>
        </div>
      </div>

      {/* Coach Info */}
      <div className="p-5">
        {/* Name */}
        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-[#FF6B4A] transition-colors">
          {coach.fullName}
        </h3>

        {/* Location */}
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

        {/* Bio Preview */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {coach.bio}
        </p>

        {/* Specialties */}
        <div className="flex flex-wrap gap-2 mb-4">
          {coach.specialties.slice(0, 3).map((specialty, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-orange-50 text-[#FF6B4A] text-xs font-medium rounded-full"
            >
              {specialty.sport}
            </span>
          ))}
          {coach.specialties.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
              +{coach.specialties.length - 3} more
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          {/* Rating */}
          <div className="flex items-center gap-1">
            <svg className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="font-semibold text-gray-900">
              {rating.toFixed(1)}
            </span>
            <span className="text-xs text-gray-500">
              ({coach.totalReviews})
            </span>
          </div>

          {/* Lessons Completed */}
          <div className="flex items-center gap-1 text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm font-medium">
              {coach.totalLessonsCompleted} sessions
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

