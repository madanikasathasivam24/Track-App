// @react-native-firebase/* and @react-native-google-signin/google-signin's
// native credential flow are native-only — this no-op stub is what Metro's
// web bundler resolves instead of auth.ts, so `npm run web` never tries to
// load a native module. Google Sign-In and Firestore tracking simply aren't
// offered on web.

export function configureGoogleSignIn(): void {}

export async function signInWithGoogle(): Promise<string> {
  throw new Error('Google Sign-In is not available on web');
}

export async function signInFirebaseWithCustomToken(_customToken: string): Promise<void> {}

export async function signOutFirebase(): Promise<void> {}
