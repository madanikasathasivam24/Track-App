import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { FreeMapView } from '../../components/map/FreeMapView';
import { RecenterButton } from '../../components/map/RecenterButton';
import { TripInfoModal } from '../../components/group/TripInfoModal';
import type { FreeMapViewHandle, FreeMapViewRegion, MapMarkerSpec, MapRouteSpec } from '../../components/map/FreeMapView.types';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useMemberPositions } from '../../hooks/useMemberPositions';
import { useAuthStore } from '../../store/authStore';
import { useAlertStore, unreadKey } from '../../store/alertStore';
import { getUnseenAlertCounts } from '../../services/api/alerts.api';
import { COLORS, FONTS } from '../../utils/constants';

const DEFAULT_DELTA = 0.03;
// Cycled per member so overlapping routes stay visually distinguishable —
// not a general-purpose palette, just enough distinct hues for a trip's
// worth of people.
const ROUTE_COLORS = ['#3D5AFE', '#FF6D00', '#00BFA5', '#D500F9', '#FFC400', '#00B8D4'];

type Props = NativeStackScreenProps<RootStackParamList, 'LiveMap'>;

export function LiveMapScreen({ route, navigation }: Props) {
  const { groupId, tripId, tripName, destLat, destLng, destLabel } = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const mapRef = useRef<FreeMapViewHandle>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Broadcasts my own position while this screen is open (send side) and
  // listens for everyone else's, seeded from their last known spot on mount
  // (receive side) — see useLiveLocation.ts/useMemberPositions.ts.
  const myLocation = useLiveLocation(tripId);
  const memberPositions = useMemberPositions(groupId, tripId);

  const hasMyServerPosition = memberPositions.some((p) => p.userId === currentUser?.id);

  // A set destination is already an instant, meaningful anchor (no GPS wait
  // needed — see initialRegion below), so the cached-fix fallback only
  // matters when there isn't one.
  const hasDestination = destLat != null && destLng != null;
  // Seeded from a cached fix (near-instant) purely to mount the map right
  // away instead of leaving native map init blocked behind useLiveLocation's
  // fresh GPS lock — never fed into that hook's broadcast, unlike myLocation
  // above, which is both the "me" marker and what the trip sees as your live
  // position.
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

  // Snaps the camera to the precise fix the first time useLiveLocation
  // resolves one, correcting away from the quick/cached region above — only
  // once (so it doesn't fight the RecenterButton later), and only when there
  // was no destination to anchor on instead, since that's a deliberate
  // default view worth leaving alone once shown.
  useEffect(() => {
    if (hasDestination || hasRecenteredRef.current) return;
    if (myLocation.latitude != null && myLocation.longitude != null) {
      hasRecenteredRef.current = true;
      mapRef.current?.recenter({ latitude: myLocation.latitude, longitude: myLocation.longitude });
    }
  }, [myLocation, hasDestination]);

  // Seeds the persistent unread-alert badge from the backend on open, so it
  // reflects alerts that arrived while this screen (or the whole app) wasn't
  // open — not just ones received live via the socket while already here.
  const unreadCounts = useAlertStore((s) => s.unreadCounts);
  const setUnreadCounts = useAlertStore((s) => s.setUnreadCounts);
  useEffect(() => {
    let cancelled = false;
    getUnseenAlertCounts(groupId, tripId)
      .then((counts) => {
        if (!cancelled) setUnreadCounts(tripId, counts);
      })
      .catch(() => {
        // Best-effort — live socket-driven counts still work without it.
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, tripId, setUnreadCounts]);

  // Tapping another member's marker opens (or starts) a private alert thread
  // with them — the map is the natural entry point for "alert this member",
  // since it's already showing who's on the trip.
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
        name: isMe ? 'You' : member.name,
        etaMinutes:
          member.routeDurationSeconds !== undefined ? Math.round(member.routeDurationSeconds / 60) : undefined,
        unreadCount: isMe ? undefined : unreadCounts[unreadKey(tripId, member.userId)],
      });
    });

    // Covers the brief window before my own broadcast round-trips back
    // through the server and into memberPositions — show my local GPS fix
    // immediately rather than waiting for that.
    if (!hasMyServerPosition && myLocation.latitude != null && myLocation.longitude != null && currentUser) {
      list.push({
        id: currentUser.id,
        coordinate: { latitude: myLocation.latitude, longitude: myLocation.longitude },
        color: COLORS.primary,
        pulse: true,
        avatarIndex: currentUser.avatarIndex,
        name: 'You',
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
  }, [memberPositions, hasMyServerPosition, myLocation, currentUser, destLat, destLng, destLabel, tripName, tripId, unreadCounts]);

  const routes = useMemo<MapRouteSpec[]>(
    () =>
      memberPositions
        .filter((m) => m.routeCoords && m.routeCoords.length > 0)
        .map((m, index) => ({
          id: m.userId,
          coords: m.routeCoords!,
          color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        })),
    [memberPositions]
  );

  // Fits the camera to everyone currently on the map whenever a new marker
  // appears (another member's position arriving, or the destination being
  // added) — otherwise a member farther away than the initial region's fixed
  // delta stays off-screen indefinitely, since nothing else ever moves the
  // camera besides the manual recenter button.
  const previousMarkerCountRef = useRef(0);
  useEffect(() => {
    if (markers.length > previousMarkerCountRef.current && markers.length > 1) {
      mapRef.current?.fitToCoordinates(markers.map((m) => m.coordinate));
    }
    previousMarkerCountRef.current = markers.length;
  }, [markers]);

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
        <FreeMapView ref={mapRef} initialRegion={initialRegion} markers={markers} routes={routes} onMarkerPress={onMarkerPress} />
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
          <Pressable onPress={() => setIsInfoOpen(true)} hitSlop={8} style={styles.infoButton}>
            <Ionicons name="information-circle-outline" size={24} color={COLORS.text} />
          </Pressable>
        </View>
      </SafeAreaView>

      {initialRegion && <RecenterButton onPress={onRecenter} style={styles.recenterButton} />}

      <TripInfoModal visible={isInfoOpen} onClose={() => setIsInfoOpen(false)} groupId={groupId} tripId={tripId} />
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
  infoButton: {
    padding: 2,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
  },
});
