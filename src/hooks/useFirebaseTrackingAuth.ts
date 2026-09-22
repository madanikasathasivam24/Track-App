import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getFirebaseCustomToken } from '../services/api/auth.api';
import { signInFirebaseWithCustomToken, signOutFirebase } from '../services/firebase/auth';

// Establishes (or tears down) the Firebase session that actually grants
// Firestore access for the tracking feature — runs for every logged-in
// session regardless of whether the user signed into Track-api with
// phone+PIN or Google (see LoginScreen's "Continue with Google" button,
// which is a separate, optional login path). The custom token's uid is
// always this Track-api user's id, so firestore.rules can scope documents by
// request.auth.uid with no extra identity lookup. Mounted once in
// RootNavigator, same pattern as usePushNotifications.
export function useFirebaseTrackingAuth(): void {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getFirebaseCustomToken()
      .then((firebaseToken) => {
        if (!cancelled) return signInFirebaseWithCustomToken(firebaseToken);
      })
      .catch(() => {
        // Best-effort — Firestore-backed tracking just stays unavailable
        // until the next successful sign-in; nothing else in the app depends
        // on this.
      });

    return () => {
      cancelled = true;
      signOutFirebase();
    };
  }, [token]);
}
