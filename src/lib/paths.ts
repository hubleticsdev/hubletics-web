import type { UserRole } from '@/types/auth';

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

export const onboardingPaths = {
  athlete: () => '/onboarding/athlete',
  coach: () => '/onboarding/coach',
  forRole: (role: UserRole) => {
    if (role === 'client') return onboardingPaths.athlete();
    if (role === 'coach') return onboardingPaths.coach();
    return dashboardPaths.admin();
  },
} as const;

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

export const bookingPaths = {
  list: () => '/dashboard/bookings',
  details: (bookingId: string) => `/dashboard/bookings/${bookingId}`,
  create: (coachId?: string) =>
    coachId ? `/dashboard/bookings/new?coachId=${coachId}` : '/dashboard/bookings/new',
} as const;

export const coachPaths = {
  discover: () => '/coaches',
  profile: (coachId: string) => `/coaches/${coachId}`,
  availability: (coachId: string) => `/coaches/${coachId}/availability`,
} as const;

export const athletePaths = {
  profile: (athleteId?: string) =>
    athleteId ? `/dashboard/athletes/${athleteId}` : '/dashboard/profile',
} as const;

export const messagePaths = {
  inbox: () => '/dashboard/messages',
  conversation: (conversationId: string) => `/dashboard/messages/${conversationId}`,
} as const;

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

export const publicPaths = {
  home: () => '/',
  about: () => '/about',
  pricing: () => '/pricing',
  howItWorks: () => '/how-it-works',
  contact: () => '/contact',
  terms: () => '/terms',
  privacy: () => '/privacy',
} as const;

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

export function getPostLoginRedirect(role: UserRole, profileComplete: boolean): string {
  if (!profileComplete) {
    return onboardingPaths.forRole(role);
  }
  return dashboardPaths.forRole(role);
}

export function pathMatches(pathname: string, pattern: string): boolean {
  // Simple exact match for now, can be enhanced with pattern matching if needed
  return pathname === pattern || pathname.startsWith(pattern + '/');
}

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
