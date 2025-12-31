import { db } from '@/lib/db';
import { booking, recurringGroupLesson, publicGroupLessonDetails } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { fromZonedTime } from 'date-fns-tz';

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
  timezone: string;
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
    const coachTimezone = typedTemplate.timezone || 'America/Chicago';

    const startDate = new Date(typedTemplate.startDate);
    const endDate = typedTemplate.endDate ? new Date(typedTemplate.endDate) : null;

    const finalEndDate = endDate || new Date(startDate.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);

    const bookingsToCreate = [];
    const currentDate = new Date(startDate);

    while (currentDate.getDay() !== typedTemplate.dayOfWeek) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    while (currentDate <= finalEndDate) {
      // Build date string in YYYY-MM-DD format
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      // Combine date and time, then convert from coach's timezone to UTC
      const localDateTime = `${dateString}T${typedTemplate.startTime}:00`;
      const scheduledStartAt = fromZonedTime(localDateTime, coachTimezone);

      const scheduledEndAt = new Date(scheduledStartAt);
      scheduledEndAt.setMinutes(scheduledEndAt.getMinutes() + typedTemplate.duration);

      const pricePerPerson = parseFloat(typedTemplate.pricePerPerson);

      const bookingId = crypto.randomUUID();

      // Create base booking
      const baseBooking = {
        id: bookingId,
        coachId: typedTemplate.coachId,
        bookingType: 'public_group' as const,
        scheduledStartAt,
        scheduledEndAt,
        duration: typedTemplate.duration,
        location: typedTemplate.location,
        approvalStatus: 'accepted' as const,
        fulfillmentStatus: 'scheduled' as const,
      };

      // Create public group lesson details
      const publicGroupDetails = {
        bookingId,
        maxParticipants: typedTemplate.maxParticipants,
        minParticipants: typedTemplate.minParticipants,
        pricePerPerson: pricePerPerson.toString(),
        capacityStatus: 'open' as const,
        currentParticipants: 0,
        authorizedParticipants: 0,
        capturedParticipants: 0,
        clientMessage: typedTemplate.description || typedTemplate.title,
        recurringLessonId: recurringId,
      };

      bookingsToCreate.push({ baseBooking, publicGroupDetails });

      currentDate.setDate(currentDate.getDate() + 7);
    }

    if (bookingsToCreate.length > 0) {
      // Insert bookings and details in transaction
      for (const { baseBooking, publicGroupDetails } of bookingsToCreate) {
        await db.insert(booking).values(baseBooking);
        await db.insert(publicGroupLessonDetails).values(publicGroupDetails);
      }
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
    // Deactivate the template
    await db
      .update(recurringGroupLesson)
      .set({ isActive: false })
      .where(eq(recurringGroupLesson.id, recurringId));

    // Find all bookings from this recurring template
    const relatedBookings = await db.query.publicGroupLessonDetails.findMany({
      where: eq(publicGroupLessonDetails.recurringLessonId, recurringId),
      columns: {
        bookingId: true,
        currentParticipants: true,
      },
    });

    // Delete bookings with 0 participants
    const emptyBookingIds = relatedBookings
      .filter(b => !b.currentParticipants || b.currentParticipants === 0)
      .map(b => b.bookingId);

    if (emptyBookingIds.length > 0) {
      // Delete the details first (foreign key constraint)
      for (const bookingId of emptyBookingIds) {
        await db.delete(publicGroupLessonDetails).where(eq(publicGroupLessonDetails.bookingId, bookingId));
        await db.delete(booking).where(eq(booking.id, bookingId));
      }
      console.log(`[RECURRING_LESSONS] Deleted ${emptyBookingIds.length} empty bookings for recurring lesson ${recurringId}`);
    }

    const keptBookings = relatedBookings.length - emptyBookingIds.length;
    if (keptBookings > 0) {
      console.log(`[RECURRING_LESSONS] Kept ${keptBookings} bookings with participants for manual handling`);
    }

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
