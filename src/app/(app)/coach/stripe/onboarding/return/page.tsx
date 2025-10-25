import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { isAccountOnboarded } from '@/lib/stripe';

export default async function StripeOnboardingReturnPage() {
  const session = await getSession();

  if (!session || session.user.role !== 'coach') {
    redirect('/auth/signin');
  }

  const coach = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, session.user.id),
  });

  if (!coach || !coach.stripeAccountId) {
    redirect('/dashboard/coach');
  }

  // Check if onboarding is complete
  const isComplete = await isAccountOnboarded(coach.stripeAccountId);

  if (isComplete && !coach.stripeOnboardingComplete) {
    // Update database to mark onboarding as complete
    await db
      .update(coachProfile)
      .set({
        stripeOnboardingComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(coachProfile.userId, session.user.id));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {isComplete ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Setup Complete!
            </h1>
            <p className="text-gray-600 mb-6">
              Your payment account is now set up. You can start accepting
              bookings and receiving payments!
            </p>
            <a
              href="/dashboard/coach"
              className="inline-block px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Go to Dashboard
            </a>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Setup Incomplete
            </h1>
            <p className="text-gray-600 mb-6">
              It looks like you haven't finished setting up your payment account.
              Please complete the setup to start accepting bookings.
            </p>
            <a
              href="/coach/stripe/onboarding"
              className="inline-block px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Continue Setup
            </a>
          </>
        )}
      </div>
    </div>
  );
}

