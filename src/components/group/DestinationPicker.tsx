import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FreeMapView } from '../map/FreeMapView';
import type { FreeMapViewHandle, FreeMapViewRegion, MapMarkerSpec } from '../map/FreeMapView.types';
import { autocompletePlaces, getPlaceLocation } from '../../services/api/routing.api';
import type { PlaceSuggestion } from '../../services/api/routing.api';
import { COLORS, FONTS } from '../../utils/constants';
import type { LatLng } from '../../utils/polyline';

const DEBOUNCE_MS = 300;
const PICKER_DELTA = 0.02;

export interface DestinationValue {
  label: string;
  coords: LatLng | null;
}

interface DestinationPickerProps {
  value: DestinationValue;
  onChange: (value: DestinationValue) => void;
  biasCoord: LatLng;
}

// Search-or-tap destination picker for the Create Trip sheet — mirrors
// DirectionsView.tsx's autocomplete pattern, plus a small embedded map that
// can be tapped directly to drop a pin (via FreeMapView's onMapPress).
export function DestinationPicker({ value, onChange, biasCoord }: DestinationPickerProps) {
  const mapRef = useRef<FreeMapViewHandle>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState(value.label);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const onChangeQuery = useCallback(
    (text: string) => {
      setQuery(text);
      onChange({ label: text, coords: null });

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim()) {
        setSuggestions([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await autocompletePlaces(text, biasCoord);
          setSuggestions(results);
        } catch {
          setSuggestions([]);
        } finally {
          setIsSearching(false);
        }
      }, DEBOUNCE_MS);
    },
    [onChange, biasCoord]
  );

  const onSelectSuggestion = useCallback(
    async (suggestion: PlaceSuggestion) => {
      setQuery(suggestion.description);
      setSuggestions([]);
      try {
        const coords = await getPlaceLocation(suggestion.id);
        onChange({ label: suggestion.description, coords });
        mapRef.current?.fitToCoordinates([coords]);
      } catch {
        // Best-effort — leave the field text updated but coords unset if the
        // place can't be resolved; onChange already ran with coords: null
        // from onChangeQuery, so the picker just won't have a pin yet.
      }
    },
    [onChange]
  );

  const onMapPress = useCallback(
    (coord: LatLng) => {
      const label = `Pinned location (${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)})`;
      setQuery(label);
      setSuggestions([]);
      onChange({ label, coords: coord });
    },
    [onChange]
  );

  const markers: MapMarkerSpec[] = value.coords
    ? [{ id: 'destination', coordinate: value.coords, color: COLORS.statusAlert }]
    : [];

  const initialRegion: FreeMapViewRegion = { ...biasCoord, latitudeDelta: PICKER_DELTA, longitudeDelta: PICKER_DELTA };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Search or tap the map"
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
              <Text style={styles.suggestionText} numberOfLines={1}>
                {item.description}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.mapWrap}>
        <FreeMapView ref={mapRef} initialRegion={initialRegion} markers={markers} onMapPress={onMapPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  suggestions: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  mapWrap: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
