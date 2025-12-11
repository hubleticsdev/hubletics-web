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
  const session = await requireRole('coach');
  const user = session.user;

  const validatedData = validateInput(coachProfileSchema, data);

  const { eq } = await import('drizzle-orm');
  const existingProfile = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, user.id),
  });

  if (existingProfile) {
    return { success: true, alreadyExists: true };
  }

  const profilePhoto = validatedData.profilePhotoUrl || user.image || null;

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
    });

    await tx.update(userTable)
      .set({
        username: validatedData.username,
        profileComplete: true,
        onboardingPhotoUrl: null,
        onboardingVideoUrl: null,
      })
      .where(eq(userTable.id, user.id));
  });

  const { invalidateSessionCache } = await import('@/lib/auth/cache');
  await invalidateSessionCache();

  return { success: true };
}

