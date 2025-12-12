import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { conversation } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import { Pagination } from '@/components/ui/pagination';
import { getPaginationOptions, createPaginationResult, getOffset } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

interface AdminConversationsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminConversationsPage({ searchParams }: AdminConversationsPageProps) {
  await requireRole('admin');

  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string') {
      searchParamsObj.set(key, value);
    }
  });

  const { page, limit } = getPaginationOptions(searchParamsObj);
  const offset = getOffset(page, limit);

  const totalConversations = await db.$count(conversation);

  const conversations = await db.query.conversation.findMany({
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
      messages: {
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: 1,
      },
    },
    orderBy: [desc(conversation.lastMessageAt)],
    limit,
    offset,
  });

  const paginationResult = createPaginationResult(conversations, totalConversations, { page, limit });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Conversations</h1>
        <p className="text-gray-600 mt-2">View all conversations between clients and coaches</p>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600">No conversations yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200">
            {conversations.map((conv) => {
              const lastMessage = conv.messages[0];
              return (
                <div key={conv.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-6 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                            <Image
                              src={conv.client.image || '/placeholder-avatar.png'}
                              alt={conv.client.name}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{conv.client.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{conv.client.role}</p>
                          </div>
                        </div>

                        <div className="text-gray-400">⟷</div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                            <Image
                              src={conv.coach.image || '/placeholder-avatar.png'}
                              alt={conv.coach.name}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{conv.coach.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{conv.coach.role}</p>
                          </div>
                        </div>
                      </div>

                      {lastMessage && (
                        <div className="ml-13">
                          <p className="text-sm text-gray-700 line-clamp-2">{lastMessage.content}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(lastMessage.createdAt).toLocaleString()}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>Conversation ID: {conv.id.slice(0, 8)}...</span>
                        <span>Started: {new Date(conv.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <Link
                      href={`/admin/conversations/${conv.id}`}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                    >
                      View Messages
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Total Conversations:</span> {totalConversations}
        </p>
      </div>

      <Pagination
        pagination={paginationResult.pagination}
        baseUrl="/admin/conversations"
      />
    </div>
  );
}
