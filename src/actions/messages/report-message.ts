'use server';

import { db } from '@/lib/db';
import { flaggedMessage, flaggedGroupMessage, message, groupMessage, groupConversationParticipant } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { validateInput } from '@/lib/validations';

const reportMessageSchema = z.object({
  messageId: z.string().uuid(),
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)').max(500),
});

type ReportMessageInput = z.infer<typeof reportMessageSchema>;

export async function reportMessage(input: ReportMessageInput) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const validated = validateInput(reportMessageSchema, input);

  // First try to find as a regular message
  const regularMessageData = await db.query.message.findFirst({
    where: eq(message.id, validated.messageId),
    with: {
      conversation: true,
    },
  });

  if (regularMessageData) {
    const isParticipant =
      regularMessageData.conversation.clientId === session.user.id ||
      regularMessageData.conversation.coachId === session.user.id;

    if (!isParticipant) {
      throw new Error('Unauthorized to report this message');
    }

    const existingReport = await db.query.flaggedMessage.findFirst({
      where: eq(flaggedMessage.messageId, validated.messageId),
    });

    if (existingReport) {
      return { success: false, error: 'This message has already been reported' };
    }

    await db.insert(flaggedMessage).values({
      messageId: validated.messageId,
      conversationId: regularMessageData.conversation.id,
      senderId: regularMessageData.senderId!,
      content: regularMessageData.content,
      violations: ['user_report'],
      adminNotes: `User report: ${validated.reason}`,
    });

    await db
      .update(message)
      .set({
        flagged: true,
        flaggedReason: 'user_report',
      })
      .where(eq(message.id, validated.messageId));

    return { success: true };
  }

  const groupMessageData = await db.query.groupMessage.findFirst({
    where: eq(groupMessage.id, validated.messageId),
    with: {
      conversation: true,
    },
  });

  if (groupMessageData) {
    const isParticipant = await db.query.groupConversationParticipant.findFirst({
      where: and(
        eq(groupConversationParticipant.conversationId, groupMessageData.conversationId),
        eq(groupConversationParticipant.userId, session.user.id)
      ),
    });

    if (!isParticipant) {
      throw new Error('Unauthorized to report this message');
    }

    const existingReport = await db.query.flaggedGroupMessage.findFirst({
      where: eq(flaggedGroupMessage.groupMessageId, validated.messageId),
    });

    if (existingReport) {
      return { success: false, error: 'This message has already been reported' };
    }

    if (!groupMessageData.senderId) {
      return { success: false, error: 'Cannot report message from deleted user' };
    }

    await db.insert(flaggedGroupMessage).values({
      groupMessageId: validated.messageId,
      groupConversationId: groupMessageData.conversationId,
      senderId: groupMessageData.senderId,
      content: groupMessageData.content,
      violations: ['user_report'],
      adminNotes: `User report: ${validated.reason}`,
    });

    await db
      .update(groupMessage)
      .set({
        flagged: true,
        flaggedReason: 'user_report',
      })
      .where(eq(groupMessage.id, validated.messageId));

    return { success: true };
  }

  throw new Error('Message not found');
}
