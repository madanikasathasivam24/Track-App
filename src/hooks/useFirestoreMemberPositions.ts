import { useEffect, useState } from 'react';
import { subscribeTripLocations } from '../services/firebase/firestore';
import { getTripMemberLocations } from '../services/api/trips.api';
import type { TripMemberPosition } from '../types/models';

// Firestore-backed counterpart of useMemberPositions.ts — joins Firestore's
// bare {userId, latitude, longitude} docs against the trip roster's
// name/avatarIndex/trackId (from the same REST seed endpoint the
// socket-based path uses, since Track-api — not Firestore — is still the
// source of truth for who's on the trip) to produce the same
// TripMemberPosition shape LiveMapScreen already knows how to render.
export function useFirestoreMemberPositions(groupId: string, tripId: string): TripMemberPosition[] {
  const [roster, setRoster] = useState<Map<string, TripMemberPosition>>(new Map());
  const [positions, setPositions] = useState<TripMemberPosition[]>([]);

  useEffect(() => {
    let cancelled = false;
    getTripMemberLocations(groupId, tripId)
      .then((seeded) => {
        if (!cancelled) setRoster(new Map(seeded.map((m) => [m.userId, m])));
      })
      .catch(() => {
        // Best-effort — the Firestore stream below still works for members
        // who already have a Firestore doc, just without name/avatar until
        // this resolves.
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, tripId]);

  useEffect(() => {
    return subscribeTripLocations(tripId, (locations) => {
      setPositions(
        locations.map((loc) => {
          const known = roster.get(loc.userId);
          return {
            tripId,
            userId: loc.userId,
            name: known?.name ?? 'Member',
            avatarIndex: known?.avatarIndex ?? 0,
            trackId: known?.trackId ?? '',
            latitude: loc.latitude,
            longitude: loc.longitude,
            // Firestore's serverTimestamp isn't resolved locally until the
            // write round-trips — receipt time is close enough for display.
            lastUpdatedAt: new Date().toISOString(),
          };
        })
      );
    });
  }, [tripId, roster]);

  useEffect(() => () => setPositions([]), [tripId]);

  return positions;
}
