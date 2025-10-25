/**
 * Cached session helpers for better-auth
 * 
 * These functions use React's `cache()` to memoize session queries within a single request.
 * This prevents N+1 query issues when multiple components/pages call auth methods.
 * 
 * Example:
 * - Without cache: 5 getSession() calls = 5 DB queries
 * - With cache: 5 getSession() calls = 1 DB query (4 cached)
 */

import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, type User } from '@/lib/auth';
import type { UserRole } from '@/types/auth';

// Type helper for better-auth session response
// better-auth returns { session, user } structure
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

/**
 * Get the current session (memoized per request)
 * 
 * OPTIMIZATION: This first checks if the proxy has already fetched the session
 * and passed user data via headers. If so, it reconstructs the session from headers
 * without hitting the database. Otherwise, it falls back to fetching from the database.
 * 
 * This is cached, so multiple calls within the same request will only execute once.
 * 
 * Use this instead of calling `auth.api.getSession()` directly.
 */
export const getSession = cache(async (): Promise<SessionResponse> => {
  const headersList = await headers();
  
  // OPTIMIZATION: Check if proxy has already fetched session and passed via headers
  const userId = headersList.get('x-user-id');
  
  if (userId) {
    // Reconstruct session from headers (no database query needed!)
    return {
      user: {
        id: userId,
        role: headersList.get('x-user-role') as UserRole,
        email: headersList.get('x-user-email') || '',
        name: headersList.get('x-user-name') || '',
        image: headersList.get('x-user-image') || null,
        profileComplete: headersList.get('x-user-profile-complete') === 'true',
        status: headersList.get('x-user-status') as 'active' | 'suspended' | 'banned' | 'deactivated',
        emailVerified: true, // If they're logged in, email is verified
        createdAt: new Date(), // Not critical for runtime, placeholder
        updatedAt: new Date(), // Not critical for runtime, placeholder
      } as User,
      session: {
        id: '', // Not needed for most operations
        userId: userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        token: '', // Not needed
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }
  
  // Fallback: No headers present, fetch from database
  // This happens on public pages or if proxy was skipped
  return await auth.api.getSession({
    headers: headersList,
  }) as SessionResponse;
});

/**
 * Require authentication or redirect to signin
 * 
 * @throws Redirects to /auth/signin if not authenticated
 * @returns The authenticated session
 */
export const requireAuth = cache(async (): Promise<NonNullable<SessionResponse>> => {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/signin');
  }
  
  return session;
});

/**
 * Require a specific role or redirect to unauthorized
 * 
 * @param role - The required user role ('client', 'coach', or 'admin')
 * @throws Redirects to /auth/signin if not authenticated, or / if wrong role
 * @returns The authenticated session with the correct role
 */
export const requireRole = cache(async (role: UserRole): Promise<NonNullable<SessionResponse>> => {
  const session = await requireAuth();
  
  if (session.user.role !== role) {
    // Redirect to home if user has wrong role
    redirect('/');
  }
  
  return session;
});

/**
 * Require a completed profile or redirect to onboarding
 * 
 * @throws Redirects to appropriate onboarding page if profile incomplete
 * @returns The authenticated session with a complete profile
 */
export const requireCompleteProfile = cache(async (): Promise<NonNullable<SessionResponse>> => {
  const session = await requireAuth();
  
  if (!session.user.profileComplete) {
    // Redirect to role-specific onboarding
    const redirectPath = session.user.role === 'client' 
      ? '/onboarding/athlete' 
      : '/onboarding/coach';
    redirect(redirectPath);
  }
  
  return session;
});

/**
 * Get session for API routes (using Request headers)
 * 
 * Use this in UploadThing middleware or other places where you have a Request object.
 * Note: This is NOT cached across different requests, only within the same request.
 * 
 * @param req - The Request object (from API routes)
 * @returns The session or null
 */
export async function getSessionFromRequest(req: Request): Promise<SessionResponse> {
  return await auth.api.getSession({
    headers: req.headers,
  }) as SessionResponse;
}

