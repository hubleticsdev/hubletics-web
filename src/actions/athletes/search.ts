'use server';

import { db } from '@/lib/db';
import { athleteProfile } from '@/lib/db/schema';
import { eq, and, or, like, sql } from 'drizzle-orm';

export interface AthleteSearchFilters {
  searchQuery?: string;
  sport?: string;
  location?: string;
  minBudget?: number;
  maxBudget?: number;
}

export interface AthleteSearchResult {
  id: string;
  userId: string;
  fullName: string;
  profilePhoto: string | null;
  location: {
    city: string;
    state: string;
  };
  sportsInterested: string[];
  experienceLevel: Record<string, { level: string; notes?: string }>;
  budgetRange: { min: number; max: number } | { single: number };
  bio: string | null;
  user: {
    name: string;
    username: string | null;
    image: string | null;
  };
}

export async function searchAthletes(
  filters: AthleteSearchFilters = {}
): Promise<{ athletes: AthleteSearchResult[]; total: number }> {
  try {
    const conditions = [];

    if (filters.searchQuery) {
      conditions.push(
        like(athleteProfile.fullName, `%${filters.searchQuery}%`)
      );
    }

    if (filters.location) {
      conditions.push(
        or(
          sql`${athleteProfile.location}->>'state' ILIKE ${`%${filters.location}%`}`,
          sql`${athleteProfile.location}->>'city' ILIKE ${`%${filters.location}%`}`
        )!
      );
    }

    if (filters.sport) {
      conditions.push(
        sql`${filters.sport} = ANY(${athleteProfile.sportsInterested})`
      );
    }

    // Add budget filtering at SQL level for performance
    if (filters.minBudget !== undefined || filters.maxBudget !== undefined) {
      const budgetConditions = [];
      
      if (filters.minBudget !== undefined) {
        budgetConditions.push(
          or(
            sql`(${athleteProfile.budgetRange}->>'single')::numeric >= ${filters.minBudget}`,
            sql`(${athleteProfile.budgetRange}->>'max')::numeric >= ${filters.minBudget}`
          )!
        );
      }
      
      if (filters.maxBudget !== undefined) {
        budgetConditions.push(
          or(
            sql`(${athleteProfile.budgetRange}->>'single')::numeric <= ${filters.maxBudget}`,
            sql`(${athleteProfile.budgetRange}->>'min')::numeric <= ${filters.maxBudget}`
          )!
        );
      }
      
      if (budgetConditions.length > 0) {
        conditions.push(and(...budgetConditions));
      }
    }

    const athletes = await db.query.athleteProfile.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        user: {
          columns: {
            name: true,
            username: true,
            image: true,
          },
        },
      },
      limit: 100,
    });

    const totalCount = await db.$count(
      athleteProfile,
      conditions.length > 0 ? and(...conditions) : undefined
    );

    const results: AthleteSearchResult[] = athletes.map((athlete) => ({
      id: athlete.id,
      userId: athlete.userId,
      fullName: athlete.fullName,
      profilePhoto: athlete.profilePhoto,
      location: athlete.location as { city: string; state: string },
      sportsInterested: athlete.sportsInterested,
      experienceLevel: athlete.experienceLevel as Record<
        string,
        { level: string; notes?: string }
      >,
      budgetRange: athlete.budgetRange as { min: number; max: number } | { single: number },
      bio: athlete.bio,
      user: athlete.user,
    }));

    return {
      athletes: results,
      total: totalCount,
    };
  } catch (error) {
    console.error('Search athletes error:', error);
    return { athletes: [], total: 0 };
  }
}

export async function getAvailableSports(): Promise<string[]> {
  try {
    const result = await db
      .selectDistinct({
        sport: sql<string>`unnest(${athleteProfile.sportsInterested})`.as('sport'),
      })
      .from(athleteProfile)
      .orderBy(sql`sport`);

    return result.map((r) => r.sport);
  } catch (error) {
    console.error('Get available sports error:', error);
    return [];
  }
}

export async function getAthletePublicProfile(userId: string) {
  const athlete = await db.query.athleteProfile.findFirst({
    where: eq(athleteProfile.userId, userId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
          email: false,
        },
      },
    },
  });
  return athlete;
}
