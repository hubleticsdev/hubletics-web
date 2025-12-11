import { getUserConversations, getOrCreateConversation } from '@/actions/messages/conversations';
import { ConversationList } from '@/components/messages/conversation-list';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/auth/signin');
  }

  const params = await searchParams;

  if (params.new) {
    const conversation = await getOrCreateConversation(params.new);
    redirect(`/dashboard/messages/${conversation.id}`);
  }

  const conversations = await getUserConversations();

  return (
    <div className="flex h-full">
      <div className="w-full md:w-96 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        </div>
        <ConversationList initialConversations={conversations} currentUserId={session.user.id} />
      </div>

      <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a conversation</h2>
          <p className="text-gray-600">
            Choose a conversation from the list to start messaging
          </p>
        </div>
      </div>
    </div>
  );
}
