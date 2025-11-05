// Invalidate the Better Auth session cookie cache since it becomes stale after profile updates

import { cookies } from 'next/headers';
export async function invalidateSessionCache(): Promise<void> {
  const cookieStore = await cookies();

  // In production, the cookie name is __Secure-better-auth.session_data
  if (process.env.NODE_ENV === 'production') {
    cookieStore.delete('__Secure-better-auth.session_data');
  } else {
    cookieStore.delete('better-auth.session_data');
  }
}