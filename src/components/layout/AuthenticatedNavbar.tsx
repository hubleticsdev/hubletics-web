import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { UserButton } from '@/components/navigation/user-button';

export async function AuthenticatedNavbar() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { user } = session;

  return (
    <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] bg-clip-text text-transparent">
              HUBLETICS
            </span>
          </Link>

          <div className="flex items-center gap-6">
            {/* Quick nav links */}
            <nav className="hidden md:flex items-center gap-6">
              {user.role === 'client' && (
                <Link
                  href="/coaches"
                  className="text-gray-700 hover:text-[#FF6B4A] font-medium transition-colors text-sm"
                >
                  Find Coaches
                </Link>
              )}
              {user.role === 'coach' && (
                <Link
                  href="/dashboard/coach/athletes"
                  className="text-gray-700 hover:text-[#FF6B4A] font-medium transition-colors text-sm"
                >
                  Browse Athletes
                </Link>
              )}
              <Link
                href="/dashboard/bookings"
                className="text-gray-700 hover:text-[#FF6B4A] font-medium transition-colors text-sm"
              >
                Bookings
              </Link>
              <Link
                href="/dashboard/messages"
                className="text-gray-700 hover:text-[#FF6B4A] font-medium transition-colors text-sm relative"
              >
                Messages
              </Link>
            </nav>

            <UserButton user={user} />
          </div>
        </div>
      </div>
    </nav>
  );
}

