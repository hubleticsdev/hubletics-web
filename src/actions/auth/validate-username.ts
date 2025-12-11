'use server';

import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { usernameSchema } from '@/lib/validations';

export async function checkUsernameAvailability(
  username: string
): Promise<{ available: boolean; error?: string }> {
  try {
    const validation = usernameSchema.safeParse(username);
    if (!validation.success) {
      const errorMessage = validation.error?.issues?.[0]?.message || 'Invalid username format';
      return {
        available: false,
        error: errorMessage,
      };
    }

    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(sql`LOWER(${user.username}) = LOWER(${username})`)
      .limit(1);

    if (existingUser.length > 0) {
      return {
        available: false,
        error: 'This username is already taken',
      };
    }

    return { available: true };
  } catch (error) {
    console.error('Error checking username availability:', error);
    return {
      available: false,
      error: 'Failed to check username availability',
    };
  }
}


