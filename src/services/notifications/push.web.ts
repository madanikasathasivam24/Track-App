import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import type { PushDeepLinkData } from './push';

export type { PushDeepLinkData };

// Web push is a genuinely different mechanism from the native path (RNFirebase
// via @react-native-firebase/messaging, native FCM/APNs) — the browser has no
// access to that native SDK at all. This uses the Firebase JS SDK's Web Push
// support instead: a Service Worker (public/firebase-messaging-sw.js) plus the
// browser's own Notification/Push APIs, still landing on the same FCM tokens
// the backend already sends to (NotificationsService.sendToUser doesn't care
// which SDK produced a token).
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

// The service worker file lives in public/ (served at the site root by
// Metro's web dev server) and can't read env vars itself, so its Firebase
// config is passed in via the registration URL's query string instead — a
// standard workaround for SPA setups where the SW can't be built with env
// substitution. Registered once and cached for the tab's lifetime.
let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistrationPromise) return swRegistrationPromise;

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    swRegistrationPromise = Promise.resolve(null);
    return swRegistrationPromise;
  }

  const params = new URLSearchParams(firebaseConfig as Record<string, string>);
  swRegistrationPromise = navigator.serviceWorker
    .register(`/firebase-messaging-sw.js?${params.toString()}`)
    .catch(() => null);
  return swRegistrationPromise;
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// Android-only concept — no-op here so usePushNotifications.ts can call this
// uniformly regardless of platform.
export async function ensureAndroidNotificationChannel(): Promise<void> {}

export async function getPushToken(): Promise<string | null> {
  try {
    if (!(await isSupported())) return null;
    const registration = await registerServiceWorker();
    if (!registration) return null;
    const messaging = getMessaging(getFirebaseApp());
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  } catch {
    return null;
  }
}

export function getPushPlatform(): 'android' | 'ios' | 'web' {
  return 'web';
}

// The Firebase JS SDK has no token-refresh event (unlike RNFirebase) — tokens
// are simply re-fetched on each registration call, and usePushNotifications
// already re-registers on every login, so no separate listener is needed.
export function onPushTokenRefresh(_callback: (token: string) => void): () => void {
  return () => {};
}

// Only fires while the tab is focused — background/quit-tab messages are
// handled entirely by the service worker's own onBackgroundMessage handler
// (see firebase-messaging-sw.js), which can display a system notification
// but can't reach back into this JS context.
export function onForegroundPush(callback: (data: PushDeepLinkData) => void): () => void {
  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  isSupported().then((supported) => {
    if (!supported || cancelled) return;
    unsubscribe = onMessage(getMessaging(getFirebaseApp()), (payload) => {
      if (payload.data) callback(payload.data as unknown as PushDeepLinkData);
    });
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

// A notification click while a tab is already open (but not focused) is
// handled by the service worker's notificationclick listener, which
// postMessages the deep-link data back to that tab (see
// firebase-messaging-sw.js) rather than doing a full navigation/reload.
export function onPushOpenedFromBackground(callback: (data: PushDeepLinkData) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'push-notification-click' && event.data.data) {
      callback(event.data.data as PushDeepLinkData);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

// Covers the fully-quit case: no tab was open, so the service worker opened
// a fresh one with the deep-link data baked into the URL's query string
// (see firebase-messaging-sw.js) instead of postMessaging it. Read once on
// startup and clean the URL so a refresh doesn't re-trigger the same
// navigation.
export async function getPushThatOpenedAppFromQuit(): Promise<PushDeepLinkData | null> {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  if (!params.has('type')) return null;

  const data = Object.fromEntries(params.entries()) as PushDeepLinkData;
  window.history.replaceState(null, '', window.location.pathname);
  return data;
}

// No-op here — web's background handling lives entirely in the service
// worker file, registered lazily by getPushToken() above, not in the main
// JS bundle (there's nothing to register early at app startup on web).
export function registerBackgroundHandler(): void {}
