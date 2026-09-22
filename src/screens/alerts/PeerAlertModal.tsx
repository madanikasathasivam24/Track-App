import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { getPeerAlertThread, markPeerAlertSeen, sendPeerAlert } from '../../services/api/alerts.api';
import { onPeerAlert } from '../../services/socket/alertEvents';
import { connectSocket } from '../../services/socket/socket';
import { useAuthStore } from '../../store/authStore';
import { useAlertStore } from '../../store/alertStore';
import { useSlowLoad } from '../../hooks/useSlowLoad';
import { Skeleton } from '../../components/ui/Skeleton';
import { COLORS, FONTS } from '../../utils/constants';
import type { PeerAlert } from '../../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'PeerAlertModal'>;

export function PeerAlertModal({ route, navigation }: Props) {
  const { groupId, tripId, tripName, peerId, peerName } = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const dismissIncoming = useAlertStore((s) => s.dismissIncoming);
  const clearPeerUnread = useAlertStore((s) => s.clearPeerUnread);

  const [thread, setThread] = useState<PeerAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<PeerAlert | null>(null);
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList<PeerAlert>>(null);

  // Refetches on every focus, not just initial mount — see the identical
  // comment in useGroupChat.ts for why a mount-only fetch misses a message
  // that arrived while backgrounded/killed.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      (async () => {
        try {
          const messages = await getPeerAlertThread(groupId, tripId, peerId);
          if (!cancelled) setThread(messages);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [groupId, tripId, peerId])
  );

  const isSlowLoad = useSlowLoad(isLoading);

  // Any alert this thread was showing in the global incoming-toast queue is
  // now visible directly in the thread itself — drop it from the queue so it
  // doesn't also pop up as a banner.
  useEffect(() => {
    thread.forEach((alert) => {
      if (alert.senderId === peerId) dismissIncoming(alert.id);
    });
  }, [thread, peerId, dismissIncoming]);

  // Mark any of the peer's messages I haven't seen yet as seen, now that I'm
  // looking at the thread — and clear their unread map badge, since opening
  // this thread is exactly what "read" means for that badge.
  useEffect(() => {
    const unseen = thread.filter((alert) => alert.senderId === peerId && !alert.seenAt);
    if (unseen.length === 0) return;
    unseen.forEach((alert) => {
      markPeerAlertSeen(groupId, tripId, alert.id).catch(() => {});
    });
    clearPeerUnread(tripId, peerId);
  }, [thread, peerId, groupId, tripId, clearPeerUnread]);

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    return onPeerAlert(socket, (alert) => {
      if (alert.senderId !== peerId && alert.recipientId !== peerId) return;
      setThread((prev) => (prev.some((a) => a.id === alert.id) ? prev : [...prev, alert]));
      dismissIncoming(alert.id);
    });
  }, [token, peerId, dismissIncoming]);

  const onSend = useCallback(async () => {
    const message = draft.trim();
    if (!message || isSending) return;
    setIsSending(true);
    try {
      const alert = await sendPeerAlert(groupId, tripId, peerId, message, replyTo?.id);
      setThread((prev) => [...prev, alert]);
      setDraft('');
      setReplyTo(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } finally {
      setIsSending(false);
    }
  }, [draft, isSending, groupId, tripId, peerId, replyTo]);

  const replySourceById = useMemo(() => {
    const map = new Map<string, PeerAlert>();
    thread.forEach((alert) => map.set(alert.id, alert));
    return map;
  }, [thread]);

  const renderItem = useCallback(
    ({ item }: { item: PeerAlert }) => {
      const isMine = item.senderId === currentUser?.id;
      const repliedTo = item.replyToId ? replySourceById.get(item.replyToId) : null;
      return (
        <Pressable
          onLongPress={() => setReplyTo(item)}
          style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
        >
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
            {repliedTo ? (
              <View style={[styles.replyPreview, isMine && styles.replyPreviewMine]}>
                <Text style={[styles.replyPreviewText, isMine && styles.replyPreviewTextMine]} numberOfLines={1}>
                  {repliedTo.message}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.message}</Text>
          </View>
        </Pressable>
      );
    },
    [currentUser, replySourceById]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={styles.headerName} numberOfLines={1}>
            {peerName}
          </Text>
          {tripName ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {tripName}
            </Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        {isLoading ? (
          <View style={styles.loadingList}>
            <Skeleton height={40} width="60%" borderRadius={16} style={styles.skeletonLeft} />
            <Skeleton height={40} width="50%" borderRadius={16} style={styles.skeletonRight} />
            <Skeleton height={40} width="65%" borderRadius={16} style={styles.skeletonLeft} />
            {isSlowLoad ? (
              <Text style={styles.slowLoadText}>Still loading — the server may be waking up, this can take a bit longer than usual.</Text>
            ) : null}
          </View>
        ) : thread.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet. Send {peerName} an alert to start the conversation.</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={thread}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {replyTo ? (
          <View style={styles.replyingBar}>
            <Text style={styles.replyingText} numberOfLines={1}>
              Replying to: {replyTo.message}
            </Text>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={COLORS.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Write a message…"
            placeholderTextColor={COLORS.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || isSending}
            style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
          >
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  loadingList: {
    padding: 16,
    gap: 12,
  },
  skeletonLeft: {
    alignSelf: 'flex-start',
  },
  skeletonRight: {
    alignSelf: 'flex-end',
  },
  slowLoadText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingTop: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  bubbleMine: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.textMuted,
    paddingLeft: 6,
    marginBottom: 4,
  },
  replyPreviewMine: {
    borderLeftColor: 'rgba(255,255,255,0.6)',
  },
  replyPreviewText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  replyPreviewTextMine: {
    color: 'rgba(255,255,255,0.75)',
  },
  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  replyingText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 6,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
