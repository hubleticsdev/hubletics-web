import { requireRole } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function PendingCoachesPage() {
  await requireRole('admin');

  redirect('/admin');
}
