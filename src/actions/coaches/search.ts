'use server';

import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { and, eq, gte, lte, sql, ilike, or } from 'drizzle-orm';
import { coachSearchFiltersSchema, validateInput } from '@/lib/validations';

export interface CoachSearchFilters {
  sport?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  searchQuery?: string;
}

export interface CoachSearchResult {
  id: string;
  userId: string;
  fullName: string;
  profilePhoto: string | null;
  location: {
    cities: string[];
    state: string;
  };
  specialties: Array<{ sport: string; tags: string[] }>;
  bio: string;
  hourlyRate: string;
  reputationScore: string;
  totalReviews: number;
  totalLessonsCompleted: number;
  user: {
    username: string;
    image: string | null;
    email: string;
    platformFeePercentage?: string | null;
  };
}

export async function searchCoaches(
  filters: CoachSearchFilters = {}
): Promise<{ coaches: CoachSearchResult[]; total: number }> {
  try {
    const validatedFilters = validateInput(coachSearchFiltersSchema, filters);
    const conditions = [
      eq(coachProfile.adminApprovalStatus, 'approved'),
      eq(coachProfile.stripeOnboardingComplete, true),
    ];

    if (validatedFilters.sport) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements(${coachProfile.specialties}) AS spec
          WHERE spec->>'sport' = ${validatedFilters.sport}
        )`
      );
    }

    if (validatedFilters.location) {
      conditions.push(
        or(
          sql`${coachProfile.location}->>'state' ILIKE ${`%${validatedFilters.location}%`}`,
          sql`EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${coachProfile.location}->'cities') AS city
            WHERE city ILIKE ${`%${validatedFilters.location}%`}
          )`
        )!
      );
    }

    if (validatedFilters.minPrice !== undefined) {
      conditions.push(gte(coachProfile.hourlyRate, validatedFilters.minPrice.toString()));
    }
    if (validatedFilters.maxPrice !== undefined) {
      conditions.push(lte(coachProfile.hourlyRate, validatedFilters.maxPrice.toString()));
    }

    if (validatedFilters.minRating !== undefined) {
      conditions.push(gte(coachProfile.reputationScore, validatedFilters.minRating.toString()));
    }

    if (validatedFilters.searchQuery) {
      conditions.push(
        or(
          ilike(coachProfile.fullName, `%${validatedFilters.searchQuery}%`),
          sql`EXISTS (
            SELECT 1 FROM "user"
            WHERE "user"."id" = ${coachProfile.userId}
            AND LOWER("user"."username") LIKE LOWER(${`%${validatedFilters.searchQuery}%`})
          )`
        )!
      );
    }

    const coaches = await db.query.coachProfile.findMany({
      where: and(...conditions),
      with: {
        user: {
          columns: {
            username: true,
            image: true,
            email: true,
            platformFeePercentage: true,
          },
        },
      },
      orderBy: (coaches, { desc }) => [
        desc(coaches.reputationScore),
        desc(coaches.totalReviews),
      ],
      limit: 50,
    });

    const totalCount = await db.$count(
      coachProfile,
      and(...conditions)
    );

    return {
      coaches: coaches as CoachSearchResult[],
      total: totalCount,
    };
  } catch (error) {
    console.error('Search coaches error:', error);
    return { coaches: [], total: 0 };
  }
}

export async function getCoachPublicProfile(userId: string) {
  try {
    const coach = await db.query.coachProfile.findFirst({
      where: and(
        eq(coachProfile.userId, userId),
        eq(coachProfile.adminApprovalStatus, 'approved'),
        eq(coachProfile.stripeOnboardingComplete, true)
      ),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            username: true,
            image: true,
            platformFeePercentage: true,
            timezone: true,
          },
        },
      },
    });

    if (!coach) {
      return null;
    }

    return coach;
  } catch (error) {
    console.error('Get coach public profile error:', error);
    return null;
  }
}

export async function getAvailableSpecialties(): Promise<string[]> {
  try {
    const result = await db
      .selectDistinct({
        sport: sql<string>`spec->>'sport'`.as('sport'),
      })
      .from(coachProfile)
      .crossJoin(
        sql`jsonb_array_elements(${coachProfile.specialties}) AS spec`
      )
      .where(
        and(
          eq(coachProfile.adminApprovalStatus, 'approved'),
          eq(coachProfile.stripeOnboardingComplete, true)
        )
      )
      .orderBy(sql`sport`);

    return result.map((r) => r.sport);
  } catch (error) {
    console.error('Get available specialties error:', error);
    return [];
  }
}

