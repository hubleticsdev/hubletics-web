import { Suspense } from 'react';
import { getFlaggedMessages } from '@/actions/admin/flagged-messages';
import { requireRole } from '@/lib/auth/session';
import { FlaggedMessagesClient } from './client';
import { redirect } from 'next/navigation';

export default async function FlaggedMessagesPage() {
  const session = await requireRole('admin');

  if (!session) {
    redirect('/auth/signin');
  }

  const flaggedMessages = await getFlaggedMessages();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Flagged Messages</h1>
        <p className="text-gray-600">
          Review and moderate flagged messages reported by users.
        </p>
      </div>

      <Suspense fallback={<div>Loading flagged messages...</div>}>
        <FlaggedMessagesClient initialMessages={flaggedMessages} />
      </Suspense>
    </div>
  );
}
