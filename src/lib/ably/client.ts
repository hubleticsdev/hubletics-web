'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import * as Ably from 'ably';
import { ChatClient, Room, Message as ChatMessage } from '@ably/chat';

let ablyClientInstance: Ably.Realtime | null = null;
let chatClientInstance: ChatClient | null = null;

/**
 * Get or create singleton Ably Realtime client
 */
export function getAblyClient(clientId: string): Ably.Realtime {
    if (!ablyClientInstance) {
        ablyClientInstance = new Ably.Realtime({
            authUrl: '/api/ably/auth',
            authMethod: 'POST',
            authHeaders: {
                'Content-Type': 'application/json',
            },
            authParams: { clientId },
            clientId,
        });
    }
    return ablyClientInstance;
}

/**
 * Get or create singleton Chat client
 */
export function getChatClient(clientId: string): ChatClient {
    if (!chatClientInstance) {
        const ablyClient = getAblyClient(clientId);
        chatClientInstance = new ChatClient(ablyClient);
    }
    return chatClientInstance;
}

/**
 * Hook to subscribe to a chat room
 */
export function useChatRoom(roomId: string, clientId: string) {
    const [room, setRoom] = useState<Room | null>(null);
    const [isAttached, setIsAttached] = useState(false);
    const chatClient = useRef<ChatClient | null>(null);

    useEffect(() => {
        if (!roomId || !clientId) return;

        const setupRoom = async () => {
            chatClient.current = getChatClient(clientId);
            const chatRoom = await chatClient.current.rooms.get(roomId);

            await chatRoom.attach();
            setRoom(chatRoom);
            setIsAttached(true);
        };

        setupRoom();

        return () => {
            if (room) {
                room.detach().catch(console.error);
            }
            setIsAttached(false);
        };
    }, [roomId, clientId]);

    return { room, isAttached };
}

/**
 * Hook for typing indicators in a chat room
 */
export function useTypingIndicator(roomId: string, clientId: string) {
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const { room, isAttached } = useChatRoom(roomId, clientId);

    useEffect(() => {
        if (!room || !isAttached) return;

        const { unsubscribe } = room.typing.subscribe((event) => {
            setTypingUsers(event.currentlyTyping);
        });

        return () => {
            unsubscribe();
        };
    }, [room, isAttached]);

    const startTyping = useCallback(async () => {
        if (room && isAttached) {
            await room.typing.keystroke();
        }
    }, [room, isAttached]);

    const stopTyping = useCallback(async () => {
        if (room && isAttached) {
            await room.typing.stop();
        }
    }, [room, isAttached]);

    // Filter out current user from typing users
    const othersTyping = Array.from(typingUsers).filter(id => id !== clientId);

    return { typingUsers: othersTyping, startTyping, stopTyping };
}

/**
 * Hook to subscribe to messages in a chat room (uses Ably Chat for realtime)
 * Note: Initial messages should still come from your database
 */
export function useChatMessages(roomId: string, clientId: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const { room, isAttached } = useChatRoom(roomId, clientId);

    useEffect(() => {
        if (!room || !isAttached) return;

        const { unsubscribe } = room.messages.subscribe((event) => {
            setMessages((prev) => {
                // Avoid duplicates
                if (prev.some((m) => m.serial === event.message.serial)) {
                    return prev;
                }
                return [...prev, event.message];
            });
        });

        return () => {
            unsubscribe();
        };
    }, [room, isAttached]);

    return { messages, setMessages };
}

/**
 * Hook for presence in a chat room
 */
export function usePresence(roomId: string, clientId: string) {
    const [presentUsers, setPresentUsers] = useState<string[]>([]);
    const { room, isAttached } = useChatRoom(roomId, clientId);

    useEffect(() => {
        if (!room || !isAttached) return;

        // Enter presence
        room.presence.enter().catch(console.error);

        const { unsubscribe } = room.presence.subscribe((event) => {
            // Update present users list
            room.presence.get().then((members) => {
                setPresentUsers(members.map((m) => m.clientId));
            });
        });

        return () => {
            unsubscribe();
            room.presence.leave().catch(console.error);
        };
    }, [room, isAttached]);

    return presentUsers;
}

/**
 * Simple hook to subscribe to Ably channel events (non-Chat, for backwards compat)
 */
export function useAblyChannel<T = unknown>(
    channelName: string,
    eventName: string,
    callback: (data: T) => void,
    clientId: string
) {
    useEffect(() => {
        if (!channelName || !clientId) return;

        const ablyClient = getAblyClient(clientId);
        const channel = ablyClient.channels.get(channelName);

        channel.subscribe(eventName, (message) => {
            callback(message.data as T);
        });

        return () => {
            channel.unsubscribe(eventName);
        };
    }, [channelName, eventName, callback, clientId]);
}
