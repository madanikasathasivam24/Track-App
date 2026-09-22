import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { deleteGroup, endGroup, getGroupDetail, leaveGroup } from '../../services/api/groups.api';
import { createTrip, endTrip, getTrips, joinTrip, leaveTrip } from '../../services/api/trips.api';
import { getCommonErrorMessage } from '../../utils/apiError';
import { AVATAR_OPTIONS, COLORS, FONTS } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import { useStaleWhileRevalidate } from '../../hooks/useStaleWhileRevalidate';
import { TripCard } from '../../components/group/TripCard';
import { TripInfoModal } from '../../components/group/TripInfoModal';
import { Skeleton } from '../../components/ui/Skeleton';
import { DestinationPicker } from '../../components/group/DestinationPicker';
import type { DestinationValue } from '../../components/group/DestinationPicker';
import type { GroupDetail, Trip } from '../../types/models';
import type { LatLng } from '../../utils/polyline';

// Fallback bias for the destination picker if location permission isn't
// granted yet — doesn't need to be accurate, it's just a search focus hint.
const DEFAULT_BIAS: LatLng = { latitude: 20.5937, longitude: 78.9629 };

type Tab = 'members' | 'trips';
type ConfirmAction = 'end' | 'delete' | 'leave' | null;

function GroupDetailsSkeleton() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.scroll}>
        <View style={styles.header}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={160} height={20} />
          </View>
        </View>
        <View style={[styles.tabRow, { marginTop: 4 }]}>
          <Skeleton height={40} borderRadius={999} style={{ flex: 1 }} />
          <Skeleton height={40} borderRadius={999} style={{ flex: 1 }} />
        </View>
        <View style={styles.list}>
          <Skeleton height={64} borderRadius={16} />
          <Skeleton height={64} borderRadius={16} />
          <Skeleton height={64} borderRadius={16} />
        </View>
      </View>
    </SafeAreaView>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetails'>;

