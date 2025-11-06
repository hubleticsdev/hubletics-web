import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { conversation, message } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function AdminConversationViewPage({ params }: PageProps) {
  await requireRole('admin');

  const { conversationId } = await params;

  // Get conversation with participants
  const conv = await db.query.conversation.findFirst({
    where: eq(conversation.id, conversationId),
    with: {
      client: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      },
      coach: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      },
    },
  });

  if (!conv) {
    notFound();
  }

  // Get all messages in this conversation
  const messages = await db.query.message.findMany({
    where: eq(message.conversationId, conversationId),
    with: {
      sender: {
        columns: {
          id: true,
          name: true,
          image: true,
          role: true,
        },
      },
    },
    orderBy: [desc(message.createdAt)],
  });

  // Reverse to show oldest first (chronological order)
  const chronologicalMessages = [...messages].reverse();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/conversations"
          className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Conversations
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">Conversation Details</h1>
        <p className="text-gray-600 mt-2">Read-only view for admin monitoring</p>
      </div>

      {/* Participants */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Participants</h2>
        <div className="flex items-center gap-8">
          {/* Client */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
              <Image
                src={conv.client.image || '/placeholder-avatar.png'}
                alt={conv.client.name}
                width={48}
                height={48}
                className="object-cover"
              />
            </div>
            <div>
              <p className="font-medium text-gray-900">{conv.client.name}</p>
              <p className="text-sm text-gray-500">{conv.client.email}</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                {conv.client.role}
              </span>
            </div>
          </div>

          {/* Separator */}
          <div className="text-2xl text-gray-400">⟷</div>

          {/* Coach */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
              <Image
                src={conv.coach.image || '/placeholder-avatar.png'}
                alt={conv.coach.name}
                width={48}
                height={48}
                className="object-cover"
              />
            </div>
            <div>
              <p className="font-medium text-gray-900">{conv.coach.name}</p>
              <p className="text-sm text-gray-500">{conv.coach.email}</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                {conv.coach.role}
              </span>
            </div>
          </div>
        </div>

        {/* Conversation Meta */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span>
              <span className="font-medium">Conversation ID:</span> {conv.id}
            </span>
            <span>
              <span className="font-medium">Started:</span>{' '}
              {new Date(conv.createdAt).toLocaleString()}
            </span>
            <span>
              <span className="font-medium">Last Message:</span>{' '}
              {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Message History ({messages.length} messages)
          </h2>
        </div>

        {messages.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p>No messages in this conversation yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {chronologicalMessages.map((msg) => {
              const isClient = msg.sender.id === conv.clientId;
              return (
                <div
                  key={msg.id}
                  className={`p-6 ${msg.flagged ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Sender Avatar */}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                      <Image
                        src={msg.sender.image || '/placeholder-avatar.png'}
                        alt={msg.sender.name}
                        width={40}
                        height={40}
                        className="object-cover"
                      />
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-gray-900">{msg.sender.name}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isClient ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {msg.sender.role}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                        {msg.readAt && (
                          <span className="text-xs text-green-600">
                            ✓ Read {new Date(msg.readAt).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>

                      {/* Flagged indicator */}
                      {msg.flagged && (
                        <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <svg
                              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-900">Flagged Message</p>
                              {msg.flaggedReason && (
                                <p className="text-sm text-red-700 mt-1">
                                  Reason: {msg.flaggedReason}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Note */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-900">Read-Only Mode</p>
            <p className="text-sm text-yellow-700 mt-1">
              This is an admin view for monitoring purposes. Messages are displayed directly from
              the database without real-time updates. Users cannot see that you are viewing this
              conversation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
