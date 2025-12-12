'use client';

import { useState } from 'react';
import { updateFlaggedMessage } from '@/actions/admin/flagged-messages';
import { flaggedMessageActionEnum } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Flag, User, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type FlaggedMessage = Awaited<ReturnType<typeof import('@/actions/admin/flagged-messages').getFlaggedMessages>>[number];

interface FlaggedMessagesClientProps {
  initialMessages: FlaggedMessage[];
}

const actionOptions = [
  { value: 'no_action', label: 'No Action', color: 'bg-gray-100 text-gray-800' },
  { value: 'warning_sent', label: 'Warning Sent', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'message_deleted', label: 'Message Deleted', color: 'bg-red-100 text-red-800' },
  { value: 'user_suspended', label: 'User Suspended', color: 'bg-orange-100 text-orange-800' },
  { value: 'user_banned', label: 'User Banned', color: 'bg-red-200 text-red-900' },
] as const;

export function FlaggedMessagesClient({ initialMessages }: FlaggedMessagesClientProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [selectedMessage, setSelectedMessage] = useState<FlaggedMessage | null>(null);
  const [action, setAction] = useState<typeof flaggedMessageActionEnum.enumValues[number] | ''>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleReviewMessage = async () => {
    if (!selectedMessage || !action) return;

    setProcessing(true);
    try {
      await updateFlaggedMessage({
        flaggedMessageId: selectedMessage.id,
        action: action as typeof flaggedMessageActionEnum.enumValues[number],
        adminNotes: adminNotes.trim() || undefined,
      });

      // Update the local state
      setMessages(prev =>
        prev.map(msg =>
          msg.id === selectedMessage.id
            ? {
                ...msg,
                action,
                reviewedAt: new Date(),
                adminNotes: adminNotes.trim() || null
              }
            : msg
        )
      );

      toast.success('Message reviewed successfully');
      setDialogOpen(false);
      setSelectedMessage(null);
      setAction('');
      setAdminNotes('');
    } catch {
      toast.error('Failed to update message');
    } finally {
      setProcessing(false);
    }
  };

  const openReviewDialog = (message: FlaggedMessage) => {
    setSelectedMessage(message);
    const validAction = message.action && flaggedMessageActionEnum.enumValues.includes(message.action as typeof flaggedMessageActionEnum.enumValues[number])
      ? message.action as typeof flaggedMessageActionEnum.enumValues[number]
      : 'no_action';
    setAction(validAction);
    setAdminNotes(message.adminNotes || '');
    setDialogOpen(true);
  };

  const getSeverityColor = (violations: string[]) => {
    if (violations.includes('phoneNumber') || violations.includes('email')) {
      return 'bg-red-100 text-red-800';
    }
    if (violations.includes('socialMedia') || violations.includes('urls')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  const pendingMessages = messages.filter(msg => !msg.reviewedAt);
  const reviewedMessages = messages.filter(msg => msg.reviewedAt);

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-gray-900">{pendingMessages.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reviewed</p>
              <p className="text-2xl font-bold text-gray-900">{reviewedMessages.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Flag className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Flagged</p>
              <p className="text-2xl font-bold text-gray-900">{messages.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Messages */}
      {pendingMessages.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Review</h2>
          <div className="space-y-4">
            {pendingMessages.map((msg) => (
              <div key={msg.id} className="bg-white border border-gray-200 rounded-lg border-l-4 border-l-red-500">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Flag className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {msg.messageType === 'group' ? 'Group ' : ''}Message from {(msg.messageType === 'regular' ? msg.message?.sender?.name : msg.groupMessage?.sender?.name) || 'Unknown User'}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Reported {new Date(msg.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => openReviewDialog(msg)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Review
                    </Button>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Flagged Content:</Label>
                      <div className="mt-1 p-3 bg-red-50 rounded-md border">
                        <p className="text-sm text-gray-900">{msg.content}</p>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Violations:</Label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {msg.violations.map((violation, index) => (
                          <span key={index} className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor([violation])}`}>
                            {violation}
                          </span>
                        ))}
                      </div>
                    </div>

                    {msg.adminNotes && (
                      <div>
                        <Label className="text-sm font-medium">User Report:</Label>
                        <p className="mt-1 text-sm text-gray-600">{msg.adminNotes}</p>
                      </div>
                    )}

                    <div className="flex items-center text-sm text-gray-500">
                      <User className="h-4 w-4 mr-1" />
                      {msg.messageType === 'group'
                        ? `Group with ${msg.groupConversation?.booking?.coach?.name || 'Coach'}`
                        : `${msg.conversation?.client?.name} ↔ ${msg.conversation?.coach?.name}`
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviewed Messages */}
      {reviewedMessages.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Reviewed Messages</h2>
          <div className="space-y-4">
            {reviewedMessages.map((msg) => (
              <div key={msg.id} className="bg-white border border-gray-200 rounded-lg opacity-75">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {msg.messageType === 'group' ? 'Group ' : ''}Message from {(msg.messageType === 'regular' ? msg.message?.sender?.name : msg.groupMessage?.sender?.name) || 'Unknown User'}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Reviewed {msg.reviewedAt ? new Date(msg.reviewedAt).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${actionOptions.find(opt => opt.value === msg.action)?.color || 'bg-gray-100 text-gray-800'}`}>
                      {actionOptions.find(opt => opt.value === msg.action)?.label || msg.action}
                    </span>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Flagged Content:</Label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md border">
                        <p className="text-sm text-gray-900">{msg.content}</p>
                      </div>
                    </div>

                    {msg.adminNotes && (
                      <div>
                        <Label className="text-sm font-medium">Admin Notes:</Label>
                        <p className="mt-1 text-sm text-gray-600">{msg.adminNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {messages.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No flagged messages</h3>
            <p className="text-gray-600">All messages are clean and safe.</p>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Flagged Message</DialogTitle>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium">Flagged Content:</Label>
                <div className="mt-1 p-3 bg-red-50 rounded-md border">
                  <p className="text-sm text-gray-900">{selectedMessage.content}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Violations:</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {selectedMessage.violations.map((violation, index) => (
                    <span key={index} className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor([violation])}`}>
                      {violation}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action">Action Taken:</Label>
                <select
                  id="action"
                  value={action}
                  onChange={(e) => setAction(e.target.value as typeof flaggedMessageActionEnum.enumValues[number])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select action</option>
                  {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Admin Notes:</Label>
                <Textarea
                  id="notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Optional notes about this review..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleReviewMessage}
                  disabled={!action || processing}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {processing ? 'Processing...' : 'Submit Review'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
