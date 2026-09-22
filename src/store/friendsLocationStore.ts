import { create } from 'zustand';
import type { FriendPosition } from '../types/models';

interface FriendsLocationState {
  positions: FriendPosition[];
  upsertPosition: (position: FriendPosition) => void;
  clear: () => void;
}

// Mirrors groupStore.ts's upsertMemberPosition find-or-append pattern, keyed
// by friend id instead of group membership.
export const useFriendsLocationStore = create<FriendsLocationState>((set) => ({
  positions: [],

  upsertPosition: (position) =>
    set((state) => {
      const existingIndex = state.positions.findIndex((p) => p.id === position.id);
      if (existingIndex === -1) return { positions: [...state.positions, position] };
      const next = [...state.positions];
      next[existingIndex] = position;
      return { positions: next };
    }),

  clear: () => set({ positions: [] }),
}));
