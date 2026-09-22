import { create } from 'zustand';
import type { PeerAlert } from '../types/models';

interface AlertState {
  // Queue of incoming peer alerts not yet acknowledged by the user — drives
  // the in-app toast banner (mounted in RootNavigator) shown while any screen
  // other than the matching PeerAlertModal thread is open. Purely
  // transient/in-memory: the source of truth for a thread's own history is
  // always the REST thread fetch (alerts.api.ts's getPeerAlertThread), not
  // this store.
  incoming: PeerAlert[];
  pushIncoming: (alert: PeerAlert) => void;
  dismissIncoming: (alertId: string) => void;

  // Persistent per-sender unread *count* driving the red number badge on a
  // member's avatar in LiveMapScreen — unlike `incoming` above, this isn't
  // auto-dismissed, and survives a fresh page load because LiveMapScreen
  // seeds it from getUnseenAlertCounts on mount (not just from live socket
  // events received while already connected). Keyed by trip+peer since the
  // same two people could in principle share more than one trip.
  unreadCounts: Record<string, number>;
  incrementPeerUnread: (tripId: string, peerId: string) => void;
  clearPeerUnread: (tripId: string, peerId: string) => void;
  setUnreadCounts: (tripId: string, counts: Record<string, number>) => void;
}

export function unreadKey(tripId: string, peerId: string): string {
  return `${tripId}:${peerId}`;
}

export const useAlertStore = create<AlertState>((set) => ({
  incoming: [],
  pushIncoming: (alert) => set((state) => ({ incoming: [...state.incoming, alert] })),
  dismissIncoming: (alertId) => set((state) => ({ incoming: state.incoming.filter((a) => a.id !== alertId) })),

  unreadCounts: {},

  incrementPeerUnread: (tripId, peerId) =>
    set((state) => {
      const key = unreadKey(tripId, peerId);
      return { unreadCounts: { ...state.unreadCounts, [key]: (state.unreadCounts[key] ?? 0) + 1 } };
    }),

  clearPeerUnread: (tripId, peerId) =>
    set((state) => {
      const next = { ...state.unreadCounts };
      delete next[unreadKey(tripId, peerId)];
      return { unreadCounts: next };
    }),

  setUnreadCounts: (tripId, counts) =>
    set((state) => {
      const next = { ...state.unreadCounts };
      Object.entries(counts).forEach(([peerId, count]) => {
        next[unreadKey(tripId, peerId)] = count;
      });
      return { unreadCounts: next };
    }),
}));
