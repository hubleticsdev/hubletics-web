import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { dashboardPaths } from '@/lib/paths';
import { SignOutButton } from './SignOutButton';
import Image from 'next/image';
import type { UserRole } from '@/types/auth';

export async function AuthenticatedNavbar() {
  // This uses the optimized getSession() which reads from proxy headers!
  // No database queries needed since proxy already fetched the session
  const session = await getSession();

  // This should never happen (proxy already verified auth), but satisfy TypeScript
  if (!session) {
    return null;
  }

  const { user } = session;

  return (
    <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] bg-clip-text text-transparent">
              HUBLETICS
            </span>
          </Link>

          {/* User Info + Navigation */}
          <div className="flex items-center gap-4">
            {/* User Avatar & Name */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-red-100 border-2 border-orange-200 flex items-center justify-center">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || 'User'}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    className="w-5 h-5 text-orange-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-gray-700 font-medium hidden sm:inline">
                {user.name}
              </span>
            </div>

            {/* Dashboard Link */}
            <Link
              href={dashboardPaths.forRole(user.role as UserRole)}
              className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Dashboard
            </Link>

            {/* Sign Out Button */}
            <SignOutButton />
          </div>
        </div>
      </div>
    </nav>
  );
}

