'use server';

import { db } from '@/lib/db';
import { user, athleteProfile, coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { updateUserAccountSchema, updateAthleteProfileSchema, updateCoachProfileSchema, validateInput } from '@/lib/validations';

/**
 * Update user account settings
 */
export async function updateUserAccount({ name }: { name: string }) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validatedData = validateInput(updateUserAccountSchema, { name });

    await db.update(user).set({ name: validatedData.name }).where(eq(user.id, session.user.id));

    revalidatePath('/dashboard/profile');
    return { success: true };
  } catch (error) {
    console.error('Update user account error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update account' };
  }
}

/**
 * Update athlete profile
 */
export async function updateAthleteProfile(data: {
  fullName: string;
  profilePhoto?: string;
  location: { city: string; state: string };
  sportsInterested: string[];
  experienceLevel: Record<string, { level: string; notes?: string }>;
  budgetRange: { min: number; max: number } | { single: number };
  availability: Record<string, Array<{ start: string; end: string }>>;
  bio?: string;
}) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validatedData = validateInput(updateAthleteProfileSchema, data);

    await db
      .update(athleteProfile)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(athleteProfile.userId, session.user.id));

    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/athlete');
    return { success: true };
  } catch (error) {
    console.error('Update athlete profile error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update profile' };
  }
}

/**
 * Update coach profile
 */
export async function updateCoachProfile(data: {
  fullName: string;
  profilePhoto?: string;
  introVideo: string;
  location: { cities: string[]; state: string };
  specialties: Array<{ sport: string; tags: string[] }>;
  bio: string;
  certifications?: Array<{
    name: string;
    org: string;
    issueDate: string;
    expDate?: string;
    fileUrl: string;
  }>;
  accomplishments?: string;
  hourlyRate: string;
  preferredLocations?: Array<{ name: string; address: string; notes?: string }>;
}) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validatedData = validateInput(updateCoachProfileSchema, data);

    await db
      .update(coachProfile)
      .set({
        ...validatedData,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(coachProfile.userId, session.user.id));

    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/coach');
    revalidatePath(`/coaches/${session.user.id}`);
    return { success: true };
  } catch (error) {
    console.error('Update coach profile error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update profile' };
  }
}
