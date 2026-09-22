import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { writeTripLocation } from '../services/firebase/firestore';
import { useAuthStore } from '../store/authStore';

const UPDATE_INTERVAL_MS = 4000;
const MIN_DISTANCE_METERS = 15;

// Firestore-backed counterpart of useLiveLocation.ts — same foreground GPS
// watch, but writes straight to trips/{tripId}/locations/{userId} instead of
// emitting over the socket. A new, separate tracking path (see
// FirestoreLiveMapScreen.tsx) — useLiveLocation.ts/LiveMapScreen.tsx are
// untouched.
export function useFirestoreLiveLocation(tripId: string) {
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
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
          writeTripLocation(tripId, userId, coords).catch(() => {});
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
          writeTripLocation(tripId, userId, coords).catch(() => {});
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [userId, tripId]);

  return { latitude: myLocation?.latitude ?? null, longitude: myLocation?.longitude ?? null };
}
