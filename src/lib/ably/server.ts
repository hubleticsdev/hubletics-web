import Ably from 'ably';

const ablyApiKey = process.env.ABLY_API_KEY;

if (!ablyApiKey) {
    throw new Error('ABLY_API_KEY environment variable is required');
}

export const ablyServer = new Ably.Rest({ key: ablyApiKey });

/**
 * Create a token request for client-side authentication
 */
export async function createTokenRequest(clientId: string): Promise<Ably.TokenRequest> {
    return ablyServer.auth.createTokenRequest({
        clientId,
        capability: {
            'private-conversation:*': ['subscribe', 'publish', 'presence'],
            'private-group-conversation:*': ['subscribe', 'publish', 'presence'],
            'user:*': ['subscribe'],
        },
    });
}

/**
 * Trigger a message event to a conversation channel
 */
export async function triggerMessageEvent(conversationId: string, message: unknown) {
    try {
        const channel = ablyServer.channels.get(`private-conversation:${conversationId}`);
        await channel.publish('new-message', message);
    } catch (error) {
        console.error(`Failed to trigger message event for conversation ${conversationId}:`, error);
    }
}

/**
 * Trigger a conversation update to a user's channel
 */
export async function triggerConversationUpdate(userId: string, conversation: unknown) {
    try {
        const channel = ablyServer.channels.get(`user:${userId}`);
        await channel.publish('conversation-update', conversation);
    } catch (error) {
        console.error(`Failed to trigger conversation update for user ${userId}:`, error);
    }
}

/**
 * Trigger a message event to a group conversation channel
 */
export async function triggerGroupMessageEvent(conversationId: string, message: unknown) {
    try {
        const channel = ablyServer.channels.get(`private-group-conversation:${conversationId}`);
        await channel.publish('new-message', message);
    } catch (error) {
        console.error(`Failed to trigger group message event for conversation ${conversationId}:`, error);
    }
}

/**
 * Trigger a group conversation update to a user's channel
 */
export async function triggerGroupConversationUpdate(userId: string, conversation: unknown) {
    try {
        const channel = ablyServer.channels.get(`user:${userId}`);
        await channel.publish('group-conversation-update', conversation);
    } catch (error) {
        console.error(`Failed to trigger group conversation update for user ${userId}:`, error);
    }
}
