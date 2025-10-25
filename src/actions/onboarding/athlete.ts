'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { athleteProfile } from '@/lib/db/schema';

export type AthleteProfileData = {
  fullName: string;
  city: string;
  state: string;
  profilePhotoUrl?: string | null;
  sports: string[];
  experienceLevels: Record<string, string>;
  notes: string;
  budgetMin: number;
  budgetMax: number;
  preferredTimes: string[];
  bio: string;
};

export async function createAthleteProfile(data: AthleteProfileData) {
  // Require client role - this is cached, preventing duplicate queries!
  const session = await requireRole('client');
  const user = session.user;

  // Check if profile already exists (prevent double-submit)
  const { eq } = await import('drizzle-orm');
  const existingProfile = await db.query.athleteProfile.findFirst({
    where: eq(athleteProfile.userId, user.id),
  });

  if (existingProfile) {
    // Profile already exists, treat as success (idempotent)
    return { success: true, alreadyExists: true };
  }

  // Create the athlete profile matching the schema structure
  // Use custom uploaded photo, fallback to Google avatar, or null
  const profilePhoto = data.profilePhotoUrl || user.image || null;
  
  await db.insert(athleteProfile).values({
    userId: user.id,
    fullName: data.fullName,
    profilePhoto,
    location: {
      city: data.city,
      state: data.state,
    },
    sportsInterested: data.sports,
    experienceLevel: Object.fromEntries(
      Object.entries(data.experienceLevels).map(([sport, level]) => [
        sport,
        { level, notes: data.notes || undefined },
      ])
    ),
    budgetRange: {
      min: data.budgetMin,
      max: data.budgetMax,
    },
    availability: {}, // Empty for now, can be updated later
    bio: data.bio || null,
  });

  // Update user table to mark profile as complete
  // This ensures session.user.profileComplete is immediately updated
  const { user: userTable } = await import('@/lib/db/schema');
  await db.update(userTable)
    .set({ profileComplete: true })
    .where(eq(userTable.id, user.id));

  return { success: true };
}
