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

  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    (pathname.includes('.') && !pathname.endsWith('.html'))
  ) {
    return NextResponse.next();
  }

  const isAuthPage = pathChecks.isAuth(pathname);
  const isDashboardPage = pathChecks.isDashboard(pathname);
  const isAdminPage = pathChecks.isAdmin(pathname);
  const isOnboardingPage = pathChecks.isOnboarding(pathname);
  const isHomePage = pathname === '/';
  
  if (isHomePage) {
    return NextResponse.next();
  }
  
  const session = await auth.api.getSession({
    headers: request.headers,
  });

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
    requestHeaders.set('x-user-username', user.username || '');
    requestHeaders.set('x-user-image', user.image || '');
    requestHeaders.set('x-user-profile-complete', user.profileComplete ? 'true' : 'false');
    requestHeaders.set('x-user-status', status);
    requestHeaders.set('x-user-timezone', user.timezone || 'America/Chicago');

    if (status !== 'active') {
      await auth.api.signOut({
        headers: request.headers,
      });

      const suspendedResponse = NextResponse.redirect(new URL(authPaths.suspended(), request.url));
      suspendedResponse.cookies.delete('better-auth.session_token');
      return suspendedResponse;
    }

    if (role === 'pending') {
      const isSelectRolePage = pathname === '/auth/select-role';

      if (!isSelectRolePage) {
        return NextResponse.redirect(new URL('/auth/select-role', request.url));
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    const dashboardPath = dashboardPaths.forRole(role);
    const onboardingPath = onboardingPaths.forRole(role);

    if (user.profileComplete) {
      if (isOnboardingPage || isAuthPage) {
        return NextResponse.redirect(new URL(dashboardPath, request.url));
      }
    } else {
      if (isDashboardPage || isAdminPage || isAuthPage) {
        return NextResponse.redirect(new URL(onboardingPath, request.url));
      }
    }

    if (isAdminPage && role !== 'admin') {
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (isDashboardPage || isAdminPage || isOnboardingPage) {
    return NextResponse.redirect(new URL(authPaths.signIn(), request.url));
  }

  return NextResponse.next();
}
