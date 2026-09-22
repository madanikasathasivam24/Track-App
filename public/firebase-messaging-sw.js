// Handles FCM push notifications while the tab isn't focused (or the app is
// closed) — the web counterpart of RNFirebase's native background handler
// (see src/services/notifications/push.ts's registerBackgroundHandler).
// Service workers can't read env vars or `import` the modular SDK cleanly,
// so this uses the compat build loaded via importScripts, and its Firebase
// config is passed in through the registration URL's query string by
// push.web.ts rather than being baked in here (these are client-safe values,
// not secrets — same as any other Firebase web config).
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

const params = new URL(location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

// A `notification` field (which the backend always sets — see
// NotificationsService.sendToUser) is auto-displayed by the browser without
// this handler needing to call showNotification itself; this only exists to
// attach the `data` payload's deep-link hints so notificationclick below can
// read them back.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Track', {
    body,
    icon: '/favicon.ico',
    data: payload.data,
  });
});

// Tapping the notification deep-links into the exact thread: if a tab is
// already open, postMessage the deep-link data to it directly (push.web.ts
// listens and forwards it through the same navigateFromPushData path the
// native tap handlers use); if not, open a fresh tab with the data baked
// into the URL's query string instead, since there's no live JS context yet
// to postMessage to — push.web.ts's getPushThatOpenedAppFromQuit reads it
// back out of the URL on that first load.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        clients[0].postMessage({ type: 'push-notification-click', data });
        return clients[0].focus();
      }
      const query = new URLSearchParams(data).toString();
      return self.clients.openWindow(query ? `/?${query}` : '/');
    })
  );
});