export function GroupDetailsScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const currentUser = useAuthStore((s) => s.user);

  const {
    data: detail,
    setData: setDetail,
    isLoading: isLoadingDetail,
  } = useStaleWhileRevalidate<GroupDetail>(`group-detail:${groupId}`, () => getGroupDetail(groupId));
  const { data: tripsData, setData: setTripsRaw } = useStaleWhileRevalidate<Trip[]>(`group-trips:${groupId}`, () =>
    getTrips(groupId)
  );
  const trips = tripsData ?? [];
  // Optimistic updaters below assume a resolved array (they only ever run in
  // response to pressing a button on an already-rendered trip card, so trips
  // has necessarily loaded by then) — this just satisfies the type, since the
  // cache can theoretically still hold `undefined` before the first load.
  const setTrips = useCallback(
    (updater: Trip[] | ((prev: Trip[]) => Trip[])) =>
      setTripsRaw((prev) => (typeof updater === 'function' ? (updater as (p: Trip[]) => Trip[])(prev ?? []) : updater)),
    [setTripsRaw]
  );
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [copied, setCopied] = useState(false);
  const [isInviteVisible, setIsInviteVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [joiningTripId, setJoiningTripId] = useState<string | null>(null);
  const [endingTripId, setEndingTripId] = useState<string | null>(null);
  const [leavingTripId, setLeavingTripId] = useState<string | null>(null);
  const [infoTripId, setInfoTripId] = useState<string | null>(null);

  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [tripName, setTripName] = useState('');
  const [tripDescription, setTripDescription] = useState('');
  const [tripDestination, setTripDestination] = useState<DestinationValue>({ label: '', coords: null });
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);

  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isProcessingAdminAction, setIsProcessingAdminAction] = useState(false);

  // Best-effort bias for the destination picker's search + initial map region
  // — falls back to DEFAULT_BIAS if permission is denied, so the picker still
  // works (just less accurately focused).
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const current = await Location.getCurrentPositionAsync({});
      setMyLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    })();
  }, []);

  const onCopyInviteCode = async () => {
    if (!detail) return;
    await Clipboard.setStringAsync(detail.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onJoinTrip = useCallback(
    async (tripId: string) => {
      setJoiningTripId(tripId);
      setError(null);
      try {
        await joinTrip(groupId, tripId);
        setTrips((prev) =>
          prev.map((t) => (t.id === tripId ? { ...t, hasJoined: true, memberCount: t.memberCount + 1 } : t))
        );
      } catch (err) {
        setError(getCommonErrorMessage(err, { conflict: 'Already joined' }));
      } finally {
        setJoiningTripId(null);
      }
    },
    [groupId]
  );

  const onEndTrip = useCallback(
    async (tripId: string) => {
      setEndingTripId(tripId);
      setError(null);
      try {
        await endTrip(groupId, tripId);
        setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, status: 'ENDED' } : t)));
      } catch (err) {
        setError(getCommonErrorMessage(err));
      } finally {
        setEndingTripId(null);
      }
    },
    [groupId]
  );

  const onLeaveTrip = useCallback(
    async (tripId: string) => {
      setLeavingTripId(tripId);
      setError(null);
      try {
        await leaveTrip(groupId, tripId);
        setTrips((prev) =>
          prev.map((t) => (t.id === tripId ? { ...t, hasJoined: false, memberCount: Math.max(0, t.memberCount - 1) } : t))
        );
      } catch (err) {
        setError(getCommonErrorMessage(err));
      } finally {
        setLeavingTripId(null);
      }
    },
    [groupId]
  );

  const onCreateTrip = useCallback(async () => {
    if (!tripName.trim()) {
      setTripError('Give your trip a name');
      return;
    }
    setIsCreatingTrip(true);
    setTripError(null);
    try {
      const trip = await createTrip(groupId, {
        name: tripName.trim(),
        description: tripDescription.trim() || undefined,
        destLabel: tripDestination.label.trim() || undefined,
        destLat: tripDestination.coords?.latitude,
        destLng: tripDestination.coords?.longitude,
      });
      setTrips((prev) => [{ ...trip, hasJoined: true }, ...prev]);
      setIsCreateTripOpen(false);
      setTripName('');
      setTripDescription('');
      setTripDestination({ label: '', coords: null });
    } catch (err) {
      setTripError(getCommonErrorMessage(err));
    } finally {
      setIsCreatingTrip(false);
    }
  }, [groupId, tripName, tripDescription, tripDestination]);

  const onConfirmAdminAction = useCallback(async () => {
    if (!confirmAction || !detail) return;
    setIsProcessingAdminAction(true);
    setError(null);
    try {
      if (confirmAction === 'end') {
        await endGroup(detail.id);
        setDetail((prev) => (prev ? { ...prev, status: 'ENDED' } : prev));
        setConfirmAction(null);
      } else if (confirmAction === 'leave') {
        await leaveGroup(detail.id);
        navigation.goBack();
        return;
      } else {
        await deleteGroup(detail.id);
        navigation.goBack();
        return;
      }
    } catch (err) {
      setError(getCommonErrorMessage(err));
      setConfirmAction(null);
    } finally {
      setIsProcessingAdminAction(false);
    }
  }, [confirmAction, detail, navigation]);

  if (isLoadingDetail || !detail) {
    return <GroupDetailsSkeleton />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>{detail.name}</Text>
            <View style={[styles.statusBadge, detail.status === 'ENDED' && styles.statusBadgeEnded]}>
              <Text style={[styles.statusBadgeLabel, detail.status === 'ENDED' && styles.statusBadgeLabelEnded]}>
                {detail.status === 'ACTIVE' ? 'Active' : 'Ended'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate('GroupChat', { groupId, groupName: detail.name })}
            hitSlop={8}
            style={styles.chatButton}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.text} />
          </Pressable>
          <Pressable onPress={() => setIsInviteVisible((v) => !v)} hitSlop={8}>
            <Ionicons name="share-social-outline" size={22} color={COLORS.text} />
          </Pressable>
          <Pressable onPress={() => setIsAdminMenuOpen(true)} hitSlop={8} style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.text} />
          </Pressable>
        </View>

        {detail.description ? <Text style={styles.description}>{detail.description}</Text> : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isInviteVisible && (
          <View style={styles.inviteCard}>
            <Text style={styles.inviteLabel}>Invite code</Text>
            <View style={styles.inviteRow}>
              <Text style={styles.inviteCode}>{detail.inviteCode}</Text>
              <Pressable onPress={onCopyInviteCode} hitSlop={8} style={styles.copyButton}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={COLORS.primary} />
                <Text style={styles.copyButtonLabel}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
            <View style={styles.qrWrap}>
              <QRCode value={detail.qrData} size={140} color={COLORS.text} backgroundColor={COLORS.surface} />
            </View>
          </View>
        )}

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, activeTab === 'members' && styles.tabButtonActive]}
            onPress={() => setActiveTab('members')}
          >
            <Text style={[styles.tabLabel, activeTab === 'members' && styles.tabLabelActive]}>
              Members ({detail.memberCount})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'trips' && styles.tabButtonActive]}
            onPress={() => setActiveTab('trips')}
          >
            <Text style={[styles.tabLabel, activeTab === 'trips' && styles.tabLabelActive]}>
              Trips ({trips.length})
            </Text>
          </Pressable>
        </View>

        {activeTab === 'members' ? (
          <View style={styles.list}>
            {detail.members.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <Image source={AVATAR_OPTIONS[member.avatarIndex]} style={styles.memberAvatar} />
                <Text style={styles.memberName}>{member.name}</Text>
                {member.isAdmin ? <Text style={styles.crown}>👑</Text> : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {detail.status === 'ACTIVE' && (
              <Pressable style={styles.createTripButton} onPress={() => setIsCreateTripOpen(true)}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.createTripButtonLabel}>Create Trip</Text>
              </Pressable>
            )}
            {trips.length === 0 ? (
              <Text style={styles.emptyText}>No trips yet.</Text>
            ) : (
              trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  currentUserId={currentUser?.id}
                  isJoining={joiningTripId === trip.id}
                  isEnding={endingTripId === trip.id}
                  isLeaving={leavingTripId === trip.id}
                  onJoin={() => onJoinTrip(trip.id)}
                  onEnd={() => onEndTrip(trip.id)}
                  onLeave={() => onLeaveTrip(trip.id)}
                  onViewMap={() =>
                    navigation.navigate('LiveMap', {
                      groupId,
                      tripId: trip.id,
                      tripName: trip.name,
                      destLat: trip.destLat,
                      destLng: trip.destLng,
                      destLabel: trip.destLabel,
                    })
                  }
                  onInfo={() => setInfoTripId(trip.id)}
                />
              ))
            )}
          </View>
        )}

      </ScrollView>

      {isAdminMenuOpen && (
        <Pressable style={[styles.overlayFill, styles.backdrop]} onPress={() => setIsAdminMenuOpen(false)}>
          <View style={styles.sheet}>
            {detail.isAdmin ? (
              <>
                {detail.status === 'ACTIVE' && (
                  <Pressable
                    style={styles.menuRow}
                    onPress={() => {
                      setIsAdminMenuOpen(false);
                      setConfirmAction('end');
                    }}
                  >
                    <Ionicons name="stop-circle-outline" size={20} color={COLORS.text} />
                    <Text style={styles.menuRowLabel}>End Group</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    setIsAdminMenuOpen(false);
                    setConfirmAction('delete');
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={COLORS.statusAlert} />
                  <Text style={[styles.menuRowLabel, styles.menuRowLabelDanger]}>Delete Group</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={styles.menuRow}
                onPress={() => {
                  setIsAdminMenuOpen(false);
                  setConfirmAction('leave');
                }}
              >
                <Ionicons name="exit-outline" size={20} color={COLORS.statusAlert} />
                <Text style={[styles.menuRowLabel, styles.menuRowLabelDanger]}>Leave Group</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      )}

      {isCreateTripOpen && (
        <Pressable style={[styles.overlayFill, styles.backdrop]} onPress={() => setIsCreateTripOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Create a trip</Text>

            <TextInput
              style={styles.sheetInput}
              placeholder="Trip name"
              placeholderTextColor={COLORS.textMuted}
              value={tripName}
              onChangeText={setTripName}
              autoFocus
            />
            <TextInput
              style={styles.sheetInput}
              placeholder="Description (optional)"
              placeholderTextColor={COLORS.textMuted}
              value={tripDescription}
              onChangeText={setTripDescription}
            />
            <Text style={styles.destinationLabel}>Destination (optional)</Text>
            <DestinationPicker value={tripDestination} onChange={setTripDestination} biasCoord={myLocation ?? DEFAULT_BIAS} />

            {tripError ? <Text style={styles.errorText}>{tripError}</Text> : null}

            <Pressable style={styles.sheetSubmit} onPress={onCreateTrip} disabled={isCreatingTrip}>
              {isCreatingTrip ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sheetSubmitLabel}>Create trip</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {confirmAction && (
        <Pressable style={[styles.overlayFill, styles.backdrop]} onPress={() => setConfirmAction(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {confirmAction === 'end' ? 'End this group?' : confirmAction === 'leave' ? 'Leave this group?' : 'Delete this group?'}
            </Text>
            <Text style={styles.sheetSubtitle}>
              {confirmAction === 'end'
                ? 'No more trips can be created. Existing records are kept.'
                : confirmAction === 'leave'
                  ? "You'll need an invite code to rejoin later."
                  : "This cannot be undone — the group and all its records will be permanently deleted."}
            </Text>
            <Pressable style={styles.sheetCancel} onPress={() => setConfirmAction(null)}>
              <Text style={styles.sheetCancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetSubmit, styles.sheetSubmitDanger]}
              onPress={onConfirmAdminAction}
              disabled={isProcessingAdminAction}
            >
              {isProcessingAdminAction ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sheetSubmitLabel}>
                  {confirmAction === 'end' ? 'End Group' : confirmAction === 'leave' ? 'Leave Group' : 'Delete Group'}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      )}

      {infoTripId && (
        <TripInfoModal
          visible
          onClose={() => setInfoTripId(null)}
          groupId={groupId}
          tripId={infoTripId}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  statusBadge: {
    backgroundColor: COLORS.statusActive,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusBadgeEnded: {
    backgroundColor: COLORS.statusStale,
  },
  statusBadgeLabel: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  statusBadgeLabelEnded: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: FONTS.regular,
    color: COLORS.statusAlert,
    marginBottom: 12,
  },
  inviteCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  inviteCode: {
    fontSize: 26,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    letterSpacing: 3,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  copyButtonLabel: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  qrWrap: {
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabButtonActive: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  list: {
    gap: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberName: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  crown: {
    fontSize: 18,
  },
  createTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 12,
    marginBottom: 4,
  },
  createTripButtonLabel: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingTop: 24,
  },
  chatButton: {
    marginRight: 2,
  },
  menuButton: {
    marginLeft: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  menuRowLabel: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  menuRowLabelDanger: {
    color: COLORS.statusAlert,
  },
  overlayFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    backgroundColor: 'rgba(18, 33, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  sheetSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  sheetInput: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  destinationLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    marginTop: -4,
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetCancelLabel: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  sheetSubmit: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  sheetSubmitDanger: {
    backgroundColor: COLORS.statusAlert,
  },
  sheetSubmitLabel: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
});
