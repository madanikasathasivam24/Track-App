import type { PushDeepLinkData } from '../services/notifications/push';
import { navigationRef } from '../navigation/navigationRef';

// Shared by both push-notification taps (usePushNotifications.ts) and
// in-app notification list taps (NotificationsScreen.tsx) — same data shape,
// same destination, so the deep-link logic lives in one place instead of
// being duplicated (and drifting) across the two entry points.
export function navigateFromNotificationData(data: PushDeepLinkData | null): void {
  if (!data || !navigationRef.isReady()) return;

  if (data.type === 'peer-alert' && data.groupId && data.tripId && data.peerId && data.peerName) {
    navigationRef.navigate('PeerAlertModal', {
      groupId: data.groupId,
      tripId: data.tripId,
      peerId: data.peerId,
      peerName: data.peerName,
      peerAvatarIndex: data.peerAvatarIndex ? Number(data.peerAvatarIndex) : 0,
    });
  } else if (data.type === 'group:message' && data.groupId) {
    navigationRef.navigate('GroupChat', { groupId: data.groupId, groupName: data.groupName ?? 'Group chat' });
  } else if ((data.type === 'trip:started' || data.type === 'trip:arrived') && data.groupId && data.tripId) {
    navigationRef.navigate('LiveMap', {
      groupId: data.groupId,
      tripId: data.tripId,
      tripName: data.tripName ?? 'Trip',
    });
  } else if (
    (data.type === 'trip:ended' || data.type === 'group:member-joined') &&
    data.groupId
  ) {
    navigationRef.navigate('GroupDetails', { groupId: data.groupId });
  } else if (data.type === 'friend-request' || data.type === 'friend-request-accepted' || data.type === 'live-share-started') {
    navigationRef.navigate('Main', { screen: 'Friends' });
  }
}
