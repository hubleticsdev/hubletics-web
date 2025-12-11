import { getConversationMessages, getUserConversations } from '@/actions/messages/conversations';
import { ConversationList } from '@/components/messages/conversation-list';
import { MessageThread } from '@/components/messages/message-thread';
import { getSession } from '@/lib/auth/session';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/auth/signin');
  }

  const { conversationId } = await params;
  const [conversations, messages] = await Promise.all([
    getUserConversations(),
    getConversationMessages(conversationId).catch(() => null),
  ]);

  if (!messages) {
    notFound();
  }

  const currentConversation = conversations.find((c) => c.id === conversationId);
  if (!currentConversation) {
    notFound();
  }

  return (
    <div className="flex h-full">
      <div className="hidden md:block w-96 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        </div>
        <ConversationList initialConversations={conversations} currentUserId={session.user.id} />
      </div>
  
      <div className="flex-1 flex flex-col bg-white">
        <div className="md:hidden p-2 border-b border-gray-200">
          <Link
            href="/dashboard/messages"
            className="inline-flex items-center gap-2 text-[#FF6B4A] hover:text-[#FF8C5A]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back
          </Link>
        </div>

        <MessageThread
          conversationId={conversationId}
          initialMessages={messages}
          currentUserId={session.user.id}
          otherParticipant={currentConversation.otherParticipant}
        />
      </div>
    </div>
  );
}
