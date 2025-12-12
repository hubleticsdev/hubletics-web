'use server';

import { db } from '@/lib/db';
import { flaggedMessage, message } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';
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

  const messageData = await db.query.message.findFirst({
    where: eq(message.id, validated.messageId),
    with: {
      conversation: true,
    },
  });

  if (!messageData) {
    throw new Error('Message not found');
  }

  const isParticipant =
    messageData.conversation.clientId === session.user.id ||
    messageData.conversation.coachId === session.user.id;

  if (!isParticipant) {
    throw new Error('Unauthorized to report this message');
  }

  const existingReport = await db.query.flaggedMessage.findFirst({
    where: eq(flaggedMessage.messageId, validated.messageId),
  });

  if (existingReport) {
    throw new Error('This message has already been reported');
  }

  await db.insert(flaggedMessage).values({
    messageId: validated.messageId,
    conversationId: messageData.conversation.id,
    senderId: messageData.senderId!,
    content: messageData.content,
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

  console.log(`[MODERATION] Message ${validated.messageId} reported by user ${session.user.id}: ${validated.reason}`);

  return { success: true };
}
