'use server';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { groupPricingTier, coachProfile } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getCoachPricingTiers() {
  try {
    const session = await getSession();
    
    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    const tiers = await db.query.groupPricingTier.findMany({
      where: eq(groupPricingTier.coachId, session.user.id),
      orderBy: [asc(groupPricingTier.minParticipants)],
    });

    return { success: true, tiers };
  } catch (error) {
    console.error('Get pricing tiers error:', error);
    return { success: false, error: 'Failed to fetch pricing tiers' };
  }
}

interface PricingTierInput {
  minParticipants: number;
  maxParticipants: number | null; // null means "X+"
  pricePerPerson: number;
}

export async function updatePricingTiers(tiers: PricingTierInput[]) {
  try {
    const session = await getSession();
    
    if (!session || session.user.role !== 'coach') {
      return { success: false, error: 'Unauthorized' };
    }

    for (const tier of tiers) {
      if (tier.minParticipants < 2) {
        return { success: false, error: 'Minimum participants must be at least 2' };
      }
      if (tier.maxParticipants !== null && tier.maxParticipants < tier.minParticipants) {
        return { success: false, error: 'Max participants must be greater than or equal to min' };
      }
      if (tier.pricePerPerson <= 0) {
        return { success: false, error: 'Price must be greater than 0' };
      }
    }

    // Check for overlapping ranges
    const sortedTiers = [...tiers].sort((a, b) => a.minParticipants - b.minParticipants);
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const current = sortedTiers[i];
      const next = sortedTiers[i + 1];
      
      if (current.maxParticipants === null) {
        return {
          success: false,
          error: `Tier ${i + 1} (${current.minParticipants}+) overlaps with tier ${i + 2}. Only the last tier can have unlimited participants.`
        };
      }
      
      if (current.maxParticipants >= next.minParticipants) {
        return {
          success: false,
          error: `Tiers ${i + 1} and ${i + 2} overlap. Tier ${i + 1} ends at ${current.maxParticipants}, but tier ${i + 2} starts at ${next.minParticipants}. Tiers must not overlap.`
        };
      }
    }

    await db.delete(groupPricingTier).where(eq(groupPricingTier.coachId, session.user.id));

    if (tiers.length > 0) {
      await db.insert(groupPricingTier).values(
        tiers.map((tier) => ({
          coachId: session.user.id,
          minParticipants: tier.minParticipants,
          maxParticipants: tier.maxParticipants,
          pricePerPerson: tier.pricePerPerson.toString(),
        }))
      );
    }

    revalidatePath('/dashboard/profile');
    return { success: true };
  } catch (error) {
    console.error('Update pricing tiers error:', error);
    return { success: false, error: 'Failed to update pricing tiers' };
  }
}

export async function getApplicableTier(coachId: string, participantCount: number) {
  try {
    const tiers = await db.query.groupPricingTier.findMany({
      where: eq(groupPricingTier.coachId, coachId),
      orderBy: [asc(groupPricingTier.minParticipants)],
    });

    for (const tier of tiers) {
      if (
        participantCount >= tier.minParticipants &&
        (tier.maxParticipants === null || participantCount <= tier.maxParticipants)
      ) {
        return { success: true, tier };
      }
    }

    return { success: false, error: 'No pricing tier found for this participant count' };
  } catch (error) {
    console.error('Get applicable tier error:', error);
    return { success: false, error: 'Failed to find pricing tier' };
  }
}

