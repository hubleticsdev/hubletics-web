'use server';

import { db } from '@/lib/db';
import { conversation, message, flaggedMessage, type Conversation, user } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { and, eq, desc } from 'drizzle-orm';
import { triggerMessageEvent, triggerConversationUpdate } from '@/lib/pusher/server';
import { z } from 'zod';
import { messageContentSchema, validateInput } from '@/lib/validations';
import { checkMessageContent, getViolationTypes } from '@/lib/moderation/message-filter';

export async function getUserConversations() {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const conversations = await db.query.conversation.findMany({
    where: (conversations, { or, eq }) =>
      or(eq(conversations.clientId, session.user.id), eq(conversations.coachId, session.user.id)),
    with: {
      client: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      },
      coach: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
      },
      messages: {
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: 1,
      },
    },
    orderBy: [desc(conversation.lastMessageAt)],
  });

  return conversations.map((conv) => {
    const otherParticipant =
      conv.clientId === session.user.id ? conv.coach : conv.client;
    return {
      ...conv,
      otherParticipant,
      lastMessage: conv.messages[0] || null,
    };
  });
}

export async function getOrCreateConversation(otherUserId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  let clientId: string;
  let coachId: string;

  // Admins can message anyone
  if (session.user.role === 'admin') {
    const otherUser = await db.query.user.findFirst({
      where: eq(user.id, otherUserId),
      columns: { id: true, role: true },
    });

    if (!otherUser) {
      throw new Error('User not found');
    }

    coachId = session.user.id;
    clientId = otherUserId;
  } else {
    const currentUserIsClient = session.user.role === 'client';
    clientId = currentUserIsClient ? session.user.id : otherUserId;
    coachId = currentUserIsClient ? otherUserId : session.user.id;
  }

  await db
    .insert(conversation)
    .values({
      clientId,
      coachId,
    })
    .onConflictDoNothing();

  const [conversationResult] = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.clientId, clientId),
        eq(conversation.coachId, coachId)
      )
    )
    .limit(1);

  await Promise.all([
    triggerConversationUpdate(session.user.id, conversationResult),
    triggerConversationUpdate(otherUserId, conversationResult),
  ]);

  return conversationResult;
}

export async function getConversationMessages(conversationId: string, limit = 50, offset = 0) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const conv = await db.query.conversation.findFirst({
    where: (conversations, { and, eq, or }) =>
      and(
        eq(conversations.id, conversationId),
        or(
          eq(conversations.clientId, session.user.id),
          eq(conversations.coachId, session.user.id)
        )
      ),
  });

  if (!conv) {
    throw new Error('Conversation not found or unauthorized');
  }

  const messages = await db.query.message.findMany({
    where: eq(message.conversationId, conversationId),
    orderBy: [desc(message.createdAt)],
    limit,
    offset,
    with: {
      sender: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return messages.reverse();
}

export async function sendMessage(conversationId: string, content: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const validatedConversationId = validateInput(z.string().uuid(), conversationId);
  const validatedContent = validateInput(messageContentSchema, content);

  const moderationResult = checkMessageContent(validatedContent.trim());
  const shouldFlag = !moderationResult.isSafe;

  const conv = await db.query.conversation.findFirst({
    where: (conversations, { and, eq, or }) =>
      and(
        eq(conversations.id, validatedConversationId),
        or(
          eq(conversations.clientId, session.user.id),
          eq(conversations.coachId, session.user.id)
        )
      ),
  });

  if (!conv) {
    throw new Error('Conversation not found or unauthorized');
  }

  const [newMessage] = await db
    .insert(message)
    .values({
      conversationId: validatedConversationId,
      senderId: session.user.id,
      content: validatedContent.trim(),
      flagged: shouldFlag,
      flaggedReason: shouldFlag ? getViolationTypes(validatedContent.trim()).join(', ') : null,
    })
    .returning();

  if (shouldFlag) {
    await db.insert(flaggedMessage).values({
      messageId: newMessage.id,
      conversationId: validatedConversationId,
      senderId: session.user.id,
      content: validatedContent.trim(),
      violations: getViolationTypes(validatedContent.trim()),
    });

    console.log(`[MODERATION] Message ${newMessage.id} flagged for violations: ${getViolationTypes(validatedContent.trim()).join(', ')}`);
  }

  await db
    .update(conversation)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversation.id, validatedConversationId));

  const fullMessage = await db.query.message.findFirst({
    where: eq(message.id, newMessage.id),
    with: {
      sender: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  if (!fullMessage) {
    throw new Error('Failed to retrieve sent message');
  }

  await triggerMessageEvent(conversationId, fullMessage);

  const otherUserId =
    conv.clientId === session.user.id ? conv.coachId : conv.clientId;

  await triggerConversationUpdate(otherUserId, {
    id: conv.id,
    clientId: conv.clientId,
    coachId: conv.coachId,
    createdAt: conv.createdAt,
    updatedAt: new Date(),
    lastMessageAt: new Date(),
    lastMessage: {
      content: fullMessage.content,
      createdAt: fullMessage.createdAt,
      senderId: fullMessage.senderId,
    },
  } as Conversation);

  return fullMessage;
}

export async function markMessagesAsRead(conversationId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  await db
    .update(message)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(message.conversationId, conversationId),
        eq(message.readAt, null as unknown as Date),
      )
    );

  return { success: true };
}
