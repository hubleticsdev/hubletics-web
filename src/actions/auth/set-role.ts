'use server';

import { getSession } from '@/lib/auth/session';
import { invalidateSessionCache } from '@/lib/auth/cache';
import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@/types/auth';

export async function setUserRole(role: 'client' | 'coach'): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the current session
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const user = session.user;

    if (user.role !== 'pending') {
      return { success: false, error: 'Role has already been set and cannot be changed' };
    }

    if (user.profileComplete) {
      return { success: false, error: 'Role cannot be changed after profile is complete' };
    }

    // Validate role
    if (role !== 'client' && role !== 'coach') {
      return { success: false, error: 'Invalid role' };
    }

    // Update the user's role in the database
    await db
      .update(userTable)
      .set({ role: role as UserRole })
      .where(eq(userTable.id, user.id));

    // Invalidate session cache to force fresh read on next request
    await invalidateSessionCache();

    return { success: true };
  } catch (error) {
    console.error('Set role error:', error);
    return { success: false, error: 'Failed to set role. Please try again.' };
  }
}

