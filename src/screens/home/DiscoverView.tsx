import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { FreeMapView } from '../../components/map/FreeMapView';
import type { FreeMapViewHandle, FreeMapViewRegion, MapMarkerSpec, PoiCategory } from '../../components/map/FreeMapView.types';
import { autocompletePlaces, getPlaceLocation } from '../../services/api/routing.api';
import type { PlaceSuggestion } from '../../services/api/routing.api';
import { fetchNearbyPlaces, type PoiResult } from '../../services/api/poi.api';
import { COLORS, FONTS } from '../../utils/constants';
import { Skeleton } from '../../components/ui/Skeleton';
import type { LatLng } from '../../utils/polyline';

const DEFAULT_DELTA = 0.02;
const DEBOUNCE_MS = 300;
// Kept generous — the free Overpass API this feeds (poi.api.ts) rate-limits
// aggressively, so re-querying on every small pan/zoom trips it almost
// immediately. Combined with the "moved far enough" check below and poi.api.ts's
// own result cache, this keeps requests to roughly one per meaningful pan.
const POI_REFETCH_DEBOUNCE_MS = 1500;
const POI_PIN_COLOR = '#D97744';
// Skip a refetch unless the map center moved by roughly this fraction of the
// current viewport — avoids re-querying for tiny drifts/inertia settling.
const MIN_REFETCH_MOVE_FRACTION = 0.4;

const CATEGORIES: { id: PoiCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'restaurant', label: 'Restaurants', icon: 'restaurant' },
  { id: 'cafe', label: 'Coffee', icon: 'cafe' },
  { id: 'bakery', label: 'Bakery', icon: 'storefront' },
  { id: 'hospital', label: 'Hospitals', icon: 'medkit' },
];

export interface DirectionsDestination {
  label: string;
  coords: LatLng;
}

function hasMovedEnough(prev: FreeMapViewRegion | null, next: FreeMapViewRegion): boolean {
  if (!prev) return true;
  const threshold = Math.max(next.latitudeDelta, next.longitudeDelta) * MIN_REFETCH_MOVE_FRACTION;
  const moved = Math.abs(next.latitude - prev.latitude) > threshold || Math.abs(next.longitude - prev.longitude) > threshold;
  const zoomedEnough = Math.abs(next.latitudeDelta - prev.latitudeDelta) > prev.latitudeDelta * 0.3;
  return moved || zoomedEnough;
}

interface DiscoverViewProps {
  onGetDirections: (destination: DirectionsDestination) => void;
}

