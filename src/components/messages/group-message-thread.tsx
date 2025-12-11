'use client';

import { useState, useEffect, useRef } from 'react';
import { sendGroupMessage } from '@/actions/messages/group-conversations';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { User } from 'lucide-react';

type Message = {
  id: string;
  content: string;
  createdAt: Date;
  senderId: string | null;
  sender: {
    id: string;
    name: string;
    image: string | null;
  } | null;
};

type Participant = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: 'client' | 'coach' | 'admin' | 'pending';
};

interface GroupMessageThreadProps {
  conversationId: string;
  initialMessages: Message[];
  currentUserId: string;
  participants: Participant[];
}

export function GroupMessageThread({
  conversationId,
  initialMessages,
  currentUserId,
  participants,
}: GroupMessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

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

    setMessages((prev) => [...prev, tempMessage]);

    try {
      const serverMessage = await sendGroupMessage(conversationId, messageContent);

      setMessages((prev) =>
        prev.map((m) => (m.id === tempMessage.id ? serverMessage : m))
      );
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      setNewMessage(messageContent);
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

  const deduplicatedMessages = messages.reduce((unique: Message[], message) => {
    const existingIndex = unique.findIndex((m) => m.id === message.id);
    if (existingIndex >= 0) {
      if (message.sender && message.sender.name && !unique[existingIndex].sender?.name) {
        unique[existingIndex] = message;
      }
    } else {
      unique.push(message);
    }
    return unique;
  }, []);

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
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
          <div key={dateKey}>
            <div className="flex items-center justify-center my-4">
              <span className="bg-gray-200 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                {formatDate(new Date(dateKey))}
              </span>
            </div>

            <div className="space-y-4">
              {dateMessages.map((message) => {
                const isCurrentUser = message.senderId === currentUserId;

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {message.sender?.image ? (
                        <img
                          src={message.sender.image}
                          alt={message.sender.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-gray-400" />
                      )}
                    </div>

                    <div className={`flex flex-col max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-700">
                          {isCurrentUser ? 'You' : message.sender?.name || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isCurrentUser
                            ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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

      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none"
            rows={2}
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90 self-end"
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

