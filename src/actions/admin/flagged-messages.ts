'use server';

import { db } from '@/lib/db';
import { flaggedMessage, message, groupMessage, user, adminAction } from '@/lib/db/schema';
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

  const flaggedMessages = await db.query.flaggedMessage.findMany({
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
    orderBy: desc(flaggedMessage.createdAt),
  });

  return flaggedMessages;
}

export async function updateFlaggedMessage(input: UpdateFlaggedMessageInput) {
  const session = await requireRole('admin');

  const validated = validateInput(updateFlaggedMessageSchema, input);

  // Update the flagged message
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

  await db.insert(adminAction).values({
    adminId: session.user.id,
    action: 'reviewed_message',
    relatedEntityId: validated.flaggedMessageId,
    notes: `Reviewed flagged message: ${validated.action}${validated.adminNotes ? ` - ${validated.adminNotes}` : ''}`,
  });

  if (validated.action === 'message_deleted') {
    const flaggedMsg = await db.query.flaggedMessage.findFirst({
      where: eq(flaggedMessage.id, validated.flaggedMessageId),
      with: {
        message: true,
        groupMessage: true,
      },
    });

    if (flaggedMsg) {
      if (flaggedMsg.messageId) {
        await db
          .update(message)
          .set({
            content: '[Message deleted by admin]',
            flagged: true,
            flaggedReason: 'admin_deleted',
          })
          .where(eq(message.id, flaggedMsg.messageId));
      } else if (flaggedMsg.groupMessageId) {
        await db
          .update(groupMessage)
          .set({
            content: '[Message deleted by admin]',
            flagged: true,
            flaggedReason: 'admin_deleted',
          })
          .where(eq(groupMessage.id, flaggedMsg.groupMessageId));
      }
    }
  }

  console.log(`[ADMIN] Flagged message ${validated.flaggedMessageId} reviewed by ${session.user.id}: ${validated.action}`);

  return { success: true };
}
