'use client';

import { useAblyChannel } from '@/lib/ably/client';
import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Conversation = {
  id: string;
  otherParticipant: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  lastMessage: {
    content: string;
    createdAt: Date;
    senderId: string | null;
  } | null;
  lastMessageAt: Date | null;
};

interface ConversationListProps {
  initialConversations: Conversation[];
  currentUserId: string;
}

export function ConversationList({ initialConversations, currentUserId }: ConversationListProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const pathname = usePathname();

  const handleConversationUpdate = useCallback((updatedConv: Conversation) => {
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === updatedConv.id);
      if (exists) {
        return prev
          .map((c) => (c.id === updatedConv.id ? { ...c, ...updatedConv } : c))
          .sort((a, b) => {
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return bTime - aTime;
          });
      } else {
        return [updatedConv, ...prev];
      }
    });
  }, []);

  useAblyChannel<Conversation>(
    `user:${currentUserId}`,
    'conversation-update',
    handleConversationUpdate,
    currentUserId
  );

  const formatTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInMs = now.getTime() - messageDate.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
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
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Messages Yet</h3>
        <p className="text-sm text-gray-600">
          Start a conversation with a coach or athlete to get started
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conv) => {
        const isActive = pathname === `/messages/${conv.id}`;
        const displayImage = conv.otherParticipant.image || '/placeholder-avatar.png';
        const lastMessagePreview = conv.lastMessage
          ? conv.lastMessage.content.slice(0, 60) + (conv.lastMessage.content.length > 60 ? '...' : '')
          : 'No messages yet';
        const isOwnMessage = conv.lastMessage?.senderId === currentUserId;

        return (
          <Link
            key={conv.id}
            href={`/dashboard/messages/${conv.id}`}
            className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${isActive ? 'bg-orange-50 border-l-4 border-[#FF6B4A]' : ''
              }`}
          >
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                <Image
                  src={displayImage}
                  alt={conv.otherParticipant.name}
                  width={48}
                  height={48}
                  className="object-cover"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {conv.otherParticipant.name}
                </h3>
                {conv.lastMessageAt && (
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {formatTime(conv.lastMessageAt)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 truncate">
                {isOwnMessage && <span className="text-gray-500">You: </span>}
                {lastMessagePreview}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
