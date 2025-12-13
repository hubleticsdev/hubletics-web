import { db } from '@/lib/db';
import { booking, recurringGroupLesson } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { calculateGroupTotals } from '@/lib/pricing';
import crypto from 'crypto';

interface RecurringLessonTemplate {
  id: string;
  coachId: string;
  title: string;
  description: string | null;
  dayOfWeek: number;
  startTime: string;
  duration: number;
  maxParticipants: number;
  minParticipants: number;
  pricePerPerson: string;
  location: {
    name: string;
    address: string;
    notes?: string;
  };
  startDate: string;
  endDate: string | null;
}

interface GenerateBookingsResult {
  success: boolean;
  bookingsCreated?: number;
  error?: string;
}

export async function generateBookingsFromRecurringTemplate(
  recurringId: string,
  platformFeePercentage: number = 15
): Promise<GenerateBookingsResult> {
  try {
    const template = await db.query.recurringGroupLesson.findFirst({
      where: eq(recurringGroupLesson.id, recurringId),
    });

    if (!template) {
      return { success: false, error: 'Recurring lesson template not found' };
    }

    const typedTemplate = template as unknown as RecurringLessonTemplate;

    const startDate = new Date(typedTemplate.startDate);
    const endDate = typedTemplate.endDate ? new Date(typedTemplate.endDate) : null;

    const finalEndDate = endDate || new Date(startDate.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);

    const bookingsToCreate = [];
    const currentDate = new Date(startDate);

    while (currentDate.getDay() !== typedTemplate.dayOfWeek) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    while (currentDate <= finalEndDate) {
      const [hours, minutes] = typedTemplate.startTime.split(':').map(Number);

      const scheduledStartAt = new Date(currentDate);
      scheduledStartAt.setHours(hours, minutes, 0, 0);

      const scheduledEndAt = new Date(scheduledStartAt);
      scheduledEndAt.setMinutes(scheduledEndAt.getMinutes() + typedTemplate.duration);

      const pricePerPerson = parseFloat(typedTemplate.pricePerPerson);
      const totals = calculateGroupTotals(pricePerPerson, typedTemplate.maxParticipants, platformFeePercentage);

      bookingsToCreate.push({
        id: crypto.randomUUID(),
        clientId: typedTemplate.coachId,
        coachId: typedTemplate.coachId,
        scheduledStartAt,
        scheduledEndAt,
        duration: typedTemplate.duration,
        location: typedTemplate.location,
        clientMessage: typedTemplate.description || typedTemplate.title,
        coachRate: pricePerPerson.toString(),
        pricePerPerson: pricePerPerson.toString(),
        expectedGrossCents: totals.totalGrossCents,
        platformFeeCents: totals.platformFeeCents,
        stripeFeeCents: totals.stripeFeeCents,
        coachPayoutCents: totals.coachPayoutCents,
        approvalStatus: 'accepted' as const,
        paymentStatus: 'not_required' as const,
        fulfillmentStatus: 'scheduled' as const,
        capacityStatus: 'open' as const,
        isGroupBooking: true,
        groupType: 'public' as const,
        organizerId: typedTemplate.coachId,
        maxParticipants: typedTemplate.maxParticipants,
        minParticipants: typedTemplate.minParticipants,
        currentParticipants: 0,
        recurringLessonId: recurringId,
      });

      currentDate.setDate(currentDate.getDate() + 7);
    }

    if (bookingsToCreate.length > 0) {
      await db.insert(booking).values(bookingsToCreate);
      console.log(`[RECURRING_LESSONS] Generated ${bookingsToCreate.length} bookings for recurring lesson ${recurringId}`);
    }

    return {
      success: true,
      bookingsCreated: bookingsToCreate.length,
    };
  } catch (error) {
    console.error('[RECURRING_LESSONS] Error generating bookings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate bookings',
    };
  }
}

export async function cancelRecurringLesson(recurringId: string): Promise<GenerateBookingsResult> {
  try {
    await db
      .update(recurringGroupLesson)
      .set({ isActive: false })
      .where(eq(recurringGroupLesson.id, recurringId));

    // don't automatically cancel existing bookings that already have participants
    // should be handled individually by the coach

    console.log(`[RECURRING_LESSONS] Deactivated recurring lesson ${recurringId}`);

    return { success: true };
  } catch (error) {
    console.error('[RECURRING_LESSONS] Error canceling recurring lesson:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel recurring lesson',
    };
  }
}

export async function updateRecurringLesson(
  recurringId: string,
  updates: Partial<RecurringLessonTemplate>
): Promise<GenerateBookingsResult> {
  try {
    const existing = await db.query.recurringGroupLesson.findFirst({
      where: eq(recurringGroupLesson.id, recurringId),
    });

    if (!existing) {
      return { success: false, error: 'Recurring lesson not found' };
    }

    await db
      .update(recurringGroupLesson)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(recurringGroupLesson.id, recurringId));

    console.log(`[RECURRING_LESSONS] Updated recurring lesson ${recurringId}`);

    return { success: true };
  } catch (error) {
    console.error('[RECURRING_LESSONS] Error updating recurring lesson:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update recurring lesson',
    };
  }
}
