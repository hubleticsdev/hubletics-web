'use server';

import { getSession } from '@/lib/auth/session';
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

    // Security: Only allow setting role if current role is 'pending'
    // This prevents users from changing their role after it's been set
    if (user.role !== 'pending') {
      return { success: false, error: 'Role has already been set and cannot be changed' };
    }

    // Security: Only allow setting role if profile is not yet complete
    // This ensures role can only be set during initial account setup
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

    return { success: true };
  } catch (error) {
    console.error('Set role error:', error);
    return { success: false, error: 'Failed to set role. Please try again.' };
  }
}

