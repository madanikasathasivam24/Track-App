import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { connectSocket } from '../services/socket/socket';
import { emitFriendLocationUpdate } from '../services/socket/friendLocationEvents';
import { useAuthStore } from '../store/authStore';

const UPDATE_INTERVAL_MS = 3000;
const MIN_DISTANCE_METERS = 5;

// Watches the current user's own position while mounted (i.e. while the
// Friends tab is open) and broadcasts it to friends over the socket. Returns
// the last known position so the caller can render its own "me" marker
// without a second location fetch.
//
// Connects via connectSocket() itself (see useFriendPositions.ts for why) —
// this one is self-healing per tick even without that, since it re-checks
// every ~5s, but this keeps both hooks consistent and connects proactively
// rather than waiting for the first location tick.
export function useFriendLiveLocation() {
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      // Broadcast the current fix immediately rather than waiting for the
      // first watchPositionAsync tick — otherwise a friend who just opened
      // this tab shows nothing until they happen to move.
      try {
        const current = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
          setMyLocation(coords);
          emitFriendLocationUpdate(connectSocket(token), coords);
        }
      } catch {
        // Fall through to watchPositionAsync below.
      }
      if (cancelled) return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: UPDATE_INTERVAL_MS, distanceInterval: MIN_DISTANCE_METERS },
        (position) => {
          const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          setMyLocation(coords);
          const socket = connectSocket(token);
          emitFriendLocationUpdate(socket, coords);
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [token]);

  return myLocation;
}
