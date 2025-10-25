import Link from 'next/link';
import { authPaths } from '@/lib/paths';

export function Navbar() {
  return (
    <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] bg-clip-text text-transparent">
              HUBLETICS
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={authPaths.signIn()}
              className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Log In
            </Link>
            <Link
              href={authPaths.signUp()}
              className="px-5 py-2 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-medium rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

