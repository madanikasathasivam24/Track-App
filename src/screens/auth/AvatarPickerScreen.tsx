import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { Button } from '../../components/common/Button';
import { AVATAR_OPTIONS, COLORS, FONTS } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'AvatarPicker'>;

export function AvatarPickerScreen({ route }: Props) {
  const { phoneNumber, pin, name } = route.params;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Locks the choice as soon as one is tapped, instead of leaving every
  // avatar tappable the whole time — "Change avatar" is the one deliberate
  // way back in, rather than an accidental tap on a neighboring avatar
  // silently swapping the selection.
  const [isLocked, setIsLocked] = useState(false);
  const signup = useAuthStore((s) => s.signup);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const error = useAuthStore((s) => s.error);

  const onSelectAvatar = (index: number) => {
    setSelectedIndex(index);
    setIsLocked(true);
  };

  const handleSubmit = async () => {
    if (selectedIndex === null) return;
    try {
      await signup({ phoneNumber, pin, name, avatarIndex: selectedIndex });
      // RootNavigator swaps to Main automatically once the auth store has a token.
    } catch {
      // error surfaced via authStore.error below
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title}>Pick an avatar</Text>
      <Text style={styles.subtitle}>This is how you'll show up to your group.</Text>

      <View style={styles.grid}>
        {AVATAR_OPTIONS.map((source, index) => {
          const selected = selectedIndex === index;
          return (
            <Pressable
              key={index}
              onPress={() => onSelectAvatar(index)}
              disabled={isLocked}
              style={[styles.avatarWrap, selected && styles.avatarWrapSelected, isLocked && !selected && styles.avatarWrapDisabled]}
            >
              <Image source={source} style={styles.avatar} />
            </Pressable>
          );
        })}
      </View>

      {isLocked ? (
        <Pressable onPress={() => setIsLocked(false)} hitSlop={8} style={styles.changeButton}>
          <Text style={styles.changeButtonLabel}>Change avatar</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Create account"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={selectedIndex === null}
        style={styles.submit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 26,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    padding: 4,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapSelected: {
    borderColor: COLORS.primary,
  },
  avatarWrapDisabled: {
    opacity: 0.35,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  changeButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  changeButtonLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  error: {
    fontFamily: FONTS.regular,
    color: COLORS.statusAlert,
    marginTop: 20,
  },
  submit: {
    marginTop: 'auto',
    marginBottom: 24,
  },
});
