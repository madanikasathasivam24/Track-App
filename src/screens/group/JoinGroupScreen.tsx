import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { joinGroupByCode } from '../../services/api/groups.api';
import { getCommonErrorMessage } from '../../utils/apiError';
import { COLORS, FONTS } from '../../utils/constants';

const INVITE_CODE_LENGTH = 6;

type Props = NativeStackScreenProps<RootStackParamList, 'JoinGroup'>;

export function JoinGroupScreen({ navigation }: Props) {
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      setError('Enter an invite code');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const group = await joinGroupByCode(trimmed);
      navigation.goBack();
      navigation.navigate('GroupDetails', { groupId: group.id });
    } catch (err) {
      setError(
        getCommonErrorMessage(err, {
          notFound: 'Not found — check the invite code and try again',
          conflict: 'Already a member',
        })
      );
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={40}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </Pressable>

          <Text style={styles.title}>Join a group</Text>
          <Text style={styles.subtitle}>Enter the invite code someone shared with you.</Text>

          <Input
            label="Invite code"
            placeholder="YNJPP1"
            value={inviteCode}
            onChangeText={(text) => setInviteCode(text.toUpperCase())}
            autoCapitalize="characters"
            autoFocus
            maxLength={INVITE_CODE_LENGTH}
            style={styles.codeInput}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Join group" onPress={onSubmit} loading={isSubmitting} style={styles.submit} />
        </ScrollView>
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
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 24,
  },
  codeInput: {
    fontFamily: FONTS.bold,
    letterSpacing: 4,
    textAlign: 'center',
  },
  error: {
    fontFamily: FONTS.regular,
    color: COLORS.statusAlert,
    marginBottom: 12,
  },
  submit: {
    marginTop: 8,
  },
});
