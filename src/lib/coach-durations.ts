'use server';

import { db } from '@/lib/db';
import { coachAllowedDurations, coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type AllowedDuration = {
  durationMinutes: number;
  isDefault: boolean;
};

// Get allowed durations for a coach, with fallback to sessionDuration if no entries exist.
export async function getCoachAllowedDurations(coachId: string): Promise<{
  durations: AllowedDuration[];
  defaultDuration: number;
}> {
  const allowedDurations = await db.query.coachAllowedDurations.findMany({
    where: eq(coachAllowedDurations.coachId, coachId),
    orderBy: (durations, { asc }) => [asc(durations.durationMinutes)],
  });

  if (allowedDurations.length > 0) {
    const defaultDuration = allowedDurations.find(d => d.isDefault)?.durationMinutes 
      || allowedDurations[0].durationMinutes;
    
    return {
      durations: allowedDurations.map(d => ({
        durationMinutes: d.durationMinutes,
        isDefault: d.isDefault,
      })),
      defaultDuration,
    };
  }

  const coach = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, coachId),
    columns: {
      sessionDuration: true,
    },
  });

  const fallbackDuration = coach?.sessionDuration || 60;

  return {
    durations: [{
      durationMinutes: fallbackDuration,
      isDefault: true,
    }],
    defaultDuration: fallbackDuration,
  };
}

// Get allowed durations for multiple coaches efficiently
export async function getCoachesAllowedDurations(coachIds: string[]): Promise<Map<string, {
  durations: AllowedDuration[];
  defaultDuration: number;
}>> {
  if (coachIds.length === 0) {
    return new Map();
  }

  const { inArray } = await import('drizzle-orm');

  const allAllowedDurations = await db.query.coachAllowedDurations.findMany({
    where: inArray(coachAllowedDurations.coachId, coachIds),
    orderBy: (durations, { asc }) => [asc(durations.durationMinutes)],
  });

  const durationsByCoach = new Map<string, AllowedDuration[]>();
  for (const duration of allAllowedDurations) {
    const existing = durationsByCoach.get(duration.coachId) || [];
    existing.push({
      durationMinutes: duration.durationMinutes,
      isDefault: duration.isDefault,
    });
    durationsByCoach.set(duration.coachId, existing);
  }

  const coachesNeedingFallback = coachIds.filter(id => !durationsByCoach.has(id));
  const fallbackCoaches = coachesNeedingFallback.length > 0
    ? await db.query.coachProfile.findMany({
        where: inArray(coachProfile.userId, coachesNeedingFallback),
        columns: {
          userId: true,
          sessionDuration: true,
        },
      })
    : [];

  const result = new Map<string, { durations: AllowedDuration[]; defaultDuration: number }>();

  for (const coachId of coachIds) {
    const durations = durationsByCoach.get(coachId);
    
    if (durations && durations.length > 0) {
      const defaultDuration = durations.find(d => d.isDefault)?.durationMinutes 
        || durations[0].durationMinutes;
      result.set(coachId, { durations, defaultDuration });
    } else {
      // Use fallback
      const fallbackCoach = fallbackCoaches.find(c => c.userId === coachId);
      const fallbackDuration = fallbackCoach?.sessionDuration || 60;
      result.set(coachId, {
        durations: [{
          durationMinutes: fallbackDuration,
          isDefault: true,
        }],
        defaultDuration: fallbackDuration,
      });
    }
  }

  return result;
}
