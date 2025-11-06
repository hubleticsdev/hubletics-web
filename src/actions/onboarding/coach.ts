'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { withTransaction } from '@/lib/db/transactions';
import { coachProfile, user as userTable } from '@/lib/db/schema';
import { isValidUploadThingUrl } from '@/lib/utils';
import { z } from 'zod';
import { coachProfileSchema, validateInput } from '@/lib/validations';

export type CoachProfileData = z.infer<typeof coachProfileSchema>;

export async function createCoachProfile(data: CoachProfileData) {
  // Require coach role
  const session = await requireRole('coach');
  const user = session.user;

  // Validate input
  const validatedData = validateInput(coachProfileSchema, data);

  // Check if profile already exists (prevent double-submit)
  const { eq } = await import('drizzle-orm');
  const existingProfile = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, user.id),
  });

  if (existingProfile) {
    return { success: true, alreadyExists: true };
  }

  const profilePhoto = validatedData.profilePhotoUrl || user.image || null;

  // Create coach profile and update user status atomically
  await withTransaction(async (tx) => {
    await tx.insert(coachProfile).values({
      userId: user.id,
      fullName: validatedData.fullName,
      profilePhoto,
      introVideo: validatedData.introVideoUrl,
      location: {
        cities: validatedData.cities,
        state: validatedData.state,
      },
      specialties: validatedData.specialties,
      bio: validatedData.bio,
      certifications: validatedData.certifications.length > 0 ? validatedData.certifications : undefined,
      accomplishments: validatedData.accomplishments || null,
      hourlyRate: validatedData.hourlyRate.toString(),
      sessionDuration: validatedData.sessionDuration,
      weeklyAvailability: validatedData.weeklyAvailability,
      preferredLocations: validatedData.preferredLocations.length > 0 ? validatedData.preferredLocations : undefined,
      // Defaults from schema:
      // adminApprovalStatus: 'pending' (default)
      // stripeOnboardingComplete: false (default)
      // reputationScore: 0.00 (default)
      // totalReviews: 0 (default)
      // totalLessonsCompleted: 0 (default)
    });

    // Update user table to mark profile as complete and clear temp onboarding files
    await tx.update(userTable)
      .set({
        profileComplete: true,
        onboardingPhotoUrl: null,
        onboardingVideoUrl: null,
      })
      .where(eq(userTable.id, user.id));
  });

  // Invalidate session cache to force fresh read on next request
  const { invalidateSessionCache } = await import('@/lib/auth/cache');
  await invalidateSessionCache();

  return { success: true };
}

