import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  getFriendRequests,
  getFriends,
  respondToFriendRequest,
  searchUserByTrackId,
  sendFriendRequest,
  unfriend,
} from '../../services/api/friends.api';
import {
  getActiveShareFriendIds,
  getFriendLocation,
  startLiveShare,
  stopLiveShare,
} from '../../services/api/liveShare.api';
import { getApiErrorMessage, getStatus } from '../../utils/apiError';
import { AVATAR_OPTIONS, COLORS, FONTS, TRACK_ID_LENGTH } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import { Skeleton } from '../../components/ui/Skeleton';
import { NotificationBell } from '../../components/common/NotificationBell';
import { onNotificationReceived } from '../../services/notifications/notificationEvents';
import type { FriendRequestItem, PublicUser } from '../../types/models';
import type { RootStackParamList } from '../../navigation/types';

type Tab = 'friends' | 'requests';

const DEBOUNCE_MS = 400;

function FriendRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <Skeleton width={120} height={16} style={{ flex: 1 }} />
    </View>
  );
}

function mapSearchError(err: unknown): string {
  return getStatus(err) === 404 ? 'No user found with that Track ID' : getApiErrorMessage(err, 'Search failed. Try again.');
}

function mapAddFriendError(err: unknown): string {
  const status = getStatus(err);
  if (status === 400) return 'You cannot add yourself';
  if (status === 409) return getApiErrorMessage(err, 'Already friends or request already sent');
  return getApiErrorMessage(err, 'Could not send request. Try again.');
}

