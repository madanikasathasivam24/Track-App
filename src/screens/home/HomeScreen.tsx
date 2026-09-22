import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabsParamList, RootStackParamList } from '../../navigation/types';
import { getMyGroups } from '../../services/api/groups.api';
import { COLORS, FONTS } from '../../utils/constants';
import { Skeleton } from '../../components/ui/Skeleton';
import { NotificationBell } from '../../components/common/NotificationBell';
import type { Group } from '../../types/models';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

function GroupCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Skeleton width={12} height={12} borderRadius={6} />
        <View style={{ gap: 6 }}>
          <Skeleton width={140} height={16} />
          <Skeleton width={90} height={12} />
        </View>
      </View>
      <Skeleton width={64} height={22} borderRadius={11} />
    </View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(trimmed));
  }, [groups, query]);

  const loadGroups = useCallback(async () => {
    const data = await getMyGroups();
    setGroups(data);
  }, []);

  useEffect(() => {
    loadGroups().finally(() => setIsLoading(false));
  }, [loadGroups]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadGroups);
    return unsubscribe;
  }, [navigation, loadGroups]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadGroups();
    setIsRefreshing(false);
  }, [loadGroups]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListHeaderComponent={
          <>
            <View style={styles.topRow}>
              <Text style={styles.screenTitle}>Groups</Text>
              <NotificationBell />
            </View>

            <View style={styles.searchPill}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search your groups"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="search"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                <Image source={require('../../assets/groups/group.png.png')} style={styles.actionIcon} resizeMode="contain" />
                <Text style={styles.actionButtonLabel}>Create group</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                onPress={() => navigation.navigate('JoinGroup')}
              >
                <Image source={require('../../assets/groups/join-group.png')} style={styles.actionIcon} resizeMode="contain" />
                <Text style={styles.actionButtonLabel}>Join group</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>My Groups</Text>
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View>
              <GroupCardSkeleton />
              <GroupCardSkeleton />
              <GroupCardSkeleton />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {query.trim()
                  ? `No groups match "${query.trim()}".`
                  : 'No groups yet. Create one or join with an invite code.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => navigation.navigate('GroupDetails', { groupId: item.id })}
          >
            <View style={styles.cardLeft}>
              <View
                style={[styles.statusDot, item.status === 'ACTIVE' ? styles.statusDotActive : styles.statusDotEnded]}
              />
              <View>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>
                  {item.memberCount} member{item.memberCount === 1 ? '' : 's'} ·{' '}
                  {item.status === 'ACTIVE' ? 'Active' : 'Ended'}
                </Text>
              </View>
            </View>
            <View style={[styles.roleBadge, item.isAdmin && styles.roleBadgeAdmin]}>
              <Text style={[styles.roleBadgeLabel, item.isAdmin && styles.roleBadgeLabelAdmin]}>
                {item.isAdmin ? 'Admin' : 'Member'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  pressed: {
    opacity: 0.85,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 16,
    paddingBottom: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  actionIcon: {
    width: 32,
    height: 32,
  },
  actionButtonLabel: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    paddingTop: 12,
    paddingBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    minHeight: 76,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDotActive: {
    backgroundColor: COLORS.statusActive,
  },
  statusDotEnded: {
    backgroundColor: COLORS.statusStale,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  roleBadge: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: COLORS.background,
  },
  roleBadgeAdmin: {
    backgroundColor: COLORS.primary,
  },
  roleBadgeLabel: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  roleBadgeLabelAdmin: {
    color: '#FFFFFF',
  },
  empty: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
