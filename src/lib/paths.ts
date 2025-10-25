/**
 * Centralized path definitions for the application.
 * All routes should be referenced through these helpers to ensure consistency
 * and make refactoring easier.
 */

import type { UserRole } from '@/types/auth';

/**
 * Authentication routes
 */
export const authPaths = {
  signIn: () => '/auth/signin',
  signUp: () => '/auth/signup',
  verifyEmail: (email?: string) =>
    email ? `/auth/verify-email?email=${encodeURIComponent(email)}` : '/auth/verify-email',
  forgotPassword: () => '/auth/forgot-password',
  resetPassword: (token?: string) =>
    token ? `/auth/reset-password?token=${token}` : '/auth/reset-password',
  suspended: () => '/auth/suspended',
} as const;

/**
 * Onboarding routes
 */
export const onboardingPaths = {
  athlete: () => '/onboarding/athlete',
  coach: () => '/onboarding/coach',
  forRole: (role: UserRole) => {
    if (role === 'client') return onboardingPaths.athlete();
    if (role === 'coach') return onboardingPaths.coach();
    // Admins don't have onboarding
    return dashboardPaths.admin();
  },
} as const;

/**
 * Dashboard routes
 */
export const dashboardPaths = {
  athlete: () => '/dashboard/athlete',
  coach: () => '/dashboard/coach',
  admin: () => '/admin',
  forRole: (role: UserRole) => {
    if (role === 'client') return dashboardPaths.athlete();
    if (role === 'coach') return dashboardPaths.coach();
    if (role === 'admin') return dashboardPaths.admin();
    return '/'; // Fallback
  },
} as const;

/**
 * Booking routes
 */
export const bookingPaths = {
  list: () => '/dashboard/bookings',
  details: (bookingId: string) => `/dashboard/bookings/${bookingId}`,
  create: (coachId?: string) =>
    coachId ? `/dashboard/bookings/new?coachId=${coachId}` : '/dashboard/bookings/new',
} as const;

/**
 * Coach discovery and profile routes
 */
export const coachPaths = {
  discover: () => '/coaches',
  profile: (coachId: string) => `/coaches/${coachId}`,
  availability: (coachId: string) => `/coaches/${coachId}/availability`,
} as const;

/**
 * Athlete profile routes
 */
export const athletePaths = {
  profile: (athleteId?: string) =>
    athleteId ? `/dashboard/athletes/${athleteId}` : '/dashboard/profile',
} as const;

/**
 * Message routes
 */
export const messagePaths = {
  inbox: () => '/dashboard/messages',
  conversation: (conversationId: string) => `/dashboard/messages/${conversationId}`,
} as const;

/**
 * Admin routes
 */
export const adminPaths = {
  dashboard: () => '/admin',
  users: () => '/admin/users',
  userDetails: (userId: string) => `/admin/users/${userId}`,
  coaches: () => '/admin/coaches',
  coachDetails: (coachId: string) => `/admin/coaches/${coachId}`,
  bookings: () => '/admin/bookings',
  disputes: () => '/admin/disputes',
  disputeDetails: (disputeId: string) => `/admin/disputes/${disputeId}`,
  analytics: () => '/admin/analytics',
  settings: () => '/admin/settings',
} as const;

/**
 * Marketing/public routes
 */
export const publicPaths = {
  home: () => '/',
  about: () => '/about',
  pricing: () => '/pricing',
  howItWorks: () => '/how-it-works',
  contact: () => '/contact',
  terms: () => '/terms',
  privacy: () => '/privacy',
} as const;

/**
 * API routes
 */
export const apiPaths = {
  auth: {
    base: () => '/api/auth',
    session: () => '/api/auth/session',
  },
  stripe: {
    webhook: () => '/api/webhooks/stripe',
    createCheckout: () => '/api/stripe/checkout',
    createConnectAccount: () => '/api/stripe/connect/account',
  },
  uploadthing: () => '/api/uploadthing',
} as const;

/**
 * Helper to determine the appropriate post-login redirect based on user role and profile status
 */
export function getPostLoginRedirect(role: UserRole, profileComplete: boolean): string {
  if (!profileComplete) {
    return onboardingPaths.forRole(role);
  }
  return dashboardPaths.forRole(role);
}

/**
 * Helper to check if a path matches a pattern
 */
export function pathMatches(pathname: string, pattern: string): boolean {
  // Simple exact match for now, can be enhanced with pattern matching if needed
  return pathname === pattern || pathname.startsWith(pattern + '/');
}

/**
 * Helper to check if path is in a specific section
 */
export const pathChecks = {
  isAuth: (pathname: string) => pathname.startsWith('/auth'),
  isDashboard: (pathname: string) => pathname.startsWith('/dashboard'),
  isAdmin: (pathname: string) => pathname.startsWith('/admin'),
  isOnboarding: (pathname: string) => pathname.startsWith('/onboarding'),
  isPublic: (pathname: string) => {
    return (
      !pathChecks.isAuth(pathname) &&
      !pathChecks.isDashboard(pathname) &&
      !pathChecks.isAdmin(pathname) &&
      !pathChecks.isOnboarding(pathname)
    );
  },
} as const;
