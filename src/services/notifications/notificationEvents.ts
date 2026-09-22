import type { PushDeepLinkData } from './push';

// Lets usePushNotifications' foreground-push listener notify any mounted
// NotificationBell/NotificationsScreen instances instantly, without them
// polling. A Set (not a single slot like sessionEvents.ts) because
// NotificationBell is mounted on several tabs (Groups/Friends/Profile)
// simultaneously — React Navigation keeps inactive tab screens alive, so more
// than one bell can be listening at once.
type Listener = (data: PushDeepLinkData) => void;

const listeners = new Set<Listener>();

export function onNotificationReceived(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitNotificationReceived(data: PushDeepLinkData): void {
  listeners.forEach((fn) => fn(data));
}
