import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { createGroup } from '../../services/api/groups.api';
import { getCommonErrorMessage } from '../../utils/apiError';
import { COLORS, FONTS } from '../../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export function CreateGroupScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError('Give your group a name');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const group = await createGroup({ name: name.trim(), description: description.trim() || undefined });
      navigation.goBack();
      navigation.navigate('GroupDetails', { groupId: group.id });
    } catch (err) {
      setError(getCommonErrorMessage(err));
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

          <Text style={styles.title}>Create a group</Text>
          <Text style={styles.subtitle}>You'll get an invite code and QR others can join with.</Text>

          <Input label="Group name" placeholder="Weekend Hike" value={name} onChangeText={setName} autoFocus />
          <Input
            label="Description (optional)"
            placeholder="What's this group for?"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={styles.descriptionInput}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Create group" onPress={onSubmit} loading={isSubmitting} style={styles.submit} />
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
  descriptionInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 16,
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
