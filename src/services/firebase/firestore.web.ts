// @react-native-firebase/firestore is native-only — this no-op stub is what
// Metro's web bundler resolves instead of firestore.ts, so `npm run web`
// never tries to load a native module. Firestore-backed tracking simply
// isn't offered on web.
import type { FirestoreTripLocation } from './firestore';

export type { FirestoreTripLocation };

export async function writeTripLocation(
  _tripId: string,
  _userId: string,
  _coords: { latitude: number; longitude: number }
): Promise<void> {}

export function subscribeTripLocations(
  _tripId: string,
  _onUpdate: (locations: FirestoreTripLocation[]) => void
): () => void {
  return () => {};
}
