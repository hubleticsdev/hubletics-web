import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserButton } from '@/components/navigation/user-button';

export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4 bg-white flex-shrink-0">
        <Link
          href={session.user.role === 'coach' ? '/dashboard/coach' : '/dashboard/athlete'}
          className="text-[#FF6B4A] hover:text-[#FF8C5A] font-semibold flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Dashboard
        </Link>
        <UserButton user={session.user} />
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
