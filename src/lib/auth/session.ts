import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, type User } from '@/lib/auth';
import type { UserRole } from '@/types/auth';

type SessionResponse = {
  user: User;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
} | null;

export const getSession = cache(async (): Promise<SessionResponse> => {
  const headersList = await headers();
  
  const userId = headersList.get('x-user-id');
  
  if (userId) {
    return {
      user: {
        id: userId,
        role: headersList.get('x-user-role') as UserRole,
        email: headersList.get('x-user-email') || '',
        name: headersList.get('x-user-name') || '',
        username: headersList.get('x-user-username') || '',
        image: headersList.get('x-user-image') || null,
        profileComplete: headersList.get('x-user-profile-complete') === 'true',
        status: headersList.get('x-user-status') as 'active' | 'suspended' | 'banned' | 'deactivated',
        timezone: headersList.get('x-user-timezone') || 'America/Chicago',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User,
      session: {
        id: '',
        userId: userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        token: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }
  
  return await auth.api.getSession({
    headers: headersList,
  }) as SessionResponse;
});

export const requireAuth = cache(async (): Promise<NonNullable<SessionResponse>> => {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/signin');
  }
  
  return session;
});

export const requireRole = cache(async (role: UserRole): Promise<NonNullable<SessionResponse>> => {
  const session = await requireAuth();
  
  if (session.user.role !== role) {
    redirect('/');
  }
  
  return session;
});

export const requireCompleteProfile = cache(async (): Promise<NonNullable<SessionResponse>> => {
  const session = await requireAuth();
  
  if (!session.user.profileComplete) {
    const redirectPath = session.user.role === 'client' 
      ? '/onboarding/athlete' 
      : '/onboarding/coach';
    redirect(redirectPath);
  }
  
  return session;
});

export async function getSessionFromRequest(req: Request): Promise<SessionResponse> {
  return await auth.api.getSession({
    headers: req.headers,
  }) as SessionResponse;
}