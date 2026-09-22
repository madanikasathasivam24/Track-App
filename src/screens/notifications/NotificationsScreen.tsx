import React, { useCallback, useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/api/notifications.api';
import { navigateFromNotificationData } from '../../utils/notificationNav';
import type { PushDeepLinkData } from '../../services/notifications/push';
import { onNotificationReceived } from '../../services/notifications/notificationEvents';
import { useSlowLoad } from '../../hooks/useSlowLoad';
import { useStaleWhileRevalidate } from '../../hooks/useStaleWhileRevalidate';
import { Skeleton } from '../../components/ui/Skeleton';
import { COLORS, FONTS } from '../../utils/constants';
import type { AppNotification } from '../../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const ICON_BY_TYPE: Record<string, keyof typeof Ionicons.glyphMap> = {
  'group:message': 'chatbubble-outline',
  'peer-alert': 'alert-circle-outline',
  'friend-request': 'person-add-outline',
  'friend-request-accepted': 'checkmark-circle-outline',
  'live-share-started': 'location-outline',
  'group:member-joined': 'people-outline',
  'trip:started': 'navigate-outline',
  'trip:ended': 'flag-outline',
  'trip:arrived': 'flag-outline',
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function NotificationsScreen({ navigation }: Props) {
  const { data: notificationsData, setData: setNotificationsRaw, isLoading } = useStaleWhileRevalidate<
    AppNotification[]
  >('notifications', getNotifications);
  const notifications = notificationsData ?? [];
  // Optimistic updaters below assume a resolved array (they only ever run in
  // response to pressing an already-rendered row) — this just satisfies the
  // type, since the cache can theoretically still hold `undefined` before the
  // first load.
  const setNotifications = useCallback(
    (updater: AppNotification[] | ((prev: AppNotification[]) => AppNotification[])) =>
      setNotificationsRaw((prev) =>
        typeof updater === 'function' ? (updater as (p: AppNotification[]) => AppNotification[])(prev ?? []) : updater
      ),
    [setNotificationsRaw]
  );
  const isSlowLoad = useSlowLoad(isLoading);

  // Instant refetch when a push lands while this screen is already open —
  // otherwise the list would only catch up next time the screen refocuses.
  useEffect(
    () =>
      onNotificationReceived(() => {
        getNotifications()
          .then(setNotifications)
          .catch(() => {});
      }),
    [setNotifications]
  );

  const onPressItem = useCallback(
    (item: AppNotification) => {
      if (!item.isRead) {
        setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
        markNotificationRead(item.id).catch(() => {});
      }
      navigation.goBack();
      // Deep-link fires after goBack() so the destination screen lands on
      // top of the tab stack, not on top of this notifications screen.
      const deepLinkData = { ...(item.data ?? {}), type: item.type } as PushDeepLinkData;
      setTimeout(() => navigateFromNotificationData(deepLinkData), 300);
    },
    [navigation]
  );

  const onMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    markAllNotificationsRead().catch(() => {});
  }, []);

  const hasUnread = notifications.some((n) => !n.isRead);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <Pressable style={[styles.row, !item.isRead && styles.rowUnread]} onPress={() => onPressItem(item)}>
        <View style={[styles.iconWrap, !item.isRead && styles.iconWrapUnread]}>
          <Ionicons name={ICON_BY_TYPE[item.type] ?? 'notifications-outline'} size={20} color={item.isRead ? COLORS.textMuted : COLORS.primary} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.rowTime}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </Pressable>
    ),
    [onPressItem]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread && (
          <Pressable onPress={onMarkAllRead} hitSlop={8}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingList}>
          <Skeleton height={64} width="100%" borderRadius={12} />
          <Skeleton height={64} width="100%" borderRadius={12} />
          <Skeleton height={64} width="100%" borderRadius={12} />
          {isSlowLoad ? (
            <Text style={styles.slowLoadText}>Still loading — the server may be waking up, this can take a bit longer than usual.</Text>
          ) : null}
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={40} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList data={notifications} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  markAllText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  loadingList: {
    padding: 16,
    gap: 12,
  },
  slowLoadText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingTop: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  rowUnread: {
    borderColor: COLORS.primary,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: '#EEF1FF',
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  rowBody: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rowTime: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});
