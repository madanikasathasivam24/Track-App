import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { connectSocket } from '../services/socket/socket';
import { onGroupMessage } from '../services/socket/chatEvents';
import { getChatHistory, sendChatMessage } from '../services/api/chat.api';
import { useGroupChatStore } from '../store/groupChatStore';
import { useAuthStore } from '../store/authStore';
import type { ChatMessage } from '../types/models';

interface UseGroupChatResult {
  messages: ChatMessage[];
  isLoading: boolean;
  send: (body: string) => Promise<void>;
  isSending: boolean;
}

// A stable reference for the "not cached yet" case — falling back to a fresh
// `[]` literal in the selector below would give useSyncExternalStore a new
// snapshot reference on every read, which it treats as a change, causing a
// render loop ("Maximum update depth exceeded") until the group's chat is
// actually cached for the first time.
const EMPTY_MESSAGES: ChatMessage[] = [];

// Seeds a group's chat via REST (newest-50, reversed to chronological order)
// on mount, then keeps listening for live messages over the socket — the
// group-wide counterpart of useMemberPositions.ts's seed-then-subscribe
// pattern. Messages are cached per group (see groupChatStore.ts), so
// reopening a chat already seen this session shows them instantly instead of
// a loading skeleton, while still refetching quietly in the background.
export function useGroupChat(groupId: string): UseGroupChatResult {
  const messages = useGroupChatStore((s) => s.messagesByGroup[groupId] ?? EMPTY_MESSAGES);
  const hasCached = useGroupChatStore((s) => s.messagesByGroup[groupId] !== undefined);
  const setMessages = useGroupChatStore((s) => s.setMessages);
  const appendMessage = useGroupChatStore((s) => s.appendMessage);
  const token = useAuthStore((s) => s.token);

  const [isLoading, setIsLoading] = useState(!hasCached);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    return onGroupMessage(socket, appendMessage);
  }, [token, appendMessage]);

  // Refetches on every focus, not just initial mount — a screen already
  // sitting in the nav stack from an earlier visit doesn't remount on
  // re-navigation, so a mount-only fetch would never see a message that
  // arrived while backgrounded/killed (the socket wasn't connected to
  // deliver it live in that case, which is exactly when a push notification
  // for it fires) until the whole app was force-quit and relaunched.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getChatHistory(groupId)
        .then((history) => {
          if (!cancelled) setMessages(groupId, [...history].reverse());
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [groupId, setMessages])
  );

  const send = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      setIsSending(true);
      try {
        const message = await sendChatMessage(groupId, trimmed);
        appendMessage(message);
      } finally {
        setIsSending(false);
      }
    },
    [groupId, appendMessage]
  );

  return { messages, isLoading, send, isSending };
}
