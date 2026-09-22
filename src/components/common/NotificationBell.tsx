import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../../navigation/types';
import { getUnreadNotificationCount } from '../../services/api/notifications.api';
import { onNotificationReceived } from '../../services/notifications/notificationEvents';
import { COLORS, FONTS } from '../../utils/constants';

// Self-contained (fetches its own unread count, refetches on focus) so every
// screen that wants it just drops in <NotificationBell /> — HomeScreen,
// FriendsListScreen, and ProfileScreen all show it in a top-right header row.
export function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(() => {
    getUnreadNotificationCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useFocusEffect(loadUnreadCount);

  // Instant bump when a push lands while this bell is already mounted —
  // otherwise the badge would only catch up on the next screen focus.
  useEffect(() => onNotificationReceived(loadUnreadCount), [loadUnreadCount]);

  return (
    <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8} style={styles.bellButton}>
      <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
      {unreadCount > 0 && (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    padding: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: COLORS.statusAlert,
    borderWidth: 1.5,
    borderColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: FONTS.bold,
    lineHeight: 11,
  },
});
