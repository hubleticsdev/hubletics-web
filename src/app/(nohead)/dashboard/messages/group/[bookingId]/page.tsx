import { getOrCreateGroupConversation, getGroupConversationMessages, getGroupConversationParticipants } from '@/actions/messages/group-conversations';
import { getUserConversations } from '@/actions/messages/conversations';
import { ConversationList } from '@/components/messages/conversation-list';
import { GroupMessageThread } from '@/components/messages/group-message-thread';
import { getSession } from '@/lib/auth/session';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { booking } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Users } from 'lucide-react';

export default async function GroupChatWithSidebarPage({
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

    const [conversations, conversation] = await Promise.all([
        getUserConversations(),
        getOrCreateGroupConversation(bookingId),
    ]);

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
    const displayName = `${bookingRecord.coach?.name || 'Group'} - ${formattedDate}`;

    return (
        <div className="flex h-dvh">
            {/* Sidebar - hidden on mobile, visible on desktop */}
            <div className="hidden md:block w-96 border-r border-gray-200 bg-white overflow-y-auto flex-shrink-0">
                <div className="p-4 border-b border-gray-200">
                    <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                </div>
                <ConversationList
                    initialConversations={conversations}
                    currentUserId={session.user.id}
                />
            </div>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col bg-white min-w-0">
                {/* Header with group info */}
                <div className="border-b border-gray-200 bg-white flex-shrink-0">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* Mobile back button */}
                            <Link
                                href="/dashboard/messages"
                                className="md:hidden inline-flex items-center text-[#FF6B4A] hover:text-[#FF8C5A]"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                            </Link>

                            {/* Group icon */}
                            <div className="w-10 h-10 bg-gradient-to-br from-[#FF6B4A] to-[#FF8C5A] rounded-full flex items-center justify-center flex-shrink-0">
                                <Users className="w-5 h-5 text-white" />
                            </div>

                            <div className="min-w-0">
                                <h2 className="font-semibold text-gray-900 truncate">{displayName}</h2>
                                <p className="text-sm text-gray-500">{participants.length} participants • {formattedTime}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Message thread */}
                <GroupMessageThread
                    conversationId={conversation.id}
                    initialMessages={messages}
                    currentUserId={session.user.id}
                />
            </div>
        </div>
    );
}
