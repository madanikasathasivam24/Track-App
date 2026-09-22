import { create } from 'zustand';
import type { ChatMessage } from '../types/models';

interface GroupChatState {
  messagesByGroup: Record<string, ChatMessage[]>;
  setMessages: (groupId: string, messages: ChatMessage[]) => void;
  appendMessage: (message: ChatMessage) => void;
}

// Keyed per group, not a single flat list — two reasons. First, correctness:
// the fan-out socket event (group:message, see chatEvents.ts) delivers
// messages for every group the user is in, not just whichever chat happens
// to be open, so routing by the message's own groupId is what keeps one
// group's messages from leaking into another's screen. Second, it doubles as
// an instant-reopen cache (see useGroupChat.ts) — revisiting a group's chat
// shows its last-seen messages immediately instead of a loading skeleton
// every time, the same instant-then-refresh pattern as useStaleWhileRevalidate.
export const useGroupChatStore = create<GroupChatState>((set) => ({
  messagesByGroup: {},

  setMessages: (groupId, messages) =>
    set((state) => ({ messagesByGroup: { ...state.messagesByGroup, [groupId]: messages } })),

  appendMessage: (message) =>
    set((state) => {
      const existing = state.messagesByGroup[message.groupId] ?? [];
      if (existing.some((m) => m.id === message.id)) return state;
      return { messagesByGroup: { ...state.messagesByGroup, [message.groupId]: [...existing, message] } };
    }),
}));
