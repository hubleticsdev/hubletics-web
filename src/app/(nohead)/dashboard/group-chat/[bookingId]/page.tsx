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
      <div className="p-2 border-b border-gray-200 flex items-center justify-end md:hidden">
        <UserButton user={session.user} />
      </div>

      <GroupMessageThread
        conversationId={conversation.id}
        initialMessages={messages}
        currentUserId={session.user.id}
        participantCount={participants.length}
      />
    </div>
  );
}

