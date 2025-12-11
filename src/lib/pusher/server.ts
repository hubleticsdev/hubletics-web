import Pusher from 'pusher';
import { env } from '@/lib/env';

export const pusherServer = new Pusher({
  appId: env.PUSHER_APP_ID,
  key: env.NEXT_PUBLIC_PUSHER_KEY,
  secret: env.PUSHER_SECRET,
  cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

export async function triggerMessageEvent(conversationId: string, message: unknown) {
  try {
    await pusherServer.trigger(`private-conversation-${conversationId}`, 'new-message', message);
  } catch (error) {
    console.error(`Failed to trigger message event for conversation ${conversationId}:`, error);
  }
}

export async function triggerTypingEvent(
  conversationId: string,
  data: { userId: string; userName: string; isTyping: boolean }
) {
  try {
    await pusherServer.trigger(`private-conversation-${conversationId}`, 'user-typing', data);
  } catch (error) {
    console.error(`Failed to trigger typing event for conversation ${conversationId}:`, error);
  }
}

export async function triggerConversationUpdate(userId: string, conversation: unknown) {
  try {
    await pusherServer.trigger(`user-${userId}`, 'conversation-update', conversation);
  } catch (error) {
    console.error(`Failed to trigger conversation update for user ${userId}:`, error);
  }
}
