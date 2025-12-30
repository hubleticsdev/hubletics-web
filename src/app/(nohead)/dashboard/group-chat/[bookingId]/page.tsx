import { getOrCreateGroupConversation, getGroupConversationMessages, getGroupConversationParticipants } from '@/actions/messages/group-conversations';
import { GroupMessageThread } from '@/components/messages/group-message-thread';
import { getSession } from '@/lib/auth/session';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { UserButton } from '@/components/navigation/user-button';

export default async function GroupChatPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/auth/signin');
  }

  const { bookingId } = await params;

  // Get booking details
  const bookingRecord = await db.query.booking.findFirst({
    where: eq(booking.id, bookingId),
    columns: {
      scheduledStartAt: true,
      bookingType: true,
    },
    with: {
      coach: {
        columns: {
          name: true,
        },
      },
    },
  });

  if (!bookingRecord || (bookingRecord.bookingType !== 'private_group' && bookingRecord.bookingType !== 'public_group')) {
    notFound();
  }

  const conversation = await getOrCreateGroupConversation(bookingId);
  const [messages, participants] = await Promise.all([
    getGroupConversationMessages(conversation.id),
    getGroupConversationParticipants(conversation.id),
  ]);

  const sessionDate = new Date(bookingRecord.scheduledStartAt);
  const formattedDate = sessionDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = sessionDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const displayName = `Group: ${bookingRecord.coach?.name || 'Unknown'} - ${formattedDate} @ ${formattedTime}`;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Desktop header with navigation */}
      <div className="hidden md:flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4 flex-1">
          <Link
            href="/dashboard/messages"
            className="inline-flex items-center gap-2 text-[#FF6B4A] hover:text-[#FF8C5A] transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">{displayName}</h1>
            <p className="text-sm text-gray-500">{participants.length} participants</p>
          </div>
        </div>
        <UserButton user={session.user} />
      </div>

      {/* Mobile header */}
      <div className="md:hidden border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between p-2">
          <Link
            href="/dashboard/messages"
            className="inline-flex items-center gap-2 text-[#FF6B4A] hover:text-[#FF8C5A]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </Link>
          <UserButton user={session.user} />
        </div>
        <div className="px-4 pb-3">
          <h1 className="font-semibold text-gray-900 text-sm">{displayName}</h1>
          <p className="text-xs text-gray-500">{participants.length} participants</p>
        </div>
      </div>

      <GroupMessageThread
        conversationId={conversation.id}
        initialMessages={messages}
        currentUserId={session.user.id}
      />
    </div>
  );
}

