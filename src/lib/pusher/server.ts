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
  await pusherServer.trigger(`conversation-${conversationId}`, 'new-message', message);
}

/**
 * Trigger a typing indicator for a conversation
 */
export async function triggerTypingEvent(
  conversationId: string,
  data: { userId: string; userName: string; isTyping: boolean }
) {
  await pusherServer.trigger(`conversation-${conversationId}`, 'user-typing', data);
}

/**
 * Trigger a conversation update (e.g., new conversation created, last message updated)
 */
export async function triggerConversationUpdate(userId: string, conversation: unknown) {
  await pusherServer.trigger(`user-${userId}`, 'conversation-update', conversation);
}
