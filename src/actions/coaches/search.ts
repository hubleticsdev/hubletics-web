'use server';

import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { and, eq, gte, lte, sql, or, ilike } from 'drizzle-orm';

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
  hourlyRate: string; // Decimal type from DB
  reputationScore: string; // Decimal type from DB
  totalReviews: number;
  totalLessonsCompleted: number;
  user: {
    image: string | null;
    email: string;
  };
}

/**
 * Search and filter coaches
 * Only returns approved coaches with completed Stripe onboarding
 */
export async function searchCoaches(
  filters: CoachSearchFilters = {}
): Promise<{ coaches: CoachSearchResult[]; total: number }> {
  try {
    const conditions = [
      eq(coachProfile.adminApprovalStatus, 'approved'),
      eq(coachProfile.stripeOnboardingComplete, true),
    ];

    // Filter by sport (specialty)
    if (filters.sport) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements(${coachProfile.specialties}) AS spec
          WHERE spec->>'sport' = ${filters.sport}
        )`
      );
    }

    // Filter by location
    if (filters.location) {
      conditions.push(ilike(coachProfile.location, `%${filters.location}%`));
    }

    // Filter by price range
    if (filters.minPrice !== undefined) {
      conditions.push(gte(coachProfile.hourlyRate, filters.minPrice.toString()));
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(lte(coachProfile.hourlyRate, filters.maxPrice.toString()));
    }

    // Filter by minimum rating
    if (filters.minRating !== undefined) {
      conditions.push(gte(coachProfile.reputationScore, filters.minRating.toString()));
    }

    // Search by name
    if (filters.searchQuery) {
      conditions.push(
        ilike(coachProfile.fullName, `%${filters.searchQuery}%`)
      );
    }

    const coaches = await db.query.coachProfile.findMany({
      where: and(...conditions),
      with: {
        user: {
          columns: {
            image: true,
            email: true,
          },
        },
      },
      orderBy: (coaches, { desc }) => [
        desc(coaches.reputationScore),
        desc(coaches.totalReviews),
      ],
      limit: 50, // Reasonable limit for now
    });

    return {
      coaches: coaches as CoachSearchResult[],
      total: coaches.length,
    };
  } catch (error) {
    console.error('Search coaches error:', error);
    return { coaches: [], total: 0 };
  }
}

/**
 * Get a single coach's public profile
 */
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
            image: true,
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

/**
 * Get all unique sports from approved coaches
 * Used for the filter dropdown
 */
export async function getAvailableSpecialties(): Promise<string[]> {
  try {
    const result = await db
      .select({
        specialties: coachProfile.specialties,
      })
      .from(coachProfile)
      .where(
        and(
          eq(coachProfile.adminApprovalStatus, 'approved'),
          eq(coachProfile.stripeOnboardingComplete, true)
        )
      );

    // Extract unique sport names from specialties
    const allSports = result.flatMap((r) => 
      (r.specialties || []).map((spec) => spec.sport)
    );
    const uniqueSports = Array.from(new Set(allSports)).sort();

    return uniqueSports;
  } catch (error) {
    console.error('Get available specialties error:', error);
    return [];
  }
}

