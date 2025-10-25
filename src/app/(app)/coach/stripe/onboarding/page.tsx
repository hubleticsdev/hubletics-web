import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { coachProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { createAccountLink } from '@/lib/stripe';
import { headers } from 'next/headers';

export default async function StripeOnboardingPage() {
  const session = await getSession();

  if (!session || session.user.role !== 'coach') {
    redirect('/auth/signin');
  }

  const coach = await db.query.coachProfile.findFirst({
    where: eq(coachProfile.userId, session.user.id),
  });

  if (!coach) {
    redirect('/onboarding/coach');
  }

  if (coach.adminApprovalStatus !== 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Pending Approval
          </h1>
          <p className="text-gray-600 mb-6">
            Your coach profile is currently under review by our admin team.
            We'll email you within 24-48 hours once your profile has been reviewed.
          </p>
          <a
            href="/dashboard/coach"
            className="inline-block px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (coach.stripeOnboardingComplete) {
    redirect('/dashboard/coach');
  }

  if (!coach.stripeAccountId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Something went wrong
          </h1>
          <p className="text-gray-600 mb-6">
            We couldn't find your Stripe account. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  // Get current host for callback URLs
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;

  // Generate Stripe onboarding link
  const accountLink = await createAccountLink(
    coach.stripeAccountId,
    `${baseUrl}/coach/stripe/onboarding/refresh`,
    `${baseUrl}/coach/stripe/onboarding/return`
  );

  // Redirect to Stripe onboarding
  redirect(accountLink.url);
}

