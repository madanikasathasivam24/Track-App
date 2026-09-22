import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../utils/constants';
import type { Trip } from '../../types/models';

interface TripCardProps {
  trip: Trip;
  currentUserId?: string;
  isJoining?: boolean;
  isEnding?: boolean;
  isLeaving?: boolean;
  onJoin: () => void;
  onEnd: () => void;
  // The creator already has End Trip as their equivalent "I'm done with
  // this" action, so Leave is only offered to joined non-creator members —
  // keeps the action row from getting crowded with two overlapping exits.
  onLeave: () => void;
  onViewMap: () => void;
  // Opens the new, separate Firestore-backed tracking screen — see
  // FirestoreLiveMapScreen.tsx. Optional so other TripCard call sites don't
  // need to wire it up.
  onViewFirestoreMap?: () => void;
  // Opens TripInfoModal (members, started/ended at, ongoing duration) —
  // available for ended trips too, not just active ones, which is why it's
  // not folded into the (active-only) actionRow below.
  onInfo: () => void;
}

export function TripCard({
  trip,
  currentUserId,
  isJoining,
  isEnding,
  isLeaving,
  onJoin,
  onEnd,
  onLeave,
  onViewMap,
  onViewFirestoreMap,
  onInfo,
}: TripCardProps) {
  const isEnded = trip.status === 'ENDED';
  const isCreator = trip.creatorId === currentUserId;
  const destination = trip.destLabel ?? (trip.destLat != null && trip.destLng != null ? `${trip.destLat.toFixed(3)}, ${trip.destLng.toFixed(3)}` : null);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{trip.name}</Text>
        {isEnded && (
          <View style={styles.endedBadge}>
            <Text style={styles.endedBadgeLabel}>Ended</Text>
          </View>
        )}
        <Pressable onPress={onInfo} hitSlop={8} style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.textMuted} />
        </Pressable>
      </View>

      {trip.description ? <Text style={styles.description}>{trip.description}</Text> : null}

      <View style={styles.metaRow}>
        {destination ? (
          <View style={[styles.metaItem, styles.metaItemDestination]}>
            <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
              {destination}
            </Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.metaText}>
            {trip.memberCount} member{trip.memberCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {!isEnded && (
        <View style={styles.actionRow}>
          {!trip.hasJoined && (
            <Pressable style={[styles.actionButton, styles.joinButton]} onPress={onJoin} disabled={isJoining}>
              {isJoining ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.joinButtonLabel}>Join</Text>
              )}
            </Pressable>
          )}
          {isCreator && (
            <Pressable style={[styles.actionButton, styles.endButton]} onPress={onEnd} disabled={isEnding}>
              {isEnding ? (
                <ActivityIndicator size="small" color={COLORS.statusAlert} />
              ) : (
                <Text style={styles.endButtonLabel}>End Trip</Text>
              )}
            </Pressable>
          )}
          {trip.hasJoined && !isCreator && (
            <Pressable style={[styles.actionButton, styles.endButton]} onPress={onLeave} disabled={isLeaving}>
              {isLeaving ? (
                <ActivityIndicator size="small" color={COLORS.statusAlert} />
              ) : (
                <Text style={styles.endButtonLabel}>Leave</Text>
              )}
            </Pressable>
          )}
          {trip.hasJoined && (
            <Pressable style={[styles.actionButton, styles.mapButton]} onPress={onViewMap}>
              <Ionicons name="map-outline" size={14} color={COLORS.text} />
              <Text style={styles.mapButtonLabel}>Live map</Text>
            </Pressable>
          )}
          {trip.hasJoined && onViewFirestoreMap && (
            <Pressable style={[styles.actionButton, styles.mapButton, styles.firestoreButton]} onPress={onViewFirestoreMap}>
              <Ionicons name="cloud-outline" size={14} color={COLORS.text} />
              <Text style={styles.mapButtonLabel}>Firestore map</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  endedBadge: {
    backgroundColor: COLORS.background,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  endedBadgeLabel: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  infoButton: {
    padding: 2,
  },
  description: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  metaItemDestination: {
    flexShrink: 1,
  },
  metaText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  joinButton: {
    backgroundColor: COLORS.primary,
  },
  joinButtonLabel: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  endButton: {
    borderWidth: 1.5,
    borderColor: COLORS.statusAlert,
  },
  endButtonLabel: {
    color: COLORS.statusAlert,
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  mapButtonLabel: {
    color: COLORS.text,
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  firestoreButton: {
    borderColor: COLORS.primary,
  },
});
