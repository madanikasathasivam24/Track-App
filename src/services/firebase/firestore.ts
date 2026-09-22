import { getApp } from '@react-native-firebase/app';
import { getFirestore, doc, collection, setDoc, onSnapshot, serverTimestamp } from '@react-native-firebase/firestore';

function db() {
  return getFirestore(getApp());
}

export interface FirestoreTripLocation {
  userId: string;
  latitude: number;
  longitude: number;
}

// Doc ID is the Track-api user id (== request.auth.uid, since Track-api mints
// the signed-in Firebase custom token with that same uid — see
// useFirebaseTrackingAuth.ts) so firestore.rules can scope writes to their
// own document without any extra identity lookup.
export async function writeTripLocation(
  tripId: string,
  userId: string,
  coords: { latitude: number; longitude: number }
): Promise<void> {
  await setDoc(
    doc(db(), 'trips', tripId, 'locations', userId),
    { userId, latitude: coords.latitude, longitude: coords.longitude, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export function subscribeTripLocations(
  tripId: string,
  onUpdate: (locations: FirestoreTripLocation[]) => void
): () => void {
  return onSnapshot(
    collection(db(), 'trips', tripId, 'locations'),
    (snapshot) => onUpdate(snapshot.docs.map((d) => d.data() as FirestoreTripLocation)),
    () => {
      // Best-effort stream — a transient permission/network error just means
      // positions stay stale until the next successful snapshot.
    }
  );
}
