'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { withTransaction } from '@/lib/db/transactions';
import { athleteProfile } from '@/lib/db/schema';
import { isValidUploadThingUrl } from '@/lib/utils';
import { z } from 'zod';
import { athleteProfileSchema, validateInput } from '@/lib/validations';

export type AthleteProfileData = z.infer<typeof athleteProfileSchema>;

export async function createAthleteProfile(data: AthleteProfileData) {
  const session = await requireRole('client');
  const user = session.user;

  const validatedData = validateInput(athleteProfileSchema, data);

  const { eq } = await import('drizzle-orm');
  const existingProfile = await db.query.athleteProfile.findFirst({
    where: eq(athleteProfile.userId, user.id),
  });

  if (existingProfile) {
    return { success: true, alreadyExists: true };
  }

  const profilePhoto = validatedData.profilePhotoUrl || user.image || null;

  await withTransaction(async (tx) => {
    await tx.insert(athleteProfile).values({
      userId: user.id,
      fullName: validatedData.fullName,
      profilePhoto,
      location: {
        city: validatedData.city,
        state: validatedData.state,
      },
      sportsInterested: validatedData.sports,
      experienceLevel: Object.fromEntries(
        Object.entries(validatedData.experienceLevels).map(([sport, level]) => [
          sport,
          { level: level.toLowerCase(), notes: validatedData.notes || undefined },
        ])
      ),
      budgetRange: {
        min: validatedData.budgetMin,
        max: validatedData.budgetMax,
      },
      availability: {},
      bio: validatedData.bio || null,
    });

    const { user: userTable } = await import('@/lib/db/schema');
    await tx.update(userTable)
      .set({
        username: validatedData.username,
        profileComplete: true,
        onboardingPhotoUrl: null,
      })
      .where(eq(userTable.id, user.id));
  });

  const { invalidateSessionCache } = await import('@/lib/auth/cache');
  await invalidateSessionCache();

  return { success: true };
}