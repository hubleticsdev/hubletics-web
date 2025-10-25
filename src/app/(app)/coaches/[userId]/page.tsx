import { getCoachPublicProfile } from '@/actions/coaches/search';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getCoachBookings } from '@/actions/coaches/availability';
import { BookingModalTrigger } from '@/components/bookings/booking-modal-trigger';

export default async function CoachProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const coach = await getCoachPublicProfile(userId);
  const session = await getSession();

  if (!coach) {
    notFound();
  }

  const displayImage = coach.profilePhoto || coach.user.image || '/placeholder-avatar.png';
  const rating = parseFloat(coach.reputationScore as unknown as string) / 20; // Convert 0-100 to 0-5 stars
  const hourlyRate = parseFloat(coach.hourlyRate as unknown as string);
  const locationDisplay = `${coach.location.cities.join(', ')}, ${coach.location.state}`;
  
  const canBook = session && session.user.role === 'client';

  // Fetch coach's existing bookings for availability
  const { bookings: existingBookings } = await getCoachBookings(userId);

  // Default availability if not set (9 AM - 5 PM weekdays)
  const availability = coach.weeklyAvailability || {
    monday: [{ start: '09:00', end: '17:00' }],
    tuesday: [{ start: '09:00', end: '17:00' }],
    wednesday: [{ start: '09:00', end: '17:00' }],
    thursday: [{ start: '09:00', end: '17:00' }],
    friday: [{ start: '09:00', end: '17:00' }],
  };

  const blockedDates = coach.blockedDates || [];
  const sessionDuration = coach.sessionDuration || 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50/30 py-16">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/coaches"
            className="inline-flex items-center gap-2 text-white hover:text-white/80 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Coaches
          </Link>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Profile Header */}
          <div className="p-8 lg:p-12">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Profile Photo */}
              <div className="flex-shrink-0">
                <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg">
                  <Image
                    src={displayImage}
                    alt={coach.fullName}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Coach Info */}
              <div className="flex-1">
                {/* Name and Rating */}
                <div className="mb-4">
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    {coach.fullName}
                  </h1>
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Rating */}
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-5 h-5 ${
                              i < Math.floor(rating)
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300 fill-current'
                            }`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="font-semibold text-gray-900">
                        {rating.toFixed(1)}
                      </span>
                      <span className="text-gray-500">
                        ({coach.totalReviews} reviews)
                      </span>
                    </div>

                    {/* Sessions */}
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="font-medium">
                        {coach.totalLessonsCompleted} sessions completed
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 text-gray-700 mb-6">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <span className="text-lg">{locationDisplay}</span>
                </div>

                {/* Specialties */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {coach.specialties.map((specialty, index) => (
                      <div key={index} className="flex flex-col gap-1">
                        <span className="px-3 py-1 bg-orange-50 text-[#FF6B4A] font-medium rounded-full">
                          {specialty.sport}
                        </span>
                        {specialty.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 ml-2">
                            {specialty.tags.map((tag, tagIndex) => (
                              <span
                                key={tagIndex}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price and CTA */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="px-6 py-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border-2 border-[#FF6B4A]">
                    <div className="text-sm text-gray-600 mb-1">Hourly Rate</div>
                    <div className="text-3xl font-bold text-[#FF6B4A]">
                      ${hourlyRate}
                      <span className="text-lg text-gray-600">/hr</span>
                    </div>
                  </div>
                  {canBook ? (
                    <BookingModalTrigger
                      coachId={userId}
                      coachName={coach.fullName}
                      hourlyRate={hourlyRate}
                      sessionDuration={sessionDuration}
                      availability={availability}
                      blockedDates={blockedDates}
                      existingBookings={existingBookings}
                    />
                  ) : (
                    <Link
                      href="/auth/signup"
                      className="px-8 py-3 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200"
                    >
                      Sign Up to Book
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bio Section */}
          <div className="border-t border-gray-200 p-8 lg:p-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {coach.bio}
            </p>
          </div>

          {/* Certifications */}
          {coach.certifications && coach.certifications.length > 0 && (
            <div className="border-t border-gray-200 p-8 lg:p-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Certifications
              </h2>
              <ul className="space-y-3">
                {coach.certifications.map((cert, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-[#FF6B4A] mt-1 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                    <div className="flex-1">
                      <div className="text-gray-900 font-semibold">{cert.name}</div>
                      <div className="text-sm text-gray-600">{cert.org}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Issued: {new Date(cert.issueDate).toLocaleDateString()}
                        {cert.expDate && ` • Expires: ${new Date(cert.expDate).toLocaleDateString()}`}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Accomplishments */}
          {coach.accomplishments && (
            <div className="border-t border-gray-200 p-8 lg:p-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Accomplishments
              </h2>
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {coach.accomplishments}
              </div>
            </div>
          )}

          {/* Intro Video */}
          {coach.introVideo && (
            <div className="border-t border-gray-200 p-8 lg:p-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Introduction Video
              </h2>
              <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden">
                <video
                  src={coach.introVideo}
                  controls
                  className="w-full h-full"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

