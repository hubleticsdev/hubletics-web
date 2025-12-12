'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { review, booking, coachProfile } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { validateInput } from '@/lib/validations';
import { revalidatePath } from 'next/cache';
import { sanitizeText } from '@/lib/utils';

const createReviewSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  reviewText: z.string().min(10, 'Review must be at least 10 characters').max(1000, 'Review must be at most 1000 characters').optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export async function createReview(input: CreateReviewInput) {
  try {
    const session = await getSession();

    if (!session || session.user.role !== 'client') {
      return { success: false, error: 'Only clients can leave reviews' };
    }

    const validatedInput = validateInput(createReviewSchema, input);

    const bookingRecord = await db.query.booking.findFirst({
      where: and(
        eq(booking.id, validatedInput.bookingId),
        eq(booking.clientId, session.user.id),
        eq(booking.status, 'completed')
      ),
    });

    if (!bookingRecord) {
      return { success: false, error: 'Booking not found or not completed' };
    }

    const existingReview = await db.query.review.findFirst({
      where: eq(review.bookingId, validatedInput.bookingId),
    });

    if (existingReview) {
      return { success: false, error: 'You have already reviewed this booking' };
    }

    await db.insert(review).values({
      bookingId: validatedInput.bookingId,
      reviewerId: session.user.id,
      coachId: bookingRecord.coachId,
      rating: validatedInput.rating,
      reviewText: validatedInput.reviewText ? sanitizeText(validatedInput.reviewText) : null,
    });

    const coachReviews = await db
      .select({
        avgRating: sql<number>`AVG(${review.rating})`,
        totalReviews: sql<number>`COUNT(*)`,
      })
      .from(review)
      .where(eq(review.coachId, bookingRecord.coachId));

    if (coachReviews[0]) {
      await db
        .update(coachProfile)
        .set({
          reputationScore: coachReviews[0].avgRating.toFixed(2),
          totalReviews: Number(coachReviews[0].totalReviews),
          updatedAt: new Date(),
        })
        .where(eq(coachProfile.userId, bookingRecord.coachId));
    }

    revalidatePath(`/coaches/${bookingRecord.coachId}`);
    revalidatePath('/coaches');

    console.log(`Review created for booking ${validatedInput.bookingId} by ${session.user.id}`);

    return { success: true };
  } catch (error) {
    console.error('Create review error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create review' };
  }
}

export async function getCoachReviews(coachId: string, limit: number = 10) {
  try {
    const reviews = await db.query.review.findMany({
      where: eq(review.coachId, coachId),
      with: {
        reviewer: {
          columns: {
            name: true,
            image: true,
          },
        },
      },
      orderBy: (reviews, { desc }) => [desc(reviews.createdAt)],
      limit,
    });

    return { success: true, reviews };
  } catch (error) {
    console.error('Get coach reviews error:', error);
    return { success: false, error: 'Failed to fetch reviews', reviews: [] };
  }
}

