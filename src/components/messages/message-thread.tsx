'use client';

import { useState, useEffect, useRef } from 'react';
import { usePusherEvent } from '@/lib/pusher/client';
import { sendMessage } from '@/actions/messages/conversations';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { toast } from 'sonner';

type Message = {
  id: string;
  content: string;
  createdAt: Date;
  senderId: string;
  sender: {
    id: string;
    name: string;
    image: string | null;
  };
};

interface MessageThreadProps {
  conversationId: string;
  initialMessages: Message[];
  currentUserId: string;
  otherParticipant: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: 'client' | 'coach' | 'admin' | 'pending';
  };
}

export function MessageThread({
  conversationId,
  initialMessages,
  currentUserId,
  otherParticipant,
}: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Listen for new messages in real-time
  usePusherEvent<Message>(`private-conversation-${conversationId}`, 'new-message', (message) => {
    setMessages((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    // Optimistic UI update - create temporary message
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      createdAt: new Date(),
      senderId: currentUserId,
      sender: {
        id: currentUserId,
        name: 'You',
        image: null,
      },
    };

    // Add message optimistically
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const serverMessage = await sendMessage(conversationId, messageContent);

      // Replace temp message with real one from server
      setMessages((prev) =>
        prev.map((m) => (m.id === tempMessage.id ? serverMessage : m))
      );
      // Pusher will also send the message, but duplicate check prevents double display
    } catch (error) {
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    const isToday = messageDate.toDateString() === today.toDateString();

    if (isToday) {
      return 'Today';
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

    // Deduplicate messages by ID (keep the most recent one)
    const deduplicatedMessages = messages.reduce((unique: Message[], message) => {
      const existingIndex = unique.findIndex((m) => m.id === message.id);
      if (existingIndex >= 0) {
        // Replace with the more complete message (prefer one with sender info)
        if (message.sender && message.sender.name && !unique[existingIndex].sender?.name) {
          unique[existingIndex] = message;
        }
      } else {
        unique.push(message);
      }
      return unique;
    }, []);
  
    // Group messages by date
    const groupedMessages = deduplicatedMessages.reduce((groups: Record<string, Message[]>, message) => {
    const dateKey = new Date(message.createdAt).toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200 bg-white">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
          <Image
            src={otherParticipant.image || '/placeholder-avatar.png'}
            alt={otherParticipant.name}
            width={40}
            height={40}
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">{otherParticipant.name}</h2>
          <p className="text-xs text-gray-500 capitalize">{otherParticipant.role}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 message-scroll">
        {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
          <div key={dateKey}>
            {/* Date separator */}
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                {formatDate(new Date(dateKey))}
              </div>
            </div>

            {/* Messages for this date */}
            <div className="space-y-3">
              {dateMessages.map((message) => {
                const isOwn = message.senderId === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                      {!isOwn && (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          <Image
                            src={message.sender.image || '/placeholder-avatar.png'}
                            alt={message.sender.name}
                            width={32}
                            height={32}
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isOwn
                              ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>
                        <p
                          className={`text-xs text-gray-500 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}
                        >
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-3 items-end">
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 min-h-[44px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:shadow-lg px-6"
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
