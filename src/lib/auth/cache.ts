import { cookies } from 'next/headers';

export async function invalidateSessionCache(): Promise<void> {
  const cookieStore = await cookies();

  if (process.env.NODE_ENV === 'production') {
    cookieStore.set('__Secure-better-auth.session_data', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  } else {
    cookieStore.set('better-auth.session_data', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}