// Invalidate the Better Auth session cookie cache since it becomes stale after profile updates

import { cookies } from 'next/headers';
export async function invalidateSessionCache(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete('better-auth.session_data');
}