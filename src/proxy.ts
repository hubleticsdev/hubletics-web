import { NextRequest, NextResponse } from 'next/server';
import { auth, type User } from '@/lib/auth';
import {
  authPaths,
  dashboardPaths,
  onboardingPaths,
  pathChecks,
} from '@/lib/paths';
import type { UserRole } from '@/types/auth';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OPTIMIZATION: Skip proxy logic for static assets and API routes
  // These should never need authentication checks
  if (
    pathname.startsWith('/_next/') ||  // Next.js internals (static, images, etc.)
    pathname.startsWith('/api/') ||     // API routes (handle auth themselves)
    (pathname.includes('.') && !pathname.endsWith('.html'))  // Files with extensions (images, fonts, etc.), except HTML
  ) {
    return NextResponse.next();
  }

  const isAuthPage = pathChecks.isAuth(pathname);
  const isDashboardPage = pathChecks.isDashboard(pathname);
  const isAdminPage = pathChecks.isAdmin(pathname);
  const isOnboardingPage = pathChecks.isOnboarding(pathname);
  const isHomePage = pathname === '/';
  
  // Early return for home page
  if (isHomePage) {
    return NextResponse.next();
  }
  
  // Only fetch session for protected routes
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // If user is logged in
  if (session) {
    const user = session.user as User;
    const role = user.role as UserRole;
    const status = user.status;

    // Pass session data via REQUEST headers to avoid duplicate queries
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-user-role', role);
    requestHeaders.set('x-user-email', user.email);
    requestHeaders.set('x-user-name', user.name || '');
    requestHeaders.set('x-user-image', user.image || '');
    requestHeaders.set('x-user-profile-complete', user.profileComplete ? 'true' : 'false');
    requestHeaders.set('x-user-status', status);

    // Block suspended, banned, or deactivated users
    if (status !== 'active') {
      await auth.api.signOut({
        headers: request.headers,
      });

      // Redirect to suspended page
      const suspendedResponse = NextResponse.redirect(new URL(authPaths.suspended(), request.url));
      // Clear the session cookie
      suspendedResponse.cookies.delete('better-auth.session_token');
      return suspendedResponse;
    }

    // Handle users with pending role
    if (role === 'pending') {
      const isSelectRolePage = pathname === '/auth/select-role';

      if (!isSelectRolePage) {
        // Redirect to role selection page from any other page
        return NextResponse.redirect(new URL('/auth/select-role', request.url));
      }

      // Allow access to the select-role page
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    // Determine paths based on role (at this point, role is client, coach, or admin)
    const dashboardPath = dashboardPaths.forRole(role);
    const onboardingPath = onboardingPaths.forRole(role);

    // 1. Handle profile completion state
    if (user.profileComplete) {
      // If profile is complete, they cannot access onboarding or auth pages.
      // Redirect them to their dashboard.
      if (isOnboardingPage || isAuthPage) {
        return NextResponse.redirect(new URL(dashboardPath, request.url));
      }
    } else {
      // If profile is NOT complete, they can ONLY access onboarding pages.
      // Redirect them to onboarding from dashboard, admin, or auth pages.
      if (isDashboardPage || isAdminPage || isAuthPage) {
        return NextResponse.redirect(new URL(onboardingPath, request.url));
      }
    }

    // 2. Handle role-based access for admin pages
    if (isAdminPage && role !== 'admin') {
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }

    // Allow request to proceed with user data in REQUEST headers
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // If user is NOT logged in
  // They can only access marketing and auth pages.
  // Protect all other routes.
  if (isDashboardPage || isAdminPage || isOnboardingPage) {
    return NextResponse.redirect(new URL(authPaths.signIn(), request.url));
  }

  return NextResponse.next();
}
