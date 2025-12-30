'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { sendGroupMessage } from '@/actions/messages/group-conversations';
import { reportMessage } from '@/actions/messages/report-message';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Flag, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { useAblyChannel, useTypingIndicator } from '@/lib/ably/client';

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
  flagged?: boolean;
  flaggedReason?: string | null;
};

interface GroupMessageThreadProps {
  conversationId: string;
  initialMessages: Message[];
  currentUserId: string;
}

export function GroupMessageThread({
  conversationId,
  initialMessages,
  currentUserId,
}: GroupMessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ably typing indicator hook for group chat
  const roomId = `private-group-conversation:${conversationId}`;
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(roomId, currentUserId);

  // Subscribe to new messages via Ably
  const handleNewMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }
      return [...prev, message].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  useAblyChannel<Message>(
    `private-group-conversation:${conversationId}`,
    'new-message',
    handleNewMessage,
    currentUserId
  );

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

  const handleReportMessage = async () => {
    if (!reportingMessageId || !reportReason.trim()) return;

    setReporting(true);
    try {
      const result = await reportMessage({
        messageId: reportingMessageId,
        reason: reportReason.trim(),
      });

      if (result.success) {
        toast.success('Message reported successfully');
        setReportingMessageId(null);
        setReportReason('');
      } else {
        toast.error(result.error || 'Failed to report message');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to report message');
    } finally {
      setReporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle typing indicator on input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);

    startTyping();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
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
      <div className="flex-1 overflow-y-auto p-4 space-y-6 message-scroll">
        {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
          <div key={dateKey}>
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                {formatDate(new Date(dateKey))}
              </div>
            </div>

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
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                          <Image
                            src={message.sender?.image || '/placeholder-avatar.png'}
                            alt={message.sender?.name || 'User'}
                            width={32}
                            height={32}
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="relative group">
                        <div
                          className={`rounded-2xl px-4 py-2 ${isOwn
                            ? 'bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] text-white'
                            : message.flagged
                              ? 'bg-red-50 border border-red-200 text-gray-900'
                              : 'bg-gray-100 text-gray-900'
                            }`}
                        >
                          {!isOwn && (
                            <p className="text-xs font-medium text-gray-700 mb-1">
                              {message.sender?.name || 'Unknown'}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap wrap-break-word">
                            {message.content}
                          </p>
                          {message.flagged && (
                            <div className="flex items-center gap-1 mt-1">
                              <Flag className="w-3 h-3 text-red-500" />
                              <span className="text-xs text-red-600">Flagged</span>
                            </div>
                          )}
                        </div>
                        <p
                          className={`text-xs text-gray-500 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}
                        >
                          {formatTime(message.createdAt)}
                        </p>

                        {!isOwn && !message.flagged && (
                          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 bg-white border shadow-sm hover:bg-gray-50"
                                >
                                  <MoreHorizontal className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => setReportingMessageId(message.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Flag className="w-4 h-4 mr-2" />
                                  Report Message
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
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

      <div className="p-4 border-t border-gray-200 bg-white">
        {/* Typing indicator for groups */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {typingUsers.length === 1
                ? 'Someone is typing...'
                : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}
        <div className="flex gap-3 items-end">
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none min-h-[60px] max-h-[120px]"
            rows={2}
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="bg-linear-to-r from-[#FF6B4A] to-[#FF8C5A] hover:opacity-90 shrink-0"
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>

      {/* Report Message Dialog */}
      <Dialog open={!!reportingMessageId} onOpenChange={(open) => !open && setReportingMessageId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason for reporting</Label>
              <Textarea
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Please describe why you&apos;re reporting this message..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setReportingMessageId(null);
                  setReportReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReportMessage}
                disabled={!reportReason.trim() || reporting}
                className="bg-red-600 hover:bg-red-700"
              >
                {reporting ? 'Reporting...' : 'Report Message'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

