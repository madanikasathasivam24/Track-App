import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  requestPushPermission,
  ensureAndroidNotificationChannel,
  getPushToken,
  getPushPlatform,
  onPushTokenRefresh,
  onForegroundPush,
  onPushOpenedFromBackground,
  getPushThatOpenedAppFromQuit,
} from '../services/notifications/push';
import { registerPushToken } from '../services/api/push.api';
import { navigateFromNotificationData } from '../utils/notificationNav';
import { emitNotificationReceived } from '../services/notifications/notificationEvents';

// Registers this device for FCM push once logged in (permission + token +
// backend registration), keeps the backend's copy fresh on token rotation,
// and deep-links straight into the relevant thread when a push notification
// is tapped — whether the app was backgrounded or fully quit. Mounted once,
// near the top of the app (see RootNavigator), same as the socket-connect
// effect it complements.
export function usePushNotifications(): void {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        await ensureAndroidNotificationChannel();
      } catch {
        // Channel creation failing (whatever the native-side reason) must not
        // block the rest of this chain — worst case, a push falls back to
        // whatever channel the manifest/FCM SDK defaults to, which is still
        // strictly better than never registering a push token at all.
      }
      const granted = await requestPushPermission();
      if (!granted || cancelled) return;
      const pushToken = await getPushToken();
      if (!pushToken || cancelled) return;
      registerPushToken(pushToken, getPushPlatform()).catch(() => {});
    })();

    const unsubscribeRefresh = onPushTokenRefresh((newToken) => {
      registerPushToken(newToken, getPushPlatform()).catch(() => {});
    });

    return () => {
      cancelled = true;
      unsubscribeRefresh();
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    getPushThatOpenedAppFromQuit().then(navigateFromNotificationData);

    return onPushOpenedFromBackground(navigateFromNotificationData);
  }, [token]);

  // A push that arrives while the app is already open doesn't get the OS
  // tray treatment, so nothing shows it unless we do — feeds NotificationBell
  // and NotificationsScreen an instant signal instead of leaving the update
  // to wait for their next focus-triggered refetch.
  useEffect(() => {
    if (!token) return;
    return onForegroundPush(emitNotificationReceived);
  }, [token]);
}
