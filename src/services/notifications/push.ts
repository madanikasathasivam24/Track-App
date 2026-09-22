import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  getInitialNotification,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

// Deep-link hints attached to every push's `data` payload — see
// NotificationsService.notify on the backend, called from ChatService,
// AlertsService, FriendsService, LiveShareService, GroupsService, and
// LocationsService. Every field besides `type` is optional because FCM data
// payloads are always plain strings and we only need enough to navigate
// straight to the right screen on tap.
export interface PushDeepLinkData {
  type?:
    | 'group:message'
    | 'peer-alert'
    | 'friend-request'
    | 'friend-request-accepted'
    | 'live-share-started'
    | 'group:member-joined'
    | 'trip:started'
    | 'trip:ended'
    | 'trip:arrived';
  groupId?: string;
  groupName?: string;
  tripId?: string;
  tripName?: string;
  peerId?: string;
  peerName?: string;
  peerAvatarIndex?: string;
}

function messagingInstance() {
  return getMessaging(getApp());
}

// RNFirebase's own requestPermission()/hasPermission() are deprecated
// upstream in favor of expo-notifications for the permission prompt itself
// (see https://github.com/invertase/react-native-firebase/issues/6283) —
// token/message handling below still goes through RNFirebase, since that's
// what actually talks to FCM.
export async function requestPushPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Without an explicit channel, an incoming FCM message falls into whatever
// ambiguous default channel Android/FCM auto-creates — on some Android
// versions and OEM skins that shows no heads-up banner or sound at all, which
// is indistinguishable from push not arriving unless you check server logs
// (a push can succeed server-side and still never visibly alert the device).
// Track-api's NotificationsService references this same 'default' id in its
// FCM payload's android.notification.channelId so pushes explicitly land
// here instead of the ambiguous fallback.
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Track notifications',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function getPushToken(): Promise<string | null> {
  try {
    return await getToken(messagingInstance());
  } catch {
    return null;
  }
}

export function getPushPlatform(): 'android' | 'ios' | 'web' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export function onPushTokenRefresh(callback: (token: string) => void): () => void {
  return onTokenRefresh(messagingInstance(), callback);
}

// Only fires while the app is in the foreground — background/quit-state
// notification-type messages are auto-displayed by the OS without any app
// code running, which is enough for now (foreground already has the live
// socket event, since the backend only pushes to recipients with no
// connected socket — see LocationsGateway.isUserConnected).
export function onForegroundPush(callback: (data: PushDeepLinkData) => void): () => void {
  return onMessage(messagingInstance(), (remoteMessage) => {
    if (remoteMessage.data) callback(remoteMessage.data as unknown as PushDeepLinkData);
  });
}

// Fires when a background-state notification is tapped, opening the app.
export function onPushOpenedFromBackground(callback: (data: PushDeepLinkData) => void): () => void {
  return onNotificationOpenedApp(messagingInstance(), (remoteMessage) => {
    if (remoteMessage?.data) callback(remoteMessage.data as unknown as PushDeepLinkData);
  });
}

// Checked once on cold start — non-null if the app was fully quit and a
// notification tap is what launched it.
export async function getPushThatOpenedAppFromQuit(): Promise<PushDeepLinkData | null> {
  const remoteMessage = await getInitialNotification(messagingInstance());
  return remoteMessage?.data ? (remoteMessage.data as unknown as PushDeepLinkData) : null;
}

// Must be registered as early as possible (index.ts, before the React tree
// mounts) — required by RNFirebase for Android to deliver messages while the
// app is backgrounded/killed. We don't need to do anything with the message
// ourselves (a notification-type payload is already auto-displayed by the
// OS), so this is just a required no-op registration.
export function registerBackgroundHandler(): void {
  setBackgroundMessageHandler(messagingInstance(), async () => {});
}
