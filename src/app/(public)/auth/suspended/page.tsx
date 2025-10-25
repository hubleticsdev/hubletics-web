'use client';

import { signOut } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { publicPaths } from '@/lib/paths';

export default function SuspendedPage() {
  const handleSignOut = async () => {
    await signOut();
    window.location.href = publicPaths.home();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-10 w-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Account Suspended
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account has been suspended and you cannot access the platform at this time.
          </p>
        </div>

        <div className="mt-8 rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                What happened?
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Your account may have been suspended due to a violation of our Terms of Service,
                  suspicious activity, or an administrative action.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-center text-sm text-gray-600">
            If you believe this is a mistake or would like to appeal, please{' '}
            <Link href={publicPaths.contact()} className="text-blue-600 hover:text-blue-500">
              contact our support team
            </Link>
            .
          </p>

          <Button onClick={handleSignOut} variant="outline" className="w-full">
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
