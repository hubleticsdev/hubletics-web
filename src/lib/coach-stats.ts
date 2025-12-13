// Coach statistics and counters management
import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function incrementCoachLessonsCompleted(coachId: string): Promise<void> {
  try {
    await db
      .update(coachProfile)
      .set({
        totalLessonsCompleted: sql`${coachProfile.totalLessonsCompleted} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(coachProfile.userId, coachId));

    console.log(`Incremented totalLessonsCompleted for coach ${coachId}`);
  } catch (error) {
    console.error(`Failed to increment totalLessonsCompleted for coach ${coachId}:`, error);
    throw error;
  }
}

export async function recalculateCoachStats(coachId: string): Promise<void> {
  try {
    const result = await db
      .select({
        totalLessonsCompleted: sql<number>`COUNT(*)`,
      })
      .from(sql`booking`)
      .where(sql`booking.coachId = ${coachId} AND booking.fulfillment_status = 'completed'`);

    const totalLessonsCompleted = result[0]?.totalLessonsCompleted || 0;

    await db
      .update(coachProfile)
      .set({
        totalLessonsCompleted,
        updatedAt: new Date(),
      })
      .where(eq(coachProfile.userId, coachId));

    console.log(`Recalculated stats for coach ${coachId}: ${totalLessonsCompleted} lessons completed`);
  } catch (error) {
    console.error(`Failed to recalculate stats for coach ${coachId}:`, error);
    throw error;
  }
}
