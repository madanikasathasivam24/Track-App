import { useEffect } from 'react';
import { connectSocket } from '../services/socket/socket';
import { onFriendPosition } from '../services/socket/friendLocationEvents';
import { useFriendsLocationStore } from '../store/friendsLocationStore';
import { useAuthStore } from '../store/authStore';
import { getActiveShareFriendIds, getFriendLocation } from '../services/api/liveShare.api';
import type { FriendPosition } from '../types/models';

// Subscribes to friends' live positions while mounted (i.e. while the Friends
// tab is open) — the friends-graph counterpart to the (still stubbed)
// group-scoped useMemberPositions.
//
// Connects via connectSocket() itself rather than assuming RootNavigator's
// own connectSocket() call has already run — on cold start with a persisted
// session, this hook's effect (deep in the tree) can fire before
// RootNavigator's (its ancestor), since child effects run first, and a plain
// getSocket() would silently and permanently return null for this mount.
export function useFriendPositions(): FriendPosition[] {
  const positions = useFriendsLocationStore((s) => s.positions);
  const upsertPosition = useFriendsLocationStore((s) => s.upsertPosition);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    return onFriendPosition(socket, upsertPosition);
  }, [token, upsertPosition]);

  // Seeds each actively-shared friend's last known position immediately on
  // mount. Without this, a friend who's already sharing doesn't show up until
  // their next live GPS tick arrives over the socket — which could be
  // anywhere from seconds to never, if they're stationary.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const friendIds = await getActiveShareFriendIds();
        const results = await Promise.allSettled(friendIds.map((id) => getFriendLocation(id)));
        if (cancelled) return;
        results.forEach((result) => {
          if (result.status !== 'fulfilled') return;
          const loc = result.value;
          upsertPosition({
            id: loc.id,
            name: loc.name,
            avatarIndex: loc.avatarIndex,
            trackId: loc.trackId,
            latitude: loc.latitude,
            longitude: loc.longitude,
            lastUpdatedAt: loc.updatedAt ?? new Date().toISOString(),
          });
        });
      } catch {
        // Best-effort seed — live socket updates still work without it.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, upsertPosition]);

  return positions;
}
