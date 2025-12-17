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

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200 flex items-start justify-between">
        <div className="flex-1">
          <Link
            href="/dashboard/bookings"
            className="inline-flex items-center gap-2 text-[#FF6B4A] hover:text-[#FF8C5A] mb-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Bookings
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Group Chat</h1>
          <p className="text-sm text-gray-600">
            Coach: {bookingRecord.coach?.name || 'Unknown'} • {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <UserButton user={session.user} />
      </div>

      <GroupMessageThread
        conversationId={conversation.id}
        initialMessages={messages}
        currentUserId={session.user.id}
      />
    </div>
  );
}

