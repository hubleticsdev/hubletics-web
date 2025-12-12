'use client';

import { useState, useEffect, useRef } from 'react';
import { sendGroupMessage } from '@/actions/messages/group-conversations';
import { reportMessage } from '@/actions/messages/report-message';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Flag, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
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

  const handleReportMessage = async () => {
    if (!reportingMessageId || !reportReason.trim()) return;

    setReporting(true);
    try {
      await reportMessage({
        messageId: reportingMessageId,
        reason: reportReason.trim(),
      });
      toast.success('Message reported successfully');
      setReportingMessageId(null);
      setReportReason('');
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

                      <div className="relative group">
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isCurrentUser
                              ? 'bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white'
                              : message.flagged
                              ? 'bg-red-50 border border-red-200 text-gray-900'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          {message.flagged && (
                            <div className="flex items-center gap-1 mt-1">
                              <Flag className="w-3 h-3 text-red-500" />
                              <span className="text-xs text-red-600">Flagged</span>
                            </div>
                          )}
                        </div>

                        {/* Report button for other users' messages */}
                        {!isCurrentUser && !message.flagged && (
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
                placeholder="Please describe why you're reporting this message..."
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

