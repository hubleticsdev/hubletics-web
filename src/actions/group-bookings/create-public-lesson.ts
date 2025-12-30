'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, publicGroupLessonDetails, recurringGroupLesson, coachProfile } from '@/lib/db/schema';
import { eq, and, gte, lte, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { calculateGroupTotals } from '@/lib/pricing';
import { generateBookingsFromRecurringTemplate } from '@/lib/recurring-lessons';
import crypto from 'crypto';

interface PublicLessonInput {
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  duration: number;
  location: {
    name: string;
    address: string;
    notes?: string;
  };
  maxParticipants: number;
  minParticipants: number;
  pricePerPerson: number;
  description?: string;
}

export async function createPublicGroupLesson(input: PublicLessonInput) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, session.user.id),
      columns: {
        allowPublicGroups: true,
        hourlyRate: true,
        stripeAccountId: true,
      },
      with: {
        user: {
          columns: {
            platformFeePercentage: true,
          },
        },
      },
    });

    if (!coach || !coach.allowPublicGroups) {
      return { success: false, error: 'Public group lessons not enabled for this coach' };
    }

    if (!coach.stripeAccountId) {
      return { success: false, error: 'Please complete Stripe onboarding first' };
    }

    if (input.minParticipants < 2) {
      return { success: false, error: 'Minimum participants must be at least 2' };
    }

    if (input.maxParticipants < input.minParticipants) {
      return { success: false, error: 'Max participants must be greater than or equal to min' };
    }

    if (input.pricePerPerson <= 0) {
      return { success: false, error: 'Price must be greater than 0' };
    }

    const now = new Date();
    const conflicts = await db.query.booking.findMany({
      where: and(
        eq(booking.coachId, session.user.id),
        or(
          and(
            gte(booking.scheduledStartAt, input.scheduledStartAt),
            lte(booking.scheduledStartAt, input.scheduledEndAt)
          ),
          and(
            gte(booking.scheduledEndAt, input.scheduledStartAt),
            lte(booking.scheduledEndAt, input.scheduledEndAt)
          ),
          and(
            lte(booking.scheduledStartAt, input.scheduledStartAt),
            gte(booking.scheduledEndAt, input.scheduledEndAt)
          )
        ),
        or(
          eq(booking.approvalStatus, 'pending_review'),
          eq(booking.approvalStatus, 'accepted')
        )
      ),
      columns: {
        id: true,
        approvalStatus: true,
      },
    });

    if (conflicts.length > 0) {
      return { success: false, error: 'Time slot conflict detected. Please select a different time.' };
    }

    const userPlatformFee = parseFloat(coach.user.platformFeePercentage || '15');
    const totals = calculateGroupTotals(input.pricePerPerson, input.maxParticipants, userPlatformFee);

    const bookingId = crypto.randomUUID();

    // Create base booking record
    await db.insert(booking).values({
      id: bookingId,
      coachId: session.user.id,
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      duration: input.duration,
      location: input.location,
      bookingType: 'public_group',
      approvalStatus: 'accepted', // Auto-approved since coach created it
      fulfillmentStatus: 'scheduled',
    });

    // Create public group lesson details
    await db.insert(publicGroupLessonDetails).values({
      bookingId,
      maxParticipants: input.maxParticipants,
      minParticipants: input.minParticipants,
      pricePerPerson: input.pricePerPerson.toString(),
      capacityStatus: 'open',
      currentParticipants: 0,
      authorizedParticipants: 0,
      capturedParticipants: 0,
    });

    console.log(`Public group lesson created: ${bookingId}`);

    revalidatePath('/dashboard/coach');
    revalidatePath('/coaches/[userId]', 'page');

    return { success: true, bookingId };
  } catch (error) {
    console.error('Create public group lesson error:', error);
    return { success: false, error: 'Failed to create group lesson' };
  }
}

interface RecurringLessonInput {
  title: string;
  description?: string;
  dayOfWeek: number;
  startTime: string;
  duration: number;
  location: {
    name: string;
    address: string;
    notes?: string;
  };
  maxParticipants: number;
  minParticipants: number;
  pricePerPerson: number;
  startDate: string;
  endDate?: string;
}

export async function createRecurringGroupLesson(input: RecurringLessonInput) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const coach = await db.query.coachProfile.findFirst({
      where: eq(coachProfile.userId, session.user.id),
      columns: {
        allowPublicGroups: true,
        stripeAccountId: true,
      },
      with: {
        user: {
          columns: {
            platformFeePercentage: true,
          },
        },
      },
    });

    if (!coach || !coach.allowPublicGroups) {
      return { success: false, error: 'Public group lessons not enabled for this coach' };
    }

    if (!coach.stripeAccountId) {
      return { success: false, error: 'Please complete Stripe onboarding first' };
    }

    if (input.minParticipants < 2) {
      return { success: false, error: 'Minimum participants must be at least 2' };
    }

    if (input.maxParticipants < input.minParticipants) {
      return { success: false, error: 'Max participants must be greater than or equal to min' };
    }

    if (input.pricePerPerson <= 0) {
      return { success: false, error: 'Price must be greater than 0' };
    }

    if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      return { success: false, error: 'Invalid day of week' };
    }

    const recurringId = crypto.randomUUID();

    await db.insert(recurringGroupLesson).values({
      id: recurringId,
      coachId: session.user.id,
      title: input.title,
      description: input.description || null,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      duration: input.duration,
      maxParticipants: input.maxParticipants,
      minParticipants: input.minParticipants,
      pricePerPerson: input.pricePerPerson.toString(),
      location: input.location,
      isActive: true,
      startDate: input.startDate,
      endDate: input.endDate || null,
    });

    console.log(`Recurring group lesson template created: ${recurringId}`);

    const userPlatformFee = parseFloat(coach.user.platformFeePercentage || '15');
    const generationResult = await generateBookingsFromRecurringTemplate(recurringId, userPlatformFee);

    if (!generationResult.success) {
      console.error(`Failed to generate bookings for recurring lesson ${recurringId}:`, generationResult.error);
      // coach can manually trigger generation later if needed
    } else {
      console.log(`Generated ${generationResult.bookingsCreated} bookings for recurring lesson ${recurringId}`);
    }

    revalidatePath('/dashboard/coach');
    revalidatePath('/coaches/[userId]', 'page');

    return {
      success: true,
      recurringId,
      bookingsCreated: generationResult.bookingsCreated || 0,
    };
  } catch (error) {
    console.error('Create recurring group lesson error:', error);
    return { success: false, error: 'Failed to create recurring lesson' };
  }
}
