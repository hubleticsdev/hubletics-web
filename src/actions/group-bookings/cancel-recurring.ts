'use server';

import { requireRole } from '@/lib/auth/session';
import { cancelRecurringLesson } from '@/lib/recurring-lessons';
import { db } from '@/lib/db';
import { recurringGroupLesson } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function cancelRecurringTemplate(recurringId: string) {
    try {
        const session = await requireRole('coach');

        // Verify ownership
        const template = await db.query.recurringGroupLesson.findFirst({
            where: eq(recurringGroupLesson.id, recurringId),
            columns: {
                id: true,
                coachId: true,
            },
        });

        if (!template) {
            return { success: false, error: 'Recurring lesson template not found' };
        }

        if (template.coachId !== session.user.id) {
            return { success: false, error: 'Unauthorized - you do not own this template' };
        }

        // Cancel the template
        const result = await cancelRecurringLesson(recurringId);

        if (!result.success) {
            return { success: false, error: result.error || 'Failed to cancel template' };
        }

        // Revalidate coach dashboard
        revalidatePath('/dashboard/coach');

        return { success: true };
    } catch (error) {
        console.error('[cancelRecurringTemplate]', error);
        return {
            success: false,
            error: 'Failed to cancel recurring lesson template',
        };
    }
}