export function FriendsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [menuFriend, setMenuFriend] = useState<PublicUser | null>(null);
  const [isConfirmingUnfriend, setIsConfirmingUnfriend] = useState(false);
  const [activeShareFriendIds, setActiveShareFriendIds] = useState<Set<string>>(new Set());
  const [isTogglingShare, setIsTogglingShare] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PublicUser | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  // Android reclaims decoded avatar bitmaps from this (now background) tab to
  // make room for the native map view's GPU/texture memory while you're on
  // Explore/Directions/LiveMap — nothing re-renders these Image views to
  // force a fresh decode when that happens, so they'd otherwise stay blank
  // until FlatList happens to recycle that row (e.g. on scroll). Bumping this
  // into each avatar's key on every refocus forces React to recreate the
  // underlying native Image view, guaranteeing a fresh decode regardless of
  // what got evicted while this tab was inactive.
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setAvatarRefreshKey((k) => k + 1);
    }, [])
  );

  const loadFriends = useCallback(async () => {
    const data = await getFriends();
    setFriends(data);
  }, []);

  const loadRequests = useCallback(async () => {
    const data = await getFriendRequests();
    setRequests(data);
  }, []);

  useEffect(() => {
    loadFriends().finally(() => setIsLoadingFriends(false));
    loadRequests().finally(() => setIsLoadingRequests(false));
    getActiveShareFriendIds()
      .then((ids) => setActiveShareFriendIds(new Set(ids)))
      .catch(() => {});
  }, [loadFriends, loadRequests]);

  // This screen stays mounted across tab switches (bottom-tab screens aren't
  // torn down), so without this, a request that arrived while you were on
  // another tab would only ever show up after a full app restart. Two
  // triggers: refocusing this tab (catches anything missed) and an instant
  // push/foreground-notification signal (catches it live, no need to even
  // switch tabs).
  useFocusEffect(
    useCallback(() => {
      loadFriends();
      loadRequests();
    }, [loadFriends, loadRequests])
  );

  useEffect(
    () =>
      onNotificationReceived((data) => {
        if (data.type === 'friend-request' || data.type === 'friend-request-accepted') {
          loadFriends();
          loadRequests();
        }
      }),
    [loadFriends, loadRequests]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchError(null);
    setSearchResult(null);
    setRequestSent(false);

    const trimmed = query.trim().toUpperCase();
    if (trimmed.length !== TRACK_ID_LENGTH) return;

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await searchUserByTrackId(trimmed);
        setSearchResult(result);
      } catch (err) {
        setSearchError(mapSearchError(err));
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Setting query to '' is enough to close the search UI — the debounce
  // effect above already clears searchResult/searchError/requestSent
  // whenever query changes, since an empty query never matches TRACK_ID_LENGTH.
  const dismissSearch = useCallback(() => setQuery(''), []);

  const onAddFriend = useCallback(async () => {
    if (!searchResult) return;
    setIsSendingRequest(true);
    setSearchError(null);
    try {
      await sendFriendRequest(searchResult.trackId);
      setRequestSent(true);
    } catch (err) {
      setSearchError(mapAddFriendError(err));
    } finally {
      setIsSendingRequest(false);
    }
  }, [searchResult]);

  const onRespond = useCallback(
    async (requestId: string, action: 'accept' | 'decline') => {
      const request = requests.find((r) => r.id === requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      // Optimistic on accept — we already have the requester's full public
      // profile right here on the request row, so there's no need to wait on
      // a network round trip (respond) followed by a second one (a full
      // getFriends() refetch) just to show someone who's already known.
      if (action === 'accept' && request) {
        setFriends((prev) => (prev.some((f) => f.id === request.userA.id) ? prev : [request.userA, ...prev]));
      }
      try {
        await respondToFriendRequest(requestId, action);
      } catch {
        loadRequests();
        if (action === 'accept') loadFriends();
      }
    },
    [requests, loadFriends, loadRequests]
  );

  const closeMenu = useCallback(() => {
    setMenuFriend(null);
    setIsConfirmingUnfriend(false);
    setTrackError(null);
  }, []);

  // Not using Alert.alert here — on react-native-web it's a no-op stub (its
  // entire implementation is `static alert() {}`), so the dialog never shows
  // and the confirm button's onPress never fires. This custom confirm step
  // inside the same sheet works identically on web and native.
  const onConfirmUnfriend = useCallback(async () => {
    if (!menuFriend) return;
    const friend = menuFriend;
    closeMenu();
    setFriends((prev) => prev.filter((f) => f.id !== friend.id));
    try {
      await unfriend(friend.id);
    } catch {
      loadFriends();
    }
  }, [menuFriend, closeMenu, loadFriends]);

  const onToggleShare = useCallback(async () => {
    if (!menuFriend || isTogglingShare) return;
    const friendId = menuFriend.id;
    const isSharing = activeShareFriendIds.has(friendId);
    setIsTogglingShare(true);
    try {
      if (isSharing) {
        await stopLiveShare(friendId);
        setActiveShareFriendIds((prev) => {
          const next = new Set(prev);
          next.delete(friendId);
          return next;
        });
      } else {
        await startLiveShare(friendId);
        setActiveShareFriendIds((prev) => new Set(prev).add(friendId));
      }
    } catch {
      // Leave the toggle state as it was — best-effort, no error UI for this
      // one since the menu already reflects the last known-good state.
    } finally {
      setIsTogglingShare(false);
    }
  }, [menuFriend, isTogglingShare, activeShareFriendIds]);

  const onTrack = useCallback(async () => {
    if (!menuFriend || isTracking) return;
    const friend = menuFriend;
    setIsTracking(true);
    setTrackError(null);
    try {
      const location = await getFriendLocation(friend.id);
      closeMenu();
      navigation.navigate('Main', {
        screen: 'Explore',
        params: {
          trackDestination: { label: friend.name, latitude: location.latitude, longitude: location.longitude },
        },
      });
    } catch (err) {
      setTrackError(getStatus(err) === 404 ? "Their location isn't available yet" : 'Could not get their location right now');
    } finally {
      setIsTracking(false);
    }
  }, [menuFriend, isTracking, closeMenu, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Pressable style={styles.flexFill} onPress={() => searchResult && dismissSearch()}>
      <View style={styles.contentPad}>
      <View style={styles.topRow}>
        <Text style={styles.screenTitle}>Friends</Text>
        <NotificationBell />
      </View>

      <View style={styles.searchPill}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
          maxLength={TRACK_ID_LENGTH}
          placeholder="Search a Track ID"
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
        />
        {isSearching ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : query ? (
          <Pressable onPress={dismissSearch} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}

      {searchResult && (
        <View style={styles.resultCard}>
          <Image source={AVATAR_OPTIONS[searchResult.avatarIndex]} style={styles.resultAvatar} />
          <View style={styles.resultInfo}>
            <Text style={styles.resultName}>{searchResult.name}</Text>
            <Text style={styles.resultTrackId}>{searchResult.trackId}</Text>
          </View>
          {searchResult.id === currentUser?.id ? (
            <Text style={styles.selfLabel}>Myself</Text>
          ) : requestSent ? (
            <Text style={styles.requestSentLabel}>Request sent</Text>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              onPress={onAddFriend}
              disabled={isSendingRequest}
            >
              {isSendingRequest ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.addButtonLabel}>Add Friend</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'friends' && styles.tabButtonActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Image source={require('../../assets/friends/friends.png')} style={styles.tabIcon} resizeMode="contain" />
          <Text style={[styles.tabLabel, activeTab === 'friends' && styles.tabLabelActive]}>Friends</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'requests' && styles.tabButtonActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Image source={require('../../assets/friends/request.png')} style={styles.tabIcon} resizeMode="contain" />
          <Text style={[styles.tabLabel, activeTab === 'requests' && styles.tabLabelActive]}>
            Requests{requests.length > 0 ? ` (${requests.length})` : ''}
          </Text>
        </Pressable>
      </View>

      {activeTab === 'friends' ? (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            isLoadingFriends ? (
              <View style={{ gap: 10 }}>
                <FriendRowSkeleton />
                <FriendRowSkeleton />
                <FriendRowSkeleton />
              </View>
            ) : (
              <Text style={styles.emptyText}>No friends yet — search a Track ID above.</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Image key={avatarRefreshKey} source={AVATAR_OPTIONS[item.avatarIndex]} style={styles.rowAvatar} />
              <Text style={[styles.rowName, styles.requestName]}>{item.name}</Text>
              <Pressable onPress={() => setMenuFriend(item)} hitSlop={8} style={styles.menuButton}>
                <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textMuted} />
              </Pressable>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            isLoadingRequests ? (
              <View style={{ gap: 10 }}>
                <FriendRowSkeleton />
                <FriendRowSkeleton />
              </View>
            ) : (
              <Text style={styles.emptyText}>No pending requests.</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Image key={avatarRefreshKey} source={AVATAR_OPTIONS[item.userA.avatarIndex]} style={styles.rowAvatar} />
              <Text style={[styles.rowName, styles.requestName]}>{item.userA.name}</Text>
              <Pressable style={styles.declineButton} onPress={() => onRespond(item.id, 'decline')} hitSlop={6}>
                <Text style={styles.declineButtonLabel}>Decline</Text>
              </Pressable>
              <Pressable style={styles.acceptButton} onPress={() => onRespond(item.id, 'accept')} hitSlop={6}>
                <Text style={styles.acceptButtonLabel}>Accept</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      </View>

      {menuFriend && (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
          onPress={(e) => {
            e.stopPropagation();
            closeMenu();
          }}
        >
          <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
            {isConfirmingUnfriend ? (
              <>
                <Text style={styles.actionSheetTitle}>Remove {menuFriend.name} from your friends?</Text>
                <Pressable style={styles.actionRow} onPress={() => setIsConfirmingUnfriend(false)}>
                  <Ionicons name="close-outline" size={20} color={COLORS.text} />
                  <Text style={styles.actionLabel}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.actionRow} onPress={onConfirmUnfriend}>
                  <Ionicons name="person-remove-outline" size={20} color={COLORS.statusAlert} />
                  <Text style={[styles.actionLabel, styles.actionLabelDanger]}>Unfriend</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.actionSheetTitle}>{menuFriend.name}</Text>
                {trackError ? <Text style={styles.trackErrorText}>{trackError}</Text> : null}
                <Pressable
                  style={[styles.actionRow, !activeShareFriendIds.has(menuFriend.id) && styles.actionRowDisabled]}
                  onPress={onTrack}
                  disabled={!activeShareFriendIds.has(menuFriend.id) || isTracking}
                >
                  {isTracking ? (
                    <ActivityIndicator size="small" color={COLORS.textMuted} />
                  ) : (
                    <Ionicons name="navigate-outline" size={20} color={COLORS.text} />
                  )}
                  <Text style={styles.actionLabel}>Track</Text>
                </Pressable>
                <Pressable style={styles.actionRow} onPress={onToggleShare} disabled={isTogglingShare}>
                  {isTogglingShare ? (
                    <ActivityIndicator size="small" color={COLORS.textMuted} />
                  ) : (
                    <Ionicons
                      name={activeShareFriendIds.has(menuFriend.id) ? 'location' : 'location-outline'}
                      size={20}
                      color={COLORS.text}
                    />
                  )}
                  <Text style={styles.actionLabel}>
                    {activeShareFriendIds.has(menuFriend.id) ? 'Unshare location' : 'Share location'}
                  </Text>
                </Pressable>
                <Pressable style={styles.actionRow} onPress={() => setIsConfirmingUnfriend(true)}>
                  <Ionicons name="person-remove-outline" size={20} color={COLORS.statusAlert} />
                  <Text style={[styles.actionLabel, styles.actionLabelDanger]}>Unfriend</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flexFill: {
    flex: 1,
  },
  // Horizontal padding lives here instead of on `container` so the modal
  // backdrop below (a sibling, not a descendant of this) can be a true
  // full-bleed overlay rather than inheriting this inset on its sides.
  contentPad: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    padding: 0,
  },
  searchError: {
    fontFamily: FONTS.regular,
    color: COLORS.statusAlert,
    marginTop: 10,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 12,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  resultTrackId: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  requestSentLabel: {
    color: COLORS.statusActive,
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  selfLabel: {
    color: COLORS.textMuted,
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 96,
    alignItems: 'center',
  },
  addButtonLabel: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabButtonActive: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  tabIcon: {
    width: 24,
    height: 24,
  },
  tabLabel: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  rowName: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  requestName: {
    flex: 1,
  },
  declineButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  declineButtonLabel: {
    color: COLORS.textMuted,
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  acceptButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: COLORS.primary,
  },
  acceptButtonLabel: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingTop: 40,
  },
  menuButton: {
    padding: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 33, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 8,
  },
  actionSheetTitle: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionRowDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  actionLabelDanger: {
    color: COLORS.statusAlert,
  },
  trackErrorText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.statusAlert,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
