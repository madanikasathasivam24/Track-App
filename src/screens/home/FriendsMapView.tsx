import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FreeMapView } from '../../components/map/FreeMapView';
import { RecenterButton } from '../../components/map/RecenterButton';
import { Skeleton } from '../../components/ui/Skeleton';
import type { FreeMapViewHandle, FreeMapViewRegion, MapMarkerSpec } from '../../components/map/FreeMapView.types';
import { getFriends } from '../../services/api/friends.api';
import { onNotificationReceived } from '../../services/notifications/notificationEvents';
import { useFriendLiveLocation } from '../../hooks/useFriendLiveLocation';
import { useFriendPositions } from '../../hooks/useFriendPositions';
import { useAuthStore } from '../../store/authStore';
import { COLORS, FONTS } from '../../utils/constants';
import type { PublicUser } from '../../types/models';
import type { DirectionsDestination } from './DiscoverView';

const DEFAULT_DELTA = 0.02;

interface FriendsMapViewProps {
  onGetDirections: (destination: DirectionsDestination) => void;
}

export function FriendsMapView({ onGetDirections }: FriendsMapViewProps) {
  const mapRef = useRef<FreeMapViewHandle>(null);
  const currentUser = useAuthStore((s) => s.user);
  // Watching + broadcasting only while this tab is mounted — matches the
  // "sharing" concept: friends see you here only while you're looking too.
  const myLocation = useFriendLiveLocation();
  const friendPositions = useFriendPositions();

  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  // Seeded from a cached fix (near-instant) purely to mount the map right
  // away instead of leaving native map init blocked behind
  // useFriendLiveLocation's fresh GPS lock — never fed into that hook's
  // broadcast, unlike myLocation above, which is both the "me" marker and
  // what friends actually see as your live position.
  const [quickRegion, setQuickRegion] = useState<FreeMapViewRegion | null>(null);
  const hasRecenteredRef = useRef(false);

  const loadFriends = useCallback(() => {
    getFriends()
      .then(setFriends)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // A newly-accepted friend wouldn't otherwise show up here until the whole
  // Explore tab (and this component along with it, since it's swapped in via
  // a mode ternary) remounted — refetch on Explore regaining focus and
  // instantly on a friend-request-accepted push, same live-update pattern as
  // FriendsListScreen.
  useFocusEffect(loadFriends);

  useEffect(
    () =>
      onNotificationReceived((data) => {
        if (data.type === 'friend-request-accepted') loadFriends();
      }),
    [loadFriends]
  );

  useEffect(() => {
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
  }, []);

  // Snaps the camera to the precise fix the first time useFriendLiveLocation
  // resolves one, correcting away from the quick/cached region above — only
  // once, so it doesn't fight the RecenterButton by re-snapping on every
  // subsequent GPS tick while the user has panned elsewhere.
  useEffect(() => {
    if (myLocation && !hasRecenteredRef.current) {
      hasRecenteredRef.current = true;
      mapRef.current?.recenter(myLocation);
    }
  }, [myLocation]);

  // Guards against a stale position arriving right after an unfriend.
  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = [];
    if (myLocation && currentUser) {
      list.push({
        id: 'me',
        coordinate: myLocation,
        color: COLORS.primary,
        pulse: true,
        avatarIndex: currentUser.avatarIndex,
        name: 'You',
      });
    }
    friendPositions.forEach((position) => {
      if (!friendIds.has(position.id)) return;
      list.push({
        id: position.id,
        coordinate: { latitude: position.latitude, longitude: position.longitude },
        color: COLORS.statusActive,
        pulse: true,
        avatarIndex: position.avatarIndex,
        name: position.name,
      });
    });
    return list;
  }, [myLocation, currentUser, friendPositions, friendIds]);

  const selectedFriend = useMemo<DirectionsDestination | null>(() => {
    if (!selectedFriendId) return null;
    const position = friendPositions.find((p) => p.id === selectedFriendId);
    return position
      ? { label: position.name, coords: { latitude: position.latitude, longitude: position.longitude } }
      : null;
  }, [selectedFriendId, friendPositions]);

  // See LiveMapScreen's identical effect — without this, a friend farther
  // away than the initial fixed-delta region stays off-screen indefinitely.
  const previousMarkerCountRef = useRef(0);
  useEffect(() => {
    if (markers.length > previousMarkerCountRef.current && markers.length > 1) {
      mapRef.current?.fitToCoordinates(markers.map((m) => m.coordinate));
    }
    previousMarkerCountRef.current = markers.length;
  }, [markers]);

  const onMarkerPress = useCallback((markerId: string) => {
    if (markerId === 'me') return;
    setSelectedFriendId(markerId);
  }, []);

  const onRecenter = useCallback(() => {
    if (myLocation) mapRef.current?.recenter(myLocation);
  }, [myLocation]);

  const initialRegion: FreeMapViewRegion | null = myLocation
    ? { ...myLocation, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }
    : quickRegion;

  return (
    <View style={styles.container}>
      {initialRegion ? (
        <FreeMapView ref={mapRef} initialRegion={initialRegion} markers={markers} onMarkerPress={onMarkerPress} />
      ) : (
        <Skeleton width="100%" height="100%" borderRadius={0} />
      )}

      {initialRegion && friendPositions.length === 0 && (
        <View style={styles.emptyBanner}>
          <Text style={styles.emptyBannerText}>
            {friends.length === 0
              ? "You don't have any friends yet — add some to see them here."
              : 'None of your friends are sharing their location right now.'}
          </Text>
        </View>
      )}

      {initialRegion && <RecenterButton onPress={onRecenter} style={styles.recenterButton} />}

      {selectedFriend && (
        <View style={styles.calloutCard}>
          <View style={styles.calloutInfo}>
            <Text style={styles.calloutTitle} numberOfLines={1}>
              {selectedFriend.label}
            </Text>
          </View>
          <Pressable onPress={() => setSelectedFriendId(null)} hitSlop={8} style={styles.calloutClose}>
            <Ionicons name="close" size={18} color={COLORS.textMuted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.calloutButton, pressed && styles.pressed]}
            onPress={() => onGetDirections(selectedFriend)}
          >
            <Ionicons name="navigate" size={16} color="#FFFFFF" />
            <Text style={styles.calloutButtonLabel}>Directions</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyBanner: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  emptyBannerText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 100,
  },
  calloutCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  calloutInfo: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  calloutClose: {
    padding: 4,
  },
  calloutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  calloutButtonLabel: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.85,
  },
});
