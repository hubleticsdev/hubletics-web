'use client';

import { useEffect, useState, useRef } from 'react';
import PusherJS from 'pusher-js';
import { clientEnv } from '@/lib/env';

let pusherInstance: PusherJS | null = null;

export function getPusherClient(): PusherJS {
  if (!pusherInstance) {
    pusherInstance = new PusherJS(clientEnv.PUSHER_KEY, {
      cluster: clientEnv.PUSHER_CLUSTER,
      auth: {
        headers: {
        }
      },
      authEndpoint: '/api/pusher/auth',
    });
  }
  return pusherInstance;
}

export function usePusherChannel(channelName: string) {
  const [channel, setChannel] = useState<ReturnType<PusherJS['subscribe']> | null>(null);
  const pusher = useRef<PusherJS | null>(null);

  useEffect(() => {
    pusher.current = getPusherClient();
    const subscribedChannel = pusher.current.subscribe(channelName);
    setChannel(subscribedChannel);

    return () => {
      subscribedChannel.unsubscribe();
    };
  }, [channelName]);

  return channel;
}

export function usePusherEvent<T = unknown>(
  channelName: string,
  eventName: string,
  callback: (data: T) => void
) {
  const channel = usePusherChannel(channelName);

  useEffect(() => {
    if (!channel) return;

    channel.bind(eventName, callback);

    return () => {
      channel.unbind(eventName, callback);
    };
  }, [channel, eventName, callback]);
}

export function useConversationMessages(conversationId: string) {
  const [messages, setMessages] = useState<unknown[]>([]);
  const channelName = `private-conversation-${conversationId}`;

  usePusherEvent(channelName, 'new-message', (newMessage: unknown) => {
    setMessages((prev) => [...prev, newMessage]);
  });

  return { messages, setMessages };
}

export function useTypingIndicator(conversationId: string) {
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const channelName = `private-conversation-${conversationId}`;

  usePusherEvent<{ userId: string; userName: string; isTyping: boolean }>(
    channelName,
    'user-typing',
    (data) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (data.isTyping) {
          next[data.userId] = data.userName;
        } else {
          delete next[data.userId];
        }
        return next;
      });
    }
  );

  return typingUsers;
}
