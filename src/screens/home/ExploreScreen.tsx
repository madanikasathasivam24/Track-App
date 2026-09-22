import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { DirectionsView } from './DirectionsView';
import type { DirectionsDestination } from './DiscoverView';
import { FriendsMapView } from './FriendsMapView';
import { COLORS, FONTS } from '../../utils/constants';
import type { MainTabsParamList } from '../../navigation/types';

// Explore (nearby places) is hidden for now — only Friends and Directions are
// shown. DiscoverView/poi.api.ts are left in place to bring back later.
type Mode = 'friends' | 'directions';

const TABS: { id: Mode; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'directions', label: 'Directions' },
];

type Props = BottomTabScreenProps<MainTabsParamList, 'Explore'>;

export function ExploreScreen({ route, navigation }: Props) {
  const [mode, setMode] = useState<Mode>('friends');
  const [prefillDestination, setPrefillDestination] = useState<DirectionsDestination | null>(null);

  // Hands a tapped friend off to the Directions tab as a pre-filled destination.
  const onGetDirections = useCallback((destination: DirectionsDestination) => {
    setPrefillDestination(destination);
    setMode('directions');
  }, []);

  const onPrefillConsumed = useCallback(() => setPrefillDestination(null), []);

  // "Track" from another screen (e.g. the Friends list) arrives as a route
  // param rather than the in-tree callback above, since it crosses tabs.
  useEffect(() => {
    const dest = route.params?.trackDestination;
    if (!dest) return;
    setPrefillDestination({ label: dest.label, coords: { latitude: dest.latitude, longitude: dest.longitude } });
    setMode('directions');
    navigation.setParams({ trackDestination: undefined });
  }, [route.params?.trackDestination, navigation]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.content}>
        {/* Both stay mounted permanently (display:none, not unmounted) instead
            of a ternary swap — switching modes used to tear down and recreate
            the whole native map + its markers every time, which raced the
            avatar images' decode against the marker bitmap snapshot (showing
            blank avatars) and reset each view's own camera/position state.
            Keeping both alive avoids the remount entirely. */}
        <View style={[styles.modeLayer, mode !== 'directions' && styles.modeLayerHidden]}>
          <DirectionsView prefillDestination={prefillDestination} onPrefillConsumed={onPrefillConsumed} />
        </View>
        <View style={[styles.modeLayer, mode !== 'friends' && styles.modeLayerHidden]}>
          <FriendsMapView onGetDirections={onGetDirections} />
        </View>
      </SafeAreaView>

      {/* Floats above the app's main bottom tab bar, over the map. */}
      <SafeAreaView edges={['bottom']} style={styles.tabBarWrap} pointerEvents="box-none">
        <View style={styles.modeRow}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              style={[styles.modeButton, mode === tab.id && styles.modeButtonActive]}
              onPress={() => setMode(tab.id)}
            >
              <Text style={[styles.modeLabel, mode === tab.id && styles.modeLabelActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  modeLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modeLayerHidden: {
    display: 'none',
  },
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    padding: 4,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modeButton: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  modeLabel: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  modeLabelActive: {
    color: '#FFFFFF',
  },
});
