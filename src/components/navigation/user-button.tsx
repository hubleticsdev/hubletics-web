'use client';

import { type User as UserType } from '@/lib/auth';
import { signOut } from '@/lib/auth/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import {
  LayoutDashboard,
  CalendarClock,
  MessageCircle,
  DollarSign,
  User,
  Settings,
  LogOut,
  Users,
  Clock,
  FileText,
  Shield,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface UserButtonProps {
  user: UserType;
}

export function UserButton({ user }: UserButtonProps) {
  const router = useRouter();

  const isCoach = user.role === 'coach';
  const isAthlete = user.role === 'client';
  const isAdmin = user.role === 'admin';

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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B4A] focus-visible:ring-offset-2 rounded-full">
          <Avatar className="h-9 w-9 ring-2 ring-[#FF6B4A]/20 ring-offset-2 ring-offset-white transition-all duration-300 hover:ring-[#FF6B4A]/50 hover:ring-offset-4 cursor-pointer">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name || ''} />
            ) : (
              <AvatarFallback className="bg-gradient-to-br from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            )}
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-6" align="end">
        <div className="mb-4 p-4 flex flex-col items-center gap-1 rounded-lg bg-gradient-to-br from-[#FF6B4A]/10 to-[#FF8C5A]/10 transition-all duration-300 hover:from-[#FF6B4A]/20 hover:to-[#FF8C5A]/20">
          {user.image && (
            <Image
              src={user.image}
              alt={user.name || ''}
              width={40}
              height={40}
              className="rounded-full ring-2 ring-[#FF6B4A]/50"
            />
          )}
          <p className="font-bold text-sm text-center mt-1">{user.name}</p>
          <span className="text-xs text-gray-600">{user.email}</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#FF6B4A]/20 text-[#FF6B4A] mt-1">
            {isCoach ? '🎯 Coach' : isAthlete ? '⚡ Athlete' : '👑 Admin'}
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push(isCoach ? '/dashboard/coach' : isAthlete ? '/dashboard/athlete' : '/admin/dashboard')}
          className="group py-2 font-medium cursor-pointer"
        >
          <LayoutDashboard
            size={14}
            className="mr-3 transition-all duration-300 ease-in-out group-hover:text-[#FF6B4A] group-hover:scale-110"
          />
          Dashboard
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push('/dashboard/bookings')}
          className="group py-2 font-medium cursor-pointer"
        >
          <CalendarClock
            size={14}
            className="mr-3 transition-all duration-300 ease-in-out group-hover:text-[#FF6B4A] group-hover:rotate-12"
          />
          Bookings
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push('/dashboard/messages')}
          className="group py-2 font-medium cursor-pointer"
        >
          <MessageCircle
            size={14}
            className="mr-3 transition-all duration-300 ease-in-out group-hover:text-[#FF6B4A] group-hover:translate-x-1"
          />
          Messages
        </DropdownMenuItem>

        {isCoach && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-gray-500">Coach Tools</DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => router.push('/dashboard/earnings')}
              className="group py-2 font-medium cursor-pointer"
            >
              <DollarSign
                size={14}
                className="mr-3 transition-all duration-300 ease-in-out group-hover:text-green-500 group-hover:scale-110"
              />
              Earnings
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push('/dashboard/availability')}
              className="group py-2 font-medium cursor-pointer"
            >
              <Clock
                size={14}
                className="mr-3 transition-all duration-300 ease-in-out group-hover:text-[#FF6B4A] group-hover:rotate-90"
              />
              Availability
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push('/dashboard/coach/athletes')}
              className="group py-2 font-medium cursor-pointer"
            >
              <Users
                size={14}
                className="mr-3 transition-all duration-300 ease-in-out group-hover:text-[#FF6B4A] group-hover:translate-y-[-2px]"
              />
              Browse Athletes
            </DropdownMenuItem>
          </>
        )}

        {isAthlete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-gray-500">Athlete Tools</DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => router.push('/coaches')}
              className="group py-2 font-medium cursor-pointer"
            >
              <Users
                size={14}
                className="mr-3 transition-all duration-300 ease-in-out group-hover:text-[#FF6B4A] group-hover:translate-y-[-2px]"
              />
              Find Coaches
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push(`/athletes/${user.id}`)}
              className="group py-2 font-medium cursor-pointer"
            >
              <FileText
                size={14}
                className="mr-3 transition-all duration-300 ease-in-out group-hover:text-[#FF6B4A] group-hover:scale-110"
              />
              View My Profile
            </DropdownMenuItem>
          </>
        )}

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-gray-500">Admin Tools</DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => router.push('/admin/dashboard')}
              className="group py-2 font-medium cursor-pointer"
            >
              <Shield
                size={14}
                className="mr-3 transition-all duration-300 ease-in-out group-hover:text-[#FF6B4A] group-hover:rotate-12"
              />
              Admin Panel
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push('/dashboard/profile')}
          className="group py-2 font-medium cursor-pointer"
        >
          <Settings
            size={14}
            className="mr-3 transition-all duration-300 ease-in-out group-hover:text-[#FF6B4A] group-hover:rotate-90"
          />
          Profile Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="group focus:bg-red-50 py-2 font-medium cursor-pointer"
        >
          <LogOut
            size={14}
            className="mr-3 transition-all duration-300 ease-in-out group-hover:text-red-500 group-hover:-translate-x-1"
          />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

