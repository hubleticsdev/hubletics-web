'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { recurringGroupLesson } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { validateInput } from '@/lib/validations';
import { updateRecurringLesson } from '@/lib/recurring-lessons';

const editRecurringLessonSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  duration: z.number().min(15).max(480),
  maxParticipants: z.number().min(1).max(50),
  minParticipants: z.number().min(0).max(50),
  pricePerPerson: z.number().min(0),
  location: z.object({
    name: z.string().min(1, 'Location name is required'),
    address: z.string().min(1, 'Location address is required'),
    notes: z.string().optional(),
  }),
  startDate: z.string(),
  endDate: z.string().optional(),
});

type EditRecurringLessonInput = z.infer<typeof editRecurringLessonSchema>;

export async function editRecurringLesson(input: EditRecurringLessonInput) {
  try {
    const session = await requireRole('coach');

    const validated = validateInput(editRecurringLessonSchema, input);

    const existing = await db.query.recurringGroupLesson.findFirst({
      where: eq(recurringGroupLesson.id, validated.id),
    });

    if (!existing) {
      return { success: false, error: 'Recurring lesson not found' };
    }

    if (existing.coachId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate min participants <= max participants
    if (validated.minParticipants > validated.maxParticipants) {
      return { success: false, error: 'Minimum participants cannot exceed maximum participants' };
    }

    const result = await updateRecurringLesson(validated.id, {
      ...validated,
      pricePerPerson: validated.pricePerPerson.toString(),
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to update recurring lesson' };
    }

    return { success: true };
  } catch (error) {
    console.error('[editRecurringLesson]', error);
    return {
      success: false,
      error: 'Failed to update recurring lesson',
    };
  }
}



