import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { NotificationBell } from '../../components/common/NotificationBell';
import { AVATAR_OPTIONS, COLORS, FONTS } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [copied, setCopied] = useState(false);
  // logout() awaits a real network call (unregisterPushToken) before clearing
  // the session — unlike login/signup, the store never tracked its own
  // isSubmitting for it, so a rapid double-tap could fire it twice.
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const onCopyTrackId = async () => {
    if (!user) return;
    await Clipboard.setStringAsync(user.trackId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topRow}>
        <Text style={styles.screenTitle}>Profile</Text>
        <NotificationBell />
      </View>

      <View style={styles.header}>
        {user ? <Image source={AVATAR_OPTIONS[user.avatarIndex]} style={styles.avatar} /> : null}
        <Text style={styles.name}>{user?.name ?? 'Track user'}</Text>
        <Text style={styles.phone}>{user?.phoneNumber}</Text>
      </View>

      {user ? (
        <View style={styles.trackIdCard}>
          <Text style={styles.trackIdLabel}>Share this ID to add friends</Text>
          <View style={styles.trackIdRow}>
            <Text style={styles.trackIdValue}>{user.trackId}</Text>
            <Pressable onPress={onCopyTrackId} hitSlop={8} style={styles.copyButton}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={COLORS.primary} />
              <Text style={styles.copyButtonLabel}>{copied ? 'Copied' : 'Copy'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Button
        label="Log out"
        variant="secondary"
        onPress={onLogout}
        loading={isLoggingOut}
        disabled={isLoggingOut}
        style={styles.logout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  phone: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  trackIdCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  trackIdLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  trackIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackIdValue: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  copyButtonLabel: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  logout: {
    marginTop: 'auto',
    marginBottom: 24,
  },
});
