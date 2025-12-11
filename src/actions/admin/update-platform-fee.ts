'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateUserPlatformFee(
  userId: string,
  platformFeePercentage: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole('admin');

    if (platformFeePercentage < 0 || platformFeePercentage > 100) {
      return {
        success: false,
        error: 'Platform fee must be between 0% and 100%',
      };
    }

    await db
      .update(user)
      .set({
        platformFeePercentage: platformFeePercentage.toFixed(2),
      })
      .where(eq(user.id, userId));

    revalidatePath('/admin/settings');

    return { success: true };
  } catch (error) {
    console.error('Error updating platform fee:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update platform fee',
    };
  }
}
