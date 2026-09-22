import { create } from 'zustand';
import type { TripMemberPosition } from '../types/models';

interface TripLocationState {
  positions: TripMemberPosition[];
  upsertPosition: (position: TripMemberPosition) => void;
  setPositions: (positions: TripMemberPosition[]) => void;
  clear: () => void;
}

// Mirrors friendsLocationStore.ts's find-or-append pattern, keyed by
// (tripId, userId) rather than just friend id, since a user could in theory
// be viewing/broadcasting to more than one trip's worth of stale data across
// mounts — useMemberPositions filters by tripId and clears on unmount anyway,
// but the compound key keeps this store correct even if that ever changes.
export const useTripLocationStore = create<TripLocationState>((set) => ({
  positions: [],

  upsertPosition: (position) =>
    set((state) => {
      const existingIndex = state.positions.findIndex(
        (p) => p.userId === position.userId && p.tripId === position.tripId
      );
      if (existingIndex === -1) return { positions: [...state.positions, position] };
      const next = [...state.positions];
      next[existingIndex] = position;
      return { positions: next };
    }),

  setPositions: (positions) => set({ positions }),

  clear: () => set({ positions: [] }),
}));
