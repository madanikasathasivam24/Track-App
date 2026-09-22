import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  signInWithCredential,
  signInWithCustomToken,
  signOut,
  getIdToken,
  GoogleAuthProvider,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

function authInstance() {
  return getAuth(getApp());
}

// Must run once before the first signInWithGoogle() call — see RootNavigator.
export function configureGoogleSignIn(): void {
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
}

// Signs the user into both Google and Firebase, returning a *Firebase* ID
// token (not the raw Google one) — Track-api's /auth/google endpoint verifies
// this with the same Admin SDK it already uses for push, so there's only one
// verification path on the backend regardless of how the client got here.
export async function signInWithGoogle(): Promise<string> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success' || !response.data.idToken) {
    throw new Error('Google sign-in was cancelled');
  }
  const credential = GoogleAuthProvider.credential(response.data.idToken);
  const { user } = await signInWithCredential(authInstance(), credential);
  return getIdToken(user);
}

// Establishes the Firebase session that actually grants Firestore access —
// uid is always the Track-api user id (see useFirebaseTrackingAuth.ts), which
// is what firestore.rules keys off, independent of whether the user logged
// into Track-api with phone+PIN or Google.
export async function signInFirebaseWithCustomToken(customToken: string): Promise<void> {
  await signInWithCustomToken(authInstance(), customToken);
}

export async function signOutFirebase(): Promise<void> {
  try {
    await signOut(authInstance());
  } catch {
    // Best-effort — a stale Firebase session left behind after logout just
    // means Firestore writes get rejected until the next login re-signs in.
  }
}
