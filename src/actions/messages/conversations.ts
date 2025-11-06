'use server';

import { db } from '@/lib/db';
import { conversation, message, type Conversation } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { and, eq, desc, or } from 'drizzle-orm';
import { triggerMessageEvent, triggerConversationUpdate } from '@/lib/pusher/server';
import { z } from 'zod';
import { messageContentSchema, validateInput } from '@/lib/validations';

/**
 * Get all conversations for the current user
 */
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

  // Transform to include the "other" participant
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

/**
 * Get or create a conversation between two users
 * Uses INSERT ... ON CONFLICT pattern to prevent race conditions
 */
export async function getOrCreateConversation(otherUserId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  // Determine roles: if current user is client, they're talking to a coach
  // If current user is coach, the other user is the client
  const currentUserIsClient = session.user.role === 'client';
  const clientId = currentUserIsClient ? session.user.id : otherUserId;
  const coachId = currentUserIsClient ? otherUserId : session.user.id;

  // Try to insert first
  await db
    .insert(conversation)
    .values({
      clientId,
      coachId,
    })
    .onConflictDoNothing();

  // Now select the conversation (will be either newly created or existing)
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

  // Trigger real-time update for both users
  await Promise.all([
    triggerConversationUpdate(session.user.id, conversationResult),
    triggerConversationUpdate(otherUserId, conversationResult),
  ]);

  return conversationResult;
}

/**
 * Get messages for a specific conversation
 */
export async function getConversationMessages(conversationId: string, limit = 50, offset = 0) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  // Verify user is a participant
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

  return messages.reverse(); // Return in chronological order
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(conversationId: string, content: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  // Validate inputs
  const validatedConversationId = validateInput(z.string().uuid(), conversationId);
  const validatedContent = validateInput(messageContentSchema, content);

  // Verify user is a participant
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

  // Create message
  const [newMessage] = await db
    .insert(message)
    .values({
      conversationId: validatedConversationId,
      senderId: session.user.id,
      content: validatedContent.trim(),
    })
    .returning();

  // Update conversation lastMessageAt
  await db
    .update(conversation)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversation.id, validatedConversationId));

  // Get full message with sender info for real-time event
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

  // Trigger real-time event for the message
  await triggerMessageEvent(conversationId, fullMessage);

  // Determine the other participant
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

/**
 * Mark messages as read
 */
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
