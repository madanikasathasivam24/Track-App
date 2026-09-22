import { create } from 'zustand';
import * as SecureStore from '../utils/secureStorage';
import { ACCESS_TOKEN_KEY, HAS_LOGGED_IN_BEFORE_KEY, SESSION_END_REASON_KEY } from '../utils/constants';
import {
  getCurrentUser,
  login as loginRequest,
  loginWithGoogle as loginWithGoogleRequest,
  signup as signupRequest,
} from '../services/api/auth.api';
import type { LoginPayload, SignupPayload } from '../services/api/auth.api';
import { signInWithGoogle } from '../services/firebase/auth';
import { onSessionExpired } from '../services/api/sessionEvents';
import { unregisterPushToken } from '../services/api/push.api';
import { getPushToken } from '../services/notifications/push';
import { getStatus } from '../utils/apiError';
import type { User } from '../types/models';

interface AuthState {
  user: User | null;
  token: string | null;
  isHydrating: boolean;
  isSubmitting: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  handleSessionExpired: (requestUrl?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isHydrating: true,
  isSubmitting: false,
  error: null,

  // Restores a persisted session on app launch by reading the JWT out of
  // SecureStore — the token itself is the source of truth, not AsyncStorage.
  // The token alone isn't enough: it also confirms the token is still valid
  // and the user still exists by fetching the profile, logging out only if
  // the backend actually says the token is bad (401) — a network error,
  // timeout, or Track-api's Render free-tier cold start (30-50s on a cold
  // request, easily past apiClient's 15s timeout) isn't proof the session is
  // invalid, and treating it as one was logging users out just because the
  // backend was slow to respond on app open, not because their session
  // actually expired.
  hydrate: async () => {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (!token) {
      // Only a breadcrumb-worthy surprise if this device has actually logged
      // in before — a brand new install with no token yet is normal, not a
      // bug, and would otherwise falsely "confirm" the bug on every fresh
      // install.
      const hasLoggedInBefore = await SecureStore.getItemAsync(HAS_LOGGED_IN_BEFORE_KEY);
      if (hasLoggedInBefore) {
        await SecureStore.setItemAsync(
          SESSION_END_REASON_KEY,
          `[${new Date().toISOString()}] hydrate(): SecureStore had no token on launch, even though this device logged in before.`
        );
      }
      set({ isHydrating: false });
      return;
    }

    try {
      const user = await getCurrentUser();
      set({ token, user, isHydrating: false });
    } catch (err) {
      if (getStatus(err) === 401) {
        await SecureStore.setItemAsync(
          SESSION_END_REASON_KEY,
          `[${new Date().toISOString()}] hydrate(): GET /users/me returned 401 on launch — token was rejected as invalid.`
        );
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        set({ token: null, user: null, isHydrating: false });
      } else {
        // Not a bad token — most likely Track-api's Render free-tier cold
        // start (30-50s) outlasting apiClient's 15s timeout. Keep the
        // session but retry in the background so `user` (and every
        // user?.id-based admin/creator check across the app) gets populated
        // once the backend wakes up, instead of staying null all session.
        set({ token, isHydrating: false });
        scheduleUserRetry();
      }
    }
  },

  login: async (payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const { accessToken, user } = await loginRequest(payload);
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(HAS_LOGGED_IN_BEFORE_KEY, 'true');
      set({ token: accessToken, user, isSubmitting: false });
    } catch (err) {
      set({ isSubmitting: false, error: toErrorMessage(err) });
      throw err;
    }
  },

  // Alternate login: Google Sign-In gets the user a Firebase ID token, which
  // Track-api verifies to find-or-create their account — same store shape as
  // phone+PIN login/signup below. The Firestore-tracking Firebase session
  // itself is established separately, by useFirebaseTrackingAuth, once this
  // sets `token`.
  loginWithGoogle: async () => {
    set({ isSubmitting: true, error: null });
    try {
      const firebaseIdToken = await signInWithGoogle();
      const { accessToken, user } = await loginWithGoogleRequest(firebaseIdToken);
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(HAS_LOGGED_IN_BEFORE_KEY, 'true');
      set({ token: accessToken, user, isSubmitting: false });
    } catch (err) {
      set({ isSubmitting: false, error: toErrorMessage(err) });
      throw err;
    }
  },

  signup: async (payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const { accessToken, user } = await signupRequest(payload);
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(HAS_LOGGED_IN_BEFORE_KEY, 'true');
      set({ token: accessToken, user, isSubmitting: false });
    } catch (err) {
      set({ isSubmitting: false, error: toErrorMessage(err) });
      throw err;
    }
  },

  logout: async () => {
    try {
      const pushToken = await getPushToken();
      if (pushToken) await unregisterPushToken(pushToken);
    } catch {
      // Best-effort — a signed-out device keeping a stray token registered
      // just means one wasted push later, not worth blocking logout over.
    }
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    set({ token: null, user: null, error: null });
  },

  // Called when apiClient's response interceptor reports a 401 while we
  // thought we had a valid session — clears it and surfaces a message on the
  // login screen RootNavigator swaps to automatically.
  handleSessionExpired: async (requestUrl) => {
    await SecureStore.setItemAsync(
      SESSION_END_REASON_KEY,
      `[${new Date().toISOString()}] handleSessionExpired(): ${requestUrl ?? 'a request'} returned 401 while the app was in use.`
    );
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    set({ token: null, user: null, error: 'Your session has expired. Please log in again.' });
  },
}));

// A 401 with no token yet (e.g. a wrong-PIN login attempt) is a normal login
// failure, not an expired session — only react to this if we thought we were
// logged in.
onSessionExpired((requestUrl) => {
  if (useAuthStore.getState().token) {
    useAuthStore.getState().handleSessionExpired(requestUrl);
  }
});

// Reads the breadcrumb left by the last session-ending event (if any) and
// clears it so it only ever surfaces once — call from LoginScreen on mount.
export async function getAndClearSessionEndReason(): Promise<string | null> {
  const reason = await SecureStore.getItemAsync(SESSION_END_REASON_KEY);
  if (reason) await SecureStore.deleteItemAsync(SESSION_END_REASON_KEY);
  return reason;
}

// A handful of spaced-out attempts comfortably covers a Render cold start
// without hammering it while it's still booting.
const USER_RETRY_DELAYS_MS = [5000, 10000, 20000];

function scheduleUserRetry(attempt = 0) {
  if (attempt >= USER_RETRY_DELAYS_MS.length) return;
  setTimeout(async () => {
    const { token, user } = useAuthStore.getState();
    if (!token || user) return; // logged out, or a later call already succeeded
    try {
      const freshUser = await getCurrentUser();
      useAuthStore.setState({ user: freshUser });
    } catch (err) {
      if (getStatus(err) === 401) return; // handled by the session-expired listener
      scheduleUserRetry(attempt + 1);
    }
  }, USER_RETRY_DELAYS_MS[attempt]);
}

function toErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
