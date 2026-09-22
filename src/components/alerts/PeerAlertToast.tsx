import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAlertStore } from '../../store/alertStore';
import { navigationRef } from '../../navigation/navigationRef';
import { COLORS, FONTS } from '../../utils/constants';

const AUTO_DISMISS_MS = 5000;

// Global banner for an incoming peer alert, mounted once at the app root
// (RootNavigator) so it shows over whatever screen the user is currently on —
// tapping it jumps straight into that thread; ignoring it just times out.
export function PeerAlertToast() {
  const current = useAlertStore((s) => s.incoming[0] ?? null);
  const dismissIncoming = useAlertStore((s) => s.dismissIncoming);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => dismissIncoming(current.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [current, dismissIncoming]);

  if (!current) return null;

  const onPress = () => {
    dismissIncoming(current.id);
    if (navigationRef.isReady()) {
      navigationRef.navigate('PeerAlertModal', {
        groupId: current.groupId,
        tripId: current.tripId,
        peerId: current.senderId,
        peerName: current.sender.name,
        peerAvatarIndex: current.sender.avatarIndex,
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']} pointerEvents="box-none">
      <Pressable onPress={onPress} style={styles.toast}>
        <Text style={styles.name} numberOfLines={1}>
          {current.sender.name}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {current.message}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  toast: {
    margin: 12,
    backgroundColor: COLORS.text,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  name: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  message: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: FONTS.regular,
    fontSize: 13,
    marginTop: 2,
  },
});
