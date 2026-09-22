import { useEffect } from 'react';
import { connectSocket } from '../services/socket/socket';
import { onMemberPosition } from '../services/socket/locationEvents';
import { getTripMemberLocations } from '../services/api/trips.api';
import { useTripLocationStore } from '../store/tripLocationStore';
import { useAuthStore } from '../store/authStore';
import type { TripMemberPosition } from '../types/models';

// Subscribes to a trip's members' live positions while mounted (i.e. while
// its live map is open) — seeds from the last known positions via REST on
// mount (so a member who's already tracking shows up instantly, not just on
// their next GPS tick — see useFriendPositions.ts for the same lesson), then
// keeps listening for live updates over the socket.
export function useMemberPositions(groupId: string, tripId: string): TripMemberPosition[] {
  const positions = useTripLocationStore((s) => s.positions);
  const upsertPosition = useTripLocationStore((s) => s.upsertPosition);
  const setPositions = useTripLocationStore((s) => s.setPositions);
  const clear = useTripLocationStore((s) => s.clear);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    return onMemberPosition(socket, upsertPosition);
  }, [token, upsertPosition]);

  useEffect(() => {
    let cancelled = false;
    getTripMemberLocations(groupId, tripId)
      .then((seeded) => {
        if (!cancelled) setPositions(seeded);
      })
      .catch(() => {
        // Best-effort seed — live socket updates still work without it.
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, tripId, setPositions]);

  useEffect(() => clear, [tripId, clear]);

  return positions.filter((p) => p.tripId === tripId);
}
