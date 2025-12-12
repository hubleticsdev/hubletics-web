import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { CoachReviewActions } from '@/components/admin/coach-review-actions';

export default async function CoachReviewPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  
  const coach = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, userId),
    with: {
      user: true,
    },
  });

  if (!coach) {
    notFound();
  }

  if (coach.adminApprovalStatus !== 'pending') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">
            Already Processed
          </h2>
          <p className="text-yellow-800">
            This coach has already been {coach.adminApprovalStatus}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Review Coach Application
        </h1>
        <p className="text-gray-600">
          Submitted {new Date(coach.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            {coach.profilePhoto ? (
              <Image
                src={coach.profilePhoto}
                alt={coach.fullName}
                width={80}
                height={80}
                className="w-20 h-20 rounded-full"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-orange-600 font-bold text-2xl">
                  {coach.fullName.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {coach.fullName}
              </h2>
              <p className="text-gray-600">{coach.user.email}</p>
              <p className="text-sm text-gray-500">
                {coach.location.cities.join(', ')}, {coach.location.state}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Introduction Video
          </h3>
          <video
            src={coach.introVideo}
            controls
            className="w-full max-w-2xl rounded-lg"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Specialties
          </h3>
          <div className="space-y-2">
            {coach.specialties.map((specialty, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="font-semibold text-gray-900">
                  {specialty.sport}:
                </span>
                <span className="text-gray-600">
                  {specialty.tags.join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bio</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{coach.bio}</p>
        </div>

        {coach.certifications && coach.certifications.length > 0 && (
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Certifications
            </h3>
            <div className="space-y-3">
              {coach.certifications.map((cert, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-gray-900">{cert.name}</h4>
                      <p className="text-sm text-gray-600">{cert.org}</p>
                      <p className="text-xs text-gray-500">
                        Issued: {cert.issueDate}
                        {cert.expDate && ` · Expires: ${cert.expDate}`}
                      </p>
                    </div>
                    {cert.fileUrl && (
                      <a
                        href={cert.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-orange-600 hover:text-orange-700"
                      >
                        View Certificate
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {coach.accomplishments && (
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Accomplishments
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">
              {coach.accomplishments}
            </p>
          </div>
        )}

        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Pricing & Sessions
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Hourly Rate</span>
              <p className="text-lg font-semibold text-gray-900">
                ${coach.hourlyRate} / hour
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Session Duration</span>
              <p className="text-lg font-semibold text-gray-900">
                {coach.sessionDuration} minutes
              </p>
            </div>
          </div>
        </div>

        {coach.preferredLocations && coach.preferredLocations.length > 0 && (
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Preferred Locations
            </h3>
            <div className="space-y-3">
              {coach.preferredLocations.map((location, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900">{location.name}</h4>
                  <p className="text-sm text-gray-600">{location.address}</p>
                  {location.notes && (
                    <p className="text-xs text-gray-500 mt-1">{location.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Weekly Availability
          </h3>
          <div className="space-y-2">
            {Object.entries(coach.weeklyAvailability).map(([day, slots]) => (
              <div key={day} className="flex items-start space-x-4">
                <span className="w-24 font-semibold text-gray-900">{day}:</span>
                <div className="flex-1">
                  {slots.length === 0 ? (
                    <span className="text-gray-500">Not available</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm"
                        >
                          {slot.start} - {slot.end}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CoachReviewActions userId={userId} />
    </div>
  );
}

