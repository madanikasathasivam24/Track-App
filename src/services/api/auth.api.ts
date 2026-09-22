import { apiClient } from './client';
import { toE164, fromE164 } from '../../utils/phone';
import type { AuthResponse, User } from '../../types/models';

export interface SignupPayload {
  phoneNumber: string;
  pin: string;
  name: string;
  avatarIndex: number;
}

export interface LoginPayload {
  phoneNumber: string;
  pin: string;
}

export interface UpdateProfilePayload {
  name?: string;
  avatarIndex?: number;
}

function toLocalUser(user: User): User {
  return { ...user, phoneNumber: fromE164(user.phoneNumber) };
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/signup', {
    ...payload,
    phoneNumber: toE164(payload.phoneNumber),
  });
  return { ...data, user: toLocalUser(data.user) };
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', {
    ...payload,
    phoneNumber: toE164(payload.phoneNumber),
  });
  return { ...data, user: toLocalUser(data.user) };
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  const { data } = await apiClient.patch<User>('/users/me', payload);
  return toLocalUser(data);
}

// Alternate login: verifies a Firebase ID token (obtained after Google
// Sign-In — see src/services/firebase/auth.ts's signInWithGoogle) against
// Track-api's Firebase Admin SDK, find-or-creating a Track-api user. Returns
// the same shape as login/signup.
export async function loginWithGoogle(firebaseIdToken: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/google', { firebaseIdToken });
  return { ...data, user: toLocalUser(data.user) };
}

// Mints a Firebase custom token (uid = this Track-api user's id) so the app
// can sign into Firebase for Firestore-backed features — see
// useFirebaseTrackingAuth.ts, which calls this on every logged-in session.
export async function getFirebaseCustomToken(): Promise<string> {
  const { data } = await apiClient.post<{ firebaseToken: string }>('/auth/firebase-token');
  return data.firebaseToken;
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/users/me');
  return toLocalUser(data);
}
