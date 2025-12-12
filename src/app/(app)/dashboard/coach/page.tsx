import { getPendingBookingRequests, getUpcomingBookings } from '@/actions/bookings/queries';
import { getCoachEarningsSummary } from '@/actions/coach/earnings';
import { getMyRecurringLessons } from '@/actions/group-bookings/recurring-queries';
import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { CoachDashboardClient } from '@/components/dashboard/coach-dashboard-client';

export default async function CoachDashboard() {
  const session = await requireRole('coach');

  const coach = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, session.user.id),
  });

  if (!coach) {
    redirect('/onboarding/coach');
  }

  const needsApproval = coach.adminApprovalStatus === 'pending';
  const needsStripeOnboarding =
    coach.adminApprovalStatus === 'approved' && !coach.stripeOnboardingComplete;
  const isFullyOnboarded =
    coach.adminApprovalStatus === 'approved' && coach.stripeOnboardingComplete;

  const { bookings: pendingRequests } = await getPendingBookingRequests();
  const { bookings: upcomingSessions } = await getUpcomingBookings();
  const earningsSummary = await getCoachEarningsSummary();
  const { lessons: recurringLessons } = await getMyRecurringLessons();

  return (
    <CoachDashboardClient
      coach={{
        ...coach,
        name: coach.fullName,
        image: coach.profilePhoto,
      }}
      pendingRequests={pendingRequests}
      upcomingSessions={upcomingSessions}
      earningsSummary={earningsSummary}
      recurringLessons={recurringLessons}
      needsApproval={needsApproval}
      needsStripeOnboarding={needsStripeOnboarding}
      isFullyOnboarded={isFullyOnboarded}
      session={session}
    />
  );
}
