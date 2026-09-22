import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getTripDetail } from '../../services/api/trips.api';
import { useStaleWhileRevalidateOn } from '../../hooks/useStaleWhileRevalidate';
import type { TripDetail, TripMemberInfo } from '../../types/models';
import { AVATAR_OPTIONS, COLORS, FONTS } from '../../utils/constants';

interface TripInfoModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  tripId: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Trip details panel — members (with join times), started/ended at, and an
// ongoing-duration counter for active trips (ticks live via a 1-minute
// interval; ended trips just show the final elapsed duration once).
export function TripInfoModal({ visible, onClose, groupId, tripId }: TripInfoModalProps) {
  const { data: trip, isLoading } = useStaleWhileRevalidateOn<TripDetail>(
    `trip-detail:${tripId}`,
    () => getTripDetail(groupId, tripId),
    visible
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible || trip?.status !== 'ACTIVE') return;
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [visible, trip?.status]);

  const renderMember = ({ item }: { item: TripMemberInfo }) => (
    <View style={styles.memberRow}>
      <Image source={AVATAR_OPTIONS[item.avatarIndex]} style={styles.memberAvatar} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberJoined}>Joined {formatDateTime(item.joinedAt)}</Text>
      </View>
    </View>
  );

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']} style={styles.sheetInner}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {trip?.name ?? 'Trip details'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            {isLoading || !trip ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.loading} />
            ) : (
              <FlatList
                data={trip.members}
                keyExtractor={(m) => m.id}
                renderItem={renderMember}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                  <View style={styles.detailsCard}>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, trip.status === 'ACTIVE' ? styles.statusDotActive : styles.statusDotEnded]} />
                      <Text style={styles.statusText}>{trip.status === 'ACTIVE' ? 'Ongoing' : 'Ended'}</Text>
                      {trip.status === 'ACTIVE' ? (
                        <Text style={styles.durationText}>{formatDuration(now - new Date(trip.createdAt).getTime())}</Text>
                      ) : trip.endedAt ? (
                        <Text style={styles.durationText}>
                          {formatDuration(new Date(trip.endedAt).getTime() - new Date(trip.createdAt).getTime())}
                        </Text>
                      ) : null}
                    </View>

                    {trip.destLabel ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
                        <Text style={styles.detailText} numberOfLines={2}>
                          {trip.destLabel}
                        </Text>
                      </View>
                    ) : null}
                    {trip.description ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="document-text-outline" size={16} color={COLORS.textMuted} />
                        <Text style={styles.detailText}>{trip.description}</Text>
                      </View>
                    ) : null}
                    <View style={styles.detailRow}>
                      <Ionicons name="play-outline" size={16} color={COLORS.textMuted} />
                      <Text style={styles.detailText}>Started {formatDateTime(trip.createdAt)}</Text>
                    </View>
                    {trip.endedAt ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="stop-outline" size={16} color={COLORS.textMuted} />
                        <Text style={styles.detailText}>Ended {formatDateTime(trip.endedAt)}</Text>
                      </View>
                    ) : null}

                    <Text style={styles.membersHeading}>
                      Members ({trip.memberCount})
                    </Text>
                  </View>
                }
              />
            )}
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(18, 33, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
  },
  sheetInner: {
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginRight: 12,
  },
  loading: {
    paddingVertical: 40,
  },
  listContent: {
    paddingBottom: 24,
  },
  detailsCard: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotActive: {
    backgroundColor: COLORS.statusActive,
  },
  statusDotEnded: {
    backgroundColor: COLORS.statusStale,
  },
  statusText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  durationText: {
    marginLeft: 'auto',
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  membersHeading: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  memberJoined: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
