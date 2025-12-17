'use server';

import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { booking, individualBookingDetails, user } from '@/lib/db/schema';
import { eq, and, gte, isNull, sql } from 'drizzle-orm';

export type AdminDashboardMetrics = {
  totalUsers: number;
  monthlyRevenue: number;
  completedBookingsThisMonth: number;
};

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  await requireRole('admin');

  const totalUsers = await db.$count(user, isNull(user.deletedAt));

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const completedBookingsThisMonth = await db.$count(
    booking,
    and(
      eq(booking.fulfillmentStatus, 'completed'),
      gte(booking.createdAt, startOfMonth)
    )
  );

  const monthlyRevenueResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${individualBookingDetails.platformFeeCents}) / 100.0, 0)`
    })
    .from(booking)
    .innerJoin(individualBookingDetails, eq(booking.id, individualBookingDetails.bookingId))
    .where(
      and(
        eq(booking.fulfillmentStatus, 'completed'),
        eq(booking.bookingType, 'individual'),
        gte(booking.createdAt, startOfMonth)
      )
    );

  const monthlyRevenue = Number(monthlyRevenueResult[0]?.total ?? 0);

  return {
    totalUsers,
    monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
    completedBookingsThisMonth,
  };
}
