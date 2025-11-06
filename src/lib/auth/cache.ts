// Invalidate the Better Auth session cookie cache since it becomes stale after profile updates

import { cookies } from 'next/headers';

export async function invalidateSessionCache(): Promise<void> {
  const cookieStore = await cookies();

  // In production, the cookie name is __Secure-better-auth.session_data
  // To delete __Secure- cookies, you MUST set the same attributes they were created with
  if (process.env.NODE_ENV === 'production') {
    cookieStore.set('__Secure-better-auth.session_data', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Expire immediately
    });
  } else {
    cookieStore.set('better-auth.session_data', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Expire immediately
    });
  }
}