'use client';

import { signOut } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      router.push('/');
      router.refresh();
    } catch (error) {
      toast.error('Failed to sign out');
      console.error('Sign out error:', error);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className="px-5 py-2 bg-white text-gray-700 font-medium rounded-lg border-2 border-gray-200 hover:border-[#FF6B4A] hover:text-[#FF6B4A] transition-all duration-200"
    >
      Sign Out
    </button>
  );
}

