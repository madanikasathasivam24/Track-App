import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type MapPressEvent, type Region } from 'react-native-maps';
import { MarkerContent } from './MarkerContent';
import { ROUTE_LINE_COLOR, TRACK_MAP_STYLE_GOOGLE } from './mapStyle';
import type { FreeMapViewHandle, FreeMapViewProps, MapMarkerSpec } from './FreeMapView.types';

const CAMERA_FIT_PADDING = { top: 80, right: 60, bottom: 220, left: 60 };

// Cloud-based styling (a Map ID resolving to a style configured in Cloud
// Console) initializes measurably faster than client-side customMapStyle —
// the JSON is applied server-side before tiles are ever sent, instead of
// being parsed and applied to already-rendered tiles on-device. Falls back to
// the old client-side style when a platform's Map ID isn't configured yet
// (Map IDs are per-platform — see .env.example — so this stays broken-safe
// until both are created in Cloud Console, not an all-or-nothing switch).
const GOOGLE_MAP_ID = Platform.select({
  android: process.env.EXPO_PUBLIC_GOOGLE_MAP_ID_ANDROID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_MAP_ID_IOS,
});

// How long (ms) a non-avatar marker (dot/POI label, nothing async to load)
// re-renders its bitmap after its visual content changes, before Android
// stops tracking it again — see TrackedMarker below.
const TRACKS_VIEW_CHANGES_SETTLE_MS = 300;

// Avatar markers instead wait for the image's own onLoad (below), since a
// fixed timer raced the async decode and sometimes lost — this is just the
// safety-net upper bound in case onLoad never fires (e.g. a subsequent prop
// change re-arms tracking for an already-cached image, which may not refire
// onLoad), so tracksViewChanges always eventually turns off either way.
const AVATAR_TRACKS_VIEW_CHANGES_MAX_MS = 1200;

// react-native-maps' <Marker> defaults tracksViewChanges to true on Android,
// which re-snapshots a custom marker's view to a bitmap on every single
// change to that view. Avatar markers with `pulse: true` render via
// PulsingDot, which runs an infinite Reanimated loop — left at the default,
// every avatar marker gets continuously re-snapshotted in lockstep with that
// animation, which is both a severe performance drain (the map feeling slow
// with several friends/members on screen) and the reason avatar images can
// end up missing (the async image decode loses the race against the
// snapshot under that CPU load, especially in a release build). Instead,
// only track changes for a brief window right after the marker's actual
// content changes (not its coordinate, which react-native-maps repositions
// natively without needing a content re-snapshot, and not the pulsing ring's
// own animation, which runs on the native thread invisible to this effect).
function TrackedMarker({ marker, onPress }: { marker: MapMarkerSpec; onPress?: () => void }) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const hasAvatar = marker.avatarIndex !== undefined;

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(
      () => setTracksViewChanges(false),
      hasAvatar ? AVATAR_TRACKS_VIEW_CHANGES_MAX_MS : TRACKS_VIEW_CHANGES_SETTLE_MS
    );
    return () => clearTimeout(timer);
  }, [hasAvatar, marker.color, marker.pulse, marker.label, marker.category, marker.avatarIndex, marker.name, marker.etaMinutes, marker.unreadCount]);

  const onAvatarLoad = useCallback(() => setTracksViewChanges(false), []);

  return (
    <Marker
      identifier={marker.id}
      coordinate={marker.coordinate}
      anchor={marker.label || (marker.name && marker.etaMinutes === undefined) ? { x: 0.5, y: 1 } : { x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
    >
      <MarkerContent marker={marker} onAvatarLoad={hasAvatar ? onAvatarLoad : undefined} />
    </Marker>
  );
}

export const FreeMapView = forwardRef<FreeMapViewHandle, FreeMapViewProps>(
  ({ initialRegion, markers, polyline, routes, showsTraffic, onRegionChange, onMarkerPress, onMapPress }, ref) => {
    const mapRef = useRef<MapView>(null);

    useImperativeHandle(ref, () => ({
      fitToCoordinates: (coords) => {
        if (coords.length === 0) return;
        mapRef.current?.fitToCoordinates(coords, { edgePadding: CAMERA_FIT_PADDING, animated: true });
      },
      recenter: (coord) => {
        mapRef.current?.animateCamera({ center: coord }, { duration: 600 });
      },
    }));

    const handleRegionChangeComplete = useCallback(
      (region: Region) => {
        onRegionChange?.(region);
      },
      [onRegionChange]
    );

    const handlePress = useCallback(
      (event: MapPressEvent) => {
        onMapPress?.(event.nativeEvent.coordinate);
      },
      [onMapPress]
    );

    return (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        {...(GOOGLE_MAP_ID ? { googleMapId: GOOGLE_MAP_ID } : { customMapStyle: TRACK_MAP_STYLE_GOOGLE })}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={handlePress}
        showsCompass={false}
        toolbarEnabled={false}
        showsTraffic={showsTraffic}
      >
        {polyline && polyline.length > 0 && (
          <Polyline coordinates={polyline} strokeColor={ROUTE_LINE_COLOR} strokeWidth={5} lineCap="round" lineJoin="round" />
        )}

        {routes?.map((r) => (
          <Polyline key={r.id} coordinates={r.coords} strokeColor={r.color} strokeWidth={4} lineCap="round" lineJoin="round" />
        ))}

        {markers.map((marker) => (
          <TrackedMarker key={marker.id} marker={marker} onPress={() => onMarkerPress?.(marker.id)} />
        ))}
      </MapView>
    );
  }
);
FreeMapView.displayName = 'FreeMapView';
