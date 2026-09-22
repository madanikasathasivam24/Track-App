import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { FreeMapView } from '../../components/map/FreeMapView';
import { RecenterButton } from '../../components/map/RecenterButton';
import type { FreeMapViewHandle, FreeMapViewRegion, MapMarkerSpec } from '../../components/map/FreeMapView.types';
import { useFirestoreLiveLocation } from '../../hooks/useFirestoreLiveLocation';
import { useFirestoreMemberPositions } from '../../hooks/useFirestoreMemberPositions';
import { useAuthStore } from '../../store/authStore';
import { COLORS, FONTS } from '../../utils/constants';

const DEFAULT_DELTA = 0.03;

type Props = NativeStackScreenProps<RootStackParamList, 'FirestoreLiveMap'>;

// Firestore-backed counterpart of LiveMapScreen.tsx — same rendering via
// FreeMapView, but sourced from useFirestoreLiveLocation/
// useFirestoreMemberPositions instead of the Socket.IO hooks. A new,
// separate tracking path: LiveMapScreen.tsx is untouched, and there's no
// server-computed route-to-destination here (that's cached per-member on
// Track-api's trip model, which this Firestore path doesn't write to), so no
// `routes` prop is passed to FreeMapView.
export function FirestoreLiveMapScreen({ route, navigation }: Props) {
  const { groupId, tripId, tripName, destLat, destLng, destLabel } = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const mapRef = useRef<FreeMapViewHandle>(null);

  const myLocation = useFirestoreLiveLocation(tripId);
  const memberPositions = useFirestoreMemberPositions(groupId, tripId);

  const hasMyServerPosition = memberPositions.some((p) => p.userId === currentUser?.id);

  // See LiveMapScreen.tsx's identical block for why: a set destination is
  // already an instant, meaningful anchor, so the cached-fix fallback below
  // only matters when there isn't one.
  const hasDestination = destLat != null && destLng != null;
  const [quickRegion, setQuickRegion] = useState<FreeMapViewRegion | null>(null);
  const hasRecenteredRef = useRef(false);

  useEffect(() => {
    if (hasDestination) return;
    Location.getLastKnownPositionAsync()
      .then((last) => {
        if (last) {
          setQuickRegion({
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
            latitudeDelta: DEFAULT_DELTA,
            longitudeDelta: DEFAULT_DELTA,
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasDestination || hasRecenteredRef.current) return;
    if (myLocation.latitude != null && myLocation.longitude != null) {
      hasRecenteredRef.current = true;
      mapRef.current?.recenter({ latitude: myLocation.latitude, longitude: myLocation.longitude });
    }
  }, [myLocation, hasDestination]);

  const onMarkerPress = useCallback(
    (markerId: string) => {
      if (markerId === 'destination' || markerId === currentUser?.id) return;
      const member = memberPositions.find((p) => p.userId === markerId);
      if (!member) return;
      navigation.navigate('PeerAlertModal', {
        groupId,
        tripId,
        tripName,
        peerId: member.userId,
        peerName: member.name,
        peerAvatarIndex: member.avatarIndex,
      });
    },
    [memberPositions, currentUser, navigation, groupId, tripId, tripName]
  );

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = [];

    memberPositions.forEach((member) => {
      const isMe = member.userId === currentUser?.id;
      list.push({
        id: member.userId,
        coordinate: { latitude: member.latitude, longitude: member.longitude },
        color: isMe ? COLORS.primary : COLORS.statusActive,
        pulse: true,
        avatarIndex: member.avatarIndex,
      });
    });

    // Covers the brief window before my own write round-trips back through
    // Firestore and into memberPositions — show my local GPS fix immediately
    // rather than waiting for that (see LiveMapScreen.tsx for the same
    // reasoning on the Socket.IO path).
    if (!hasMyServerPosition && myLocation.latitude != null && myLocation.longitude != null && currentUser) {
      list.push({
        id: currentUser.id,
        coordinate: { latitude: myLocation.latitude, longitude: myLocation.longitude },
        color: COLORS.primary,
        pulse: true,
        avatarIndex: currentUser.avatarIndex,
      });
    }

    if (destLat != null && destLng != null) {
      list.push({
        id: 'destination',
        coordinate: { latitude: destLat, longitude: destLng },
        color: COLORS.statusAlert,
        label: destLabel ?? tripName,
      });
    }

    return list;
  }, [memberPositions, hasMyServerPosition, myLocation, currentUser, destLat, destLng, destLabel, tripName]);

  const onRecenter = useCallback(() => {
    if (myLocation.latitude != null && myLocation.longitude != null) {
      mapRef.current?.recenter({ latitude: myLocation.latitude, longitude: myLocation.longitude });
    }
  }, [myLocation]);

  const initialRegion: FreeMapViewRegion | null =
    myLocation.latitude != null && myLocation.longitude != null
      ? { latitude: myLocation.latitude, longitude: myLocation.longitude, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }
      : hasDestination
        ? { latitude: destLat!, longitude: destLng!, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }
        : quickRegion;

  return (
    <View style={styles.container}>
      {initialRegion ? (
        <FreeMapView ref={mapRef} initialRegion={initialRegion} markers={markers} onMarkerPress={onMarkerPress} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Finding your location…</Text>
        </View>
      )}

      <SafeAreaView style={styles.headerSafeArea} edges={['top']} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tripName}
          </Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaBadgeLabel}>Firestore</Text>
          </View>
        </View>
      </SafeAreaView>

      {initialRegion && <RecenterButton onPress={onRecenter} style={styles.recenterButton} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  placeholderText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  backButton: {
    padding: 2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  betaBadge: {
    backgroundColor: COLORS.background,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  betaBadgeLabel: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
  },
});
