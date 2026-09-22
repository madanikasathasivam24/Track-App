import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { connectSocket } from '../services/socket/socket';
import { emitLocationUpdate } from '../services/socket/locationEvents';
import { useAuthStore } from '../store/authStore';

const UPDATE_INTERVAL_MS = 4000;
const MIN_DISTANCE_METERS = 15;

// Watches the current user's own position while mounted (i.e. while a trip's
// live map is open) and broadcasts it to the rest of the trip over the
// socket — the trip-scoped counterpart of useFriendLiveLocation.ts. Fires an
// immediate broadcast on mount (not just on the first watch tick) so a
// member who just opened the map shows up for others right away.
export function useLiveLocation(tripId: string) {
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      try {
        const current = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
          setMyLocation(coords);
          emitLocationUpdate(connectSocket(token), tripId, coords);
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
          emitLocationUpdate(connectSocket(token), tripId, coords);
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [token, tripId]);

  return { latitude: myLocation?.latitude ?? null, longitude: myLocation?.longitude ?? null };
}
