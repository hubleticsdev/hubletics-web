'use server';

import { db } from '@/lib/db';
import { user, adminAction } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { validateInput } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

const updateUserStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['active', 'suspended', 'banned', 'deactivated']),
  reason: z.string().optional(),
});

export async function updateUserStatus(
  userId: string,
  status: 'active' | 'suspended' | 'banned' | 'deactivated',
  reason?: string
) {
  try {
    const session = await requireRole('admin');

    const validated = validateInput(updateUserStatusSchema, {
      userId,
      status,
      reason,
    });

    if (validated.userId === session.user.id) {
      return { success: false, error: 'Cannot modify your own status' };
    }

    // Check if user exists
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, validated.userId),
      columns: {
        id: true,
        name: true,
        email: true,
        status: true,
        role: true,
      },
    });

    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    if (targetUser.role === 'admin' && validated.status !== 'active') {
      return { success: false, error: 'Cannot suspend or ban admin users' };
    }

    const oldStatus = targetUser.status;

    // Update user status
    await db
      .update(user)
      .set({
        status: validated.status,
        updatedAt: new Date(),
      })
      .where(eq(user.id, validated.userId));

    // Log admin action
    const actionType =
      validated.status === 'suspended'
        ? 'suspended_user'
        : validated.status === 'banned'
          ? 'banned_user'
          : validated.status === 'active'
            ? 'warned_user'
            : 'deleted_account';

    await db.insert(adminAction).values({
      adminId: session.user.id,
      action: actionType,
      relatedEntityId: validated.userId,
      notes: `User status changed from ${oldStatus} to ${validated.status}${validated.reason ? ` - ${validated.reason}` : ''}`,
    });

    console.log(
      `[ADMIN] User ${targetUser.email} (${targetUser.id}) status changed from ${oldStatus} to ${validated.status} by ${session.user.id}`
    );

    revalidatePath('/admin/users');

    return { success: true };
  } catch (error) {
    console.error('Error updating user status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user status',
    };
  }
}
