'use server';

import { db } from '@/lib/db';
import { flaggedMessage, flaggedGroupMessage, message, groupMessage, adminAction } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { validateInput } from '@/lib/validations';

const updateFlaggedMessageSchema = z.object({
  flaggedMessageId: z.string().uuid(),
  action: z.enum(['no_action', 'warning_sent', 'message_deleted', 'user_suspended', 'user_banned']),
  adminNotes: z.string().optional(),
});

type UpdateFlaggedMessageInput = z.infer<typeof updateFlaggedMessageSchema>;

export async function getFlaggedMessages() {
  const session = await requireRole('admin');

  if (!session) {
    throw new Error('Unauthorized');
  }

  // Get regular flagged messages
  const regularFlaggedMessages = await db.query.flaggedMessage.findMany({
    with: {
      message: {
        with: {
          sender: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
      conversation: {
        columns: {
          id: true,
        },
        with: {
          client: {
            columns: {
              id: true,
              name: true,
            },
          },
          coach: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      reviewer: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: desc(flaggedMessage.createdAt),
  });

  // Get flagged group messages
  const groupFlaggedMessages = await db.query.flaggedGroupMessage.findMany({
    with: {
      groupMessage: {
        with: {
          sender: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
      groupConversation: {
        columns: {
          id: true,
        },
        with: {
          booking: {
            with: {
              coach: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      reviewer: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: desc(flaggedGroupMessage.createdAt),
  });

  // Transform group messages to match the expected interface
  const transformedGroupMessages = groupFlaggedMessages.map(msg => ({
    id: msg.id,
    messageId: null,
    groupMessageId: msg.groupMessageId,
    messageType: 'group' as const,
    conversationId: null,
    groupConversationId: msg.groupConversationId,
    senderId: msg.senderId,
    content: msg.content,
    violations: msg.violations,
    reviewedAt: msg.reviewedAt,
    reviewedBy: msg.reviewedBy,
    action: msg.action,
    adminNotes: msg.adminNotes,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
    message: null,
    groupMessage: msg.groupMessage,
    conversation: null,
    groupConversation: msg.groupConversation,
    sender: msg.groupMessage?.sender || null,
    reviewer: msg.reviewer,
  }));

  const allFlaggedMessages = [
    ...regularFlaggedMessages.map(msg => ({ ...msg, messageType: 'regular' as const })),
    ...transformedGroupMessages,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return allFlaggedMessages;
}

export async function updateFlaggedMessage(input: UpdateFlaggedMessageInput) {
  const session = await requireRole('admin');

  const validated = validateInput(updateFlaggedMessageSchema, input);

  // Determine if this is a regular flagged message or group flagged message
  const regularFlaggedMsg = await db.query.flaggedMessage.findFirst({
    where: eq(flaggedMessage.id, validated.flaggedMessageId),
  });

  if (regularFlaggedMsg) {
    // Update regular flagged message
    await db
      .update(flaggedMessage)
      .set({
        action: validated.action,
        adminNotes: validated.adminNotes,
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(flaggedMessage.id, validated.flaggedMessageId));

    // Delete the message if requested
    if (validated.action === 'message_deleted') {
      await db
        .update(message)
        .set({
          content: '[Message deleted by admin]',
          flagged: true,
          flaggedReason: 'admin_deleted',
        })
        .where(eq(message.id, regularFlaggedMsg.messageId));
    }
  } else {
    const groupFlaggedMsg = await db.query.flaggedGroupMessage.findFirst({
      where: eq(flaggedGroupMessage.id, validated.flaggedMessageId),
    });

    if (groupFlaggedMsg) {
      await db
        .update(flaggedGroupMessage)
        .set({
          action: validated.action,
          adminNotes: validated.adminNotes,
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(flaggedGroupMessage.id, validated.flaggedMessageId));

      if (validated.action === 'message_deleted') {
        await db
          .update(groupMessage)
          .set({
            content: '[Message deleted by admin]',
            flagged: true,
            flaggedReason: 'admin_deleted',
          })
          .where(eq(groupMessage.id, groupFlaggedMsg.groupMessageId));
      }
    } else {
      throw new Error('Flagged message not found');
    }
  }

  await db.insert(adminAction).values({
    adminId: session.user.id,
    action: 'reviewed_message',
    relatedEntityId: validated.flaggedMessageId,
    notes: `Reviewed flagged message: ${validated.action}${validated.adminNotes ? ` - ${validated.adminNotes}` : ''}`,
  });

  console.log(`[ADMIN] Flagged message ${validated.flaggedMessageId} reviewed by ${session.user.id}: ${validated.action}`);

  return { success: true };
}
