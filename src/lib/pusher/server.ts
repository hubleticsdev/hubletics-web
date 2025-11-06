/**
 * Pusher server-side client
 *
 * Used for triggering events from the server (e.g., sending messages)
 * ONLY use on the server - never import in client components
 */

import Pusher from 'pusher';
import { env } from '@/lib/env';

export const pusherServer = new Pusher({
  appId: env.PUSHER_APP_ID,
  key: env.NEXT_PUBLIC_PUSHER_KEY,
  secret: env.PUSHER_SECRET,
  cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

/**
 * Trigger a message event for a specific conversation
 */
export async function triggerMessageEvent(conversationId: string, message: unknown) {
  try {
    await pusherServer.trigger(`private-conversation-${conversationId}`, 'new-message', message);
  } catch (error) {
    console.error(`Failed to trigger message event for conversation ${conversationId}:`, error);
    // Don't throw - real-time messaging shouldn't break the core flow
    // Log the error and continue
  }
}

/**
 * Trigger a typing indicator for a conversation
 */
export async function triggerTypingEvent(
  conversationId: string,
  data: { userId: string; userName: string; isTyping: boolean }
) {
  try {
    await pusherServer.trigger(`private-conversation-${conversationId}`, 'user-typing', data);
  } catch (error) {
    console.error(`Failed to trigger typing event for conversation ${conversationId}:`, error);
    // Don't throw - typing indicators are non-critical
  }
}

/**
 * Trigger a conversation update (e.g., new conversation created, last message updated)
 */
export async function triggerConversationUpdate(userId: string, conversation: unknown) {
  try {
    await pusherServer.trigger(`user-${userId}`, 'conversation-update', conversation);
  } catch (error) {
    console.error(`Failed to trigger conversation update for user ${userId}:`, error);
    // Don't throw - conversation updates are important but not critical
    // Log the error and continue
  }
}
