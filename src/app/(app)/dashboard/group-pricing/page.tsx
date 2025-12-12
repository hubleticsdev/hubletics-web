import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getCoachPricingTiers } from '@/actions/group-bookings/pricing-tiers';
import { PricingTiersForm } from '@/components/group-bookings/pricing-tiers-form';

export default async function GroupPricingPage() {
  const session = await getSession();

  if (!session || session.user.role !== 'coach') {
    redirect('/auth/signin');
  }

  const result = await getCoachPricingTiers();
  const tiers = result.success ? result.tiers : [];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Group Lesson Pricing</h1>
        <p className="mt-2 text-gray-600">
          Configure your pricing for private group lessons. Set different rates based on the number of participants.
        </p>
      </div>

      <PricingTiersForm initialTiers={tiers || []} />
    </div>
  );
}