export function DiscoverView({ onGetDirections }: DiscoverViewProps) {
  const mapRef = useRef<FreeMapViewHandle>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueriedRegionRef = useRef<FreeMapViewRegion | null>(null);

  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [region, setRegion] = useState<FreeMapViewRegion | null>(null);
  // Seeded from a cached fix (near-instant) purely to mount the map right
  // away instead of leaving native map init (Play Services loading, tiles,
  // styling) blocked behind a full fresh GPS lock — `region` above still
  // waits for the precise fix, since it also drives the nearby-POI query.
  const [quickRegion, setQuickRegion] = useState<FreeMapViewRegion | null>(null);

  const [activeCategories, setActiveCategories] = useState<PoiCategory[]>(['restaurant', 'cafe', 'bakery']);
  const [places, setPlaces] = useState<PoiResult[]>([]);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedPlace, setSearchedPlace] = useState<{ description: string; coords: LatLng } | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        setQuickRegion({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        });
      }

      const current = await Location.getCurrentPositionAsync({});
      const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      const initialRegion = { ...coords, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA };
      setMyLocation(coords);
      setRegion(initialRegion);
      mapRef.current?.recenter(coords);
    })();
  }, []);

  const loadPlaces = useCallback(async (r: FreeMapViewRegion, categories: PoiCategory[]) => {
    if (categories.length === 0) {
      setPlaces([]);
      return;
    }
    try {
      const results = await fetchNearbyPlaces(r, categories);
      setPlaces(results);
      lastQueriedRegionRef.current = r;
    } catch {
      // Discover is best-effort browsing, not a critical path — fail quietly.
    }
  }, []);

  // Initial fetch once we know where we are.
  useEffect(() => {
    if (region) loadPlaces(region, activeCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(region)]);

  const onRegionChange = useCallback(
    (r: FreeMapViewRegion) => {
      setRegion(r);
      if (poiDebounceRef.current) clearTimeout(poiDebounceRef.current);
      poiDebounceRef.current = setTimeout(() => {
        if (!hasMovedEnough(lastQueriedRegionRef.current, r)) return;
        loadPlaces(r, activeCategories);
      }, POI_REFETCH_DEBOUNCE_MS);
    },
    [activeCategories, loadPlaces]
  );

  const onToggleCategory = useCallback(
    (category: PoiCategory) => {
      setActiveCategories((prev) => {
        const next = prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category];
        if (region) loadPlaces(region, next);
        return next;
      });
    },
    [region, loadPlaces]
  );

  const onChangeQuery = useCallback(
    (text: string) => {
      setQuery(text);
      setSearchedPlace(null);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (!text.trim()) {
        setSuggestions([]);
        return;
      }
      searchDebounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await autocompletePlaces(text, myLocation);
          setSuggestions(results);
        } catch {
          setSuggestions([]);
        } finally {
          setIsSearching(false);
        }
      }, DEBOUNCE_MS);
    },
    [myLocation]
  );

  const onSelectSuggestion = useCallback(async (suggestion: PlaceSuggestion) => {
    setQuery(suggestion.description);
    setSuggestions([]);
    try {
      const coords = await getPlaceLocation(suggestion.id);
      setSearchedPlace({ description: suggestion.description, coords });
      mapRef.current?.fitToCoordinates([coords]);
    } catch {
      // Best-effort — leave the map as-is if the place can't be resolved.
    }
  }, []);

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = myLocation
      ? [{ id: 'me', coordinate: myLocation, color: COLORS.primary, pulse: true }]
      : [];
    places.forEach((p) => {
      list.push({ id: p.id, coordinate: p.coords, color: POI_PIN_COLOR, label: p.name, category: p.category });
    });
    if (searchedPlace) {
      list.push({ id: 'searched', coordinate: searchedPlace.coords, color: COLORS.statusAlert, label: searchedPlace.description });
    }
    return list;
  }, [myLocation, places, searchedPlace]);

  const selectedPlace = useMemo<DirectionsDestination | null>(() => {
    if (!selectedPlaceId) return null;
    if (selectedPlaceId === 'searched' && searchedPlace) {
      return { label: searchedPlace.description, coords: searchedPlace.coords };
    }
    const place = places.find((p) => p.id === selectedPlaceId);
    return place ? { label: place.name, coords: place.coords } : null;
  }, [selectedPlaceId, places, searchedPlace]);

  const onMarkerPress = useCallback((markerId: string) => {
    if (markerId === 'me') return;
    setSelectedPlaceId(markerId);
  }, []);

  const initialRegion = region ?? quickRegion;

  return (
    <View style={styles.container}>
      {initialRegion ? (
        <FreeMapView
          ref={mapRef}
          initialRegion={initialRegion}
          markers={markers}
          onRegionChange={onRegionChange}
          onMarkerPress={onMarkerPress}
        />
      ) : (
        <View style={styles.mapPlaceholder}>
          {permissionDenied ? (
            <Text style={styles.mapPlaceholderText}>
              Location permission is off — enable it in Settings to explore nearby places.
            </Text>
          ) : (
            <Skeleton width="100%" height="100%" borderRadius={0} />
          )}
        </View>
      )}

      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.searchPill}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Find a place"
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={onChangeQuery}
          />
          {isSearching ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map((item) => (
              <Pressable key={item.id} style={styles.suggestionRow} onPress={() => onSelectSuggestion(item)}>
                <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.suggestionText} numberOfLines={1}>
                  {item.description}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.chipRow}>
          {CATEGORIES.map((category) => {
            const active = activeCategories.includes(category.id);
            return (
              <Pressable
                key={category.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onToggleCategory(category.id)}
              >
                <Ionicons name={category.icon} size={15} color={active ? '#FFFFFF' : COLORS.text} />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{category.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {selectedPlace && (
        <View style={styles.calloutCard}>
          <View style={styles.calloutInfo}>
            <Text style={styles.calloutTitle} numberOfLines={1}>
              {selectedPlace.label}
            </Text>
          </View>
          <Pressable onPress={() => setSelectedPlaceId(null)} hitSlop={8} style={styles.calloutClose}>
            <Ionicons name="close" size={18} color={COLORS.textMuted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.calloutButton, pressed && styles.pressed]}
            onPress={() => onGetDirections(selectedPlace)}
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
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  mapPlaceholderText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  topOverlay: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  suggestions: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
  calloutCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
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
