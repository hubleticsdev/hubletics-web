'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { coachProfile, user as userTable } from '@/lib/db/schema';

export type CoachProfileData = {
  fullName: string;
  profilePhotoUrl?: string | null;
  introVideoUrl: string;
  cities: string[];
  state: string;
  specialties: Array<{ sport: string; tags: string[] }>;
  bio: string;
  accomplishments?: string;
  certifications: Array<{
    name: string;
    org: string;
    issueDate: string;
    expDate?: string;
    fileUrl: string;
  }>;
  hourlyRate: number;
  sessionDuration: number;
  weeklyAvailability: Record<string, Array<{ start: string; end: string }>>;
  preferredLocations: Array<{ name: string; address: string; notes?: string }>;
};

export async function createCoachProfile(data: CoachProfileData) {
  // Require coach role - this is cached, preventing duplicate queries!
  const session = await requireRole('coach');
  const user = session.user;

  // Check if profile already exists (prevent double-submit)
  const { eq } = await import('drizzle-orm');
  const existingProfile = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, user.id),
  });

  if (existingProfile) {
    // Profile already exists, treat as success (idempotent)
    return { success: true, alreadyExists: true };
  }

  // Create the coach profile matching the schema structure
  // Use custom uploaded photo, fallback to Google avatar, or null
  const profilePhoto = data.profilePhotoUrl || user.image || null;

  await db.insert(coachProfile).values({
    userId: user.id,
    fullName: data.fullName,
    profilePhoto,
    introVideo: data.introVideoUrl,
    location: {
      cities: data.cities,
      state: data.state,
    },
    specialties: data.specialties,
    bio: data.bio,
    certifications: data.certifications.length > 0 ? data.certifications : undefined,
    accomplishments: data.accomplishments || null,
    hourlyRate: data.hourlyRate.toString(),
    sessionDuration: data.sessionDuration,
    weeklyAvailability: data.weeklyAvailability,
    preferredLocations: data.preferredLocations.length > 0 ? data.preferredLocations : undefined,
    // Defaults from schema:
    // adminApprovalStatus: 'pending' (default)
    // stripeOnboardingComplete: false (default)
    // reputationScore: 0.00 (default)
    // totalReviews: 0 (default)
    // totalLessonsCompleted: 0 (default)
  });

  // Update user table to mark profile as complete
  // This ensures session.user.profileComplete is immediately updated
  await db.update(userTable)
    .set({ profileComplete: true })
    .where(eq(userTable.id, user.id));

  return { success: true };
}

