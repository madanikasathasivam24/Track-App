import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AVATAR_OPTIONS, COLORS, FONTS } from '../../utils/constants';
import { PulsingDot } from './PulsingDot';
import { PoiIcon } from './PoiIcon';
import type { MapMarkerSpec } from './FreeMapView.types';

// Shared between native's <Marker> and web's <AdvancedMarker> — both accept
// arbitrary React children for their marker content, so the same visuals
// render pixel-identically on both platforms rather than needing a second,
// DOM-string-built version for web (as the old maplibre-gl implementation did).
interface MarkerContentProps {
  marker: MapMarkerSpec;
  // Native only (see FreeMapView.tsx's TrackedMarker) — fires once the avatar
  // image has actually finished decoding, so tracksViewChanges can turn off
  // right when it's safe instead of guessing with a fixed timer. Unused on
  // web, which has no tracksViewChanges/bitmap-snapshot concept.
  onAvatarLoad?: () => void;
}

export function MarkerContent({ marker, onAvatarLoad }: MarkerContentProps) {
  if (marker.label) {
    return (
      <View style={styles.poiWrap}>
        <View style={styles.poiLabel}>
          <Text style={styles.poiLabelText} numberOfLines={1}>
            {marker.label}
          </Text>
        </View>
        <View style={[styles.poiDot, { backgroundColor: marker.color }]}>
          <PoiIcon category={marker.category} />
        </View>
      </View>
    );
  }

  if (marker.avatarIndex !== undefined) {
    const core = (
      <View style={styles.avatarRing}>
        <Image source={AVATAR_OPTIONS[marker.avatarIndex]} style={styles.avatarImage} onLoad={onAvatarLoad} />
      </View>
    );
    const avatarMarker = marker.pulse ? (
      <PulsingDot color={marker.color} size={40}>
        {core}
      </PulsingDot>
    ) : (
      core
    );

    const withBadge = marker.unreadCount ? (
      <View style={styles.avatarWithBadge}>
        {avatarMarker}
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{marker.unreadCount > 9 ? '9+' : marker.unreadCount}</Text>
        </View>
      </View>
    ) : (
      avatarMarker
    );

    if (!marker.name && marker.etaMinutes === undefined) return withBadge;

    return (
      <View style={styles.avatarWrap}>
        {marker.name ? (
          <View style={styles.nameTag}>
            <Text style={styles.nameTagText} numberOfLines={1}>
              {marker.name}
            </Text>
          </View>
        ) : null}
        {withBadge}
        {marker.etaMinutes !== undefined ? (
          <View style={styles.etaTag}>
            <Text style={styles.etaTagText}>{marker.etaMinutes < 1 ? '<1 min' : `${marker.etaMinutes} min`}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (marker.pulse) {
    return <PulsingDot color={marker.color} />;
  }

  return <View style={[styles.dot, { backgroundColor: marker.color }]} />;
}

const styles = StyleSheet.create({
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarWithBadge: {
    position: 'relative',
  },
  avatarWrap: {
    alignItems: 'center',
  },
  nameTag: {
    maxWidth: 120,
    backgroundColor: '#12171A',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  nameTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
  etaTag: {
    backgroundColor: '#12171A',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  etaTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: FONTS.semiBold,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#E5484D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: FONTS.bold,
    lineHeight: 12,
  },
  poiWrap: {
    alignItems: 'center',
  },
  poiLabel: {
    maxWidth: 140,
    backgroundColor: '#12171A',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  poiLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
  poiDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
