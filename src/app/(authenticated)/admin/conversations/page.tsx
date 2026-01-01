import { requireRole } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { conversation, message } from '@/lib/db/schema';
import { desc, ilike, or, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';
import { Pagination } from '@/components/ui/pagination';
import { getPaginationOptions, createPaginationResult, getOffset } from '@/lib/pagination';
import { MessageCircle, Search, Clock, ArrowUpDown } from 'lucide-react';

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
  const searchQuery = searchParamsObj.get('search') || '';
  const sortBy = searchParamsObj.get('sort') || 'recent';

  // Build base query conditions
  const whereConditions = searchQuery
    ? or(
      ilike(conversation.clientId, `%${searchQuery}%`),
      ilike(conversation.coachId, `%${searchQuery}%`)
    )
    : undefined;

  const totalConversations = await db.$count(conversation, whereConditions);

  const conversations = await db.query.conversation.findMany({
    where: whereConditions,
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
      messages: true,
    },
    orderBy: sortBy === 'oldest'
      ? [conversation.lastMessageAt]
      : [desc(conversation.lastMessageAt)],
    limit,
    offset,
  });

  // Enrich with message count and last activity
  const enrichedConversations = conversations.map(conv => {
    const messageCount = conv.messages.length;
    const lastMessage = conv.messages.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const daysSinceLastMessage = lastMessage
      ? Math.floor((Date.now() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...conv,
      messageCount,
      lastMessage,
      daysSinceLastMessage,
      isActive: daysSinceLastMessage !== null && daysSinceLastMessage < 7,
    };
  });

  const paginationResult = createPaginationResult(enrichedConversations, totalConversations, { page, limit });

  const getActivityBadge = (days: number | null) => {
    if (days === null) return { text: 'No messages', color: 'bg-gray-100 text-gray-600' };
    if (days === 0) return { text: 'Today', color: 'bg-green-100 text-green-700' };
    if (days === 1) return { text: 'Yesterday', color: 'bg-green-100 text-green-700' };
    if (days < 7) return { text: `${days}d ago`, color: 'bg-blue-100 text-blue-700' };
    if (days < 30) return { text: `${Math.floor(days / 7)}w ago`, color: 'bg-orange-100 text-orange-700' };
    return { text: `${Math.floor(days / 30)}mo ago`, color: 'bg-gray-100 text-gray-600' };
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Conversations</h1>
          <p className="text-gray-600 mt-2">{totalConversations} conversations total</p>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <form method="GET" className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              name="search"
              placeholder="Search by name..."
              defaultValue={searchQuery}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
            <input type="hidden" name="sort" value={sortBy} />
          </form>

          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <Link
              href={`/admin/conversations?sort=recent${searchQuery ? `&search=${searchQuery}` : ''}`}
              className={`px-3 py-2 text-sm font-medium ${sortBy === 'recent' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Recent
            </Link>
            <Link
              href={`/admin/conversations?sort=oldest${searchQuery ? `&search=${searchQuery}` : ''}`}
              className={`px-3 py-2 text-sm font-medium border-l ${sortBy === 'oldest' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Oldest
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Conversations</p>
            <p className="text-2xl font-bold text-gray-900">{totalConversations}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Clock className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Active (Last 7 days)</p>
            <p className="text-2xl font-bold text-gray-900">
              {enrichedConversations.filter(c => c.isActive).length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <ArrowUpDown className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Showing</p>
            <p className="text-2xl font-bold text-gray-900">{enrichedConversations.length}</p>
          </div>
        </div>
      </div>

      {enrichedConversations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchQuery ? `No conversations matching "${searchQuery}"` : 'No conversations yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200">
            {enrichedConversations.map((conv) => {
              const activityBadge = getActivityBadge(conv.daysSinceLastMessage);
              return (
                <div key={conv.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-6 mb-3">
                        {/* Client */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 ring-2 ring-offset-2 ring-blue-200">
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
                            <p className="text-xs text-gray-500">{conv.client.email}</p>
                          </div>
                        </div>

                        <div className="text-gray-400 font-bold">⟷</div>

                        {/* Coach */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 ring-2 ring-offset-2 ring-orange-200">
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
                            <p className="text-xs text-gray-500">{conv.coach.email}</p>
                          </div>
                        </div>
                      </div>

                      {conv.lastMessage && (
                        <div className="ml-13 bg-gray-50 rounded-lg p-3 mb-3">
                          <p className="text-sm text-gray-700 line-clamp-2">{conv.lastMessage.content}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs">
                        <span className={`px-2 py-1 rounded-full font-medium ${activityBadge.color}`}>
                          {activityBadge.text}
                        </span>
                        <span className="text-gray-500 flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {conv.messageCount} messages
                        </span>
                        <span className="text-gray-400">
                          Started {new Date(conv.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/admin/conversations/${conv.id}`}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all text-sm font-medium shadow-sm"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Pagination
        pagination={paginationResult.pagination}
        baseUrl="/admin/conversations"
      />
    </div>
  );
}
