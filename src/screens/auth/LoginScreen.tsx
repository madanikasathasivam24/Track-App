import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { COLORS, FONTS, PIN_LENGTH } from '../../utils/constants';
import { useAuthStore, getAndClearSessionEndReason } from '../../store/authStore';

const loginSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'Enter a valid 10-digit phone number'),
  pin: z
    .string()
    .length(PIN_LENGTH.min, `PIN must be ${PIN_LENGTH.min} digits`)
    .regex(/^[0-9]+$/, 'Numbers only'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const error = useAuthStore((s) => s.error);
  // Temporary diagnostic for the still-unreproduced-on-demand "closed the app,
  // came back logged out" bug — remove this and the breadcrumb plumbing in
  // authStore.ts once it's confirmed fixed.
  const [sessionEndReason, setSessionEndReason] = useState<string | null>(null);
  useEffect(() => {
    getAndClearSessionEndReason().then(setSessionEndReason);
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phoneNumber: '', pin: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values);
      // RootNavigator swaps to Main automatically once the auth store has a token.
    } catch {
      // error surfaced via authStore.error below
    }
  };

  const onGooglePress = async () => {
    try {
      await loginWithGoogle();
    } catch {
      // error surfaced via authStore.error below
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
          <Text style={[styles.title, styles.centerText]}>Welcome back</Text>
          <Text style={[styles.subtitle, styles.centerText]}>Log in to see where your group is.</Text>

          <Controller
            control={control}
            name="phoneNumber"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Phone number"
                placeholder="98765 43210"
                keyboardType="number-pad"
                maxLength={10}
                value={value}
                onBlur={onBlur}
                onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
                error={errors.phoneNumber?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="pin"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="PIN"
                placeholder="••••"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH.max}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.pin?.message}
              />
            )}
          />

          {error ? <Text style={[styles.error, styles.centerText]}>{error}</Text> : null}

          {sessionEndReason ? <Text style={styles.debugReason}>{sessionEndReason}</Text> : null}

          <Button label="Log in" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={styles.submit} />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            label="Continue with Google"
            variant="secondary"
            onPress={onGooglePress}
            loading={isSubmitting}
            style={styles.submit}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Track? </Text>
            <Text style={styles.footerLink} onPress={() => navigation.navigate('Signup')}>
              Create an account
            </Text>
          </View>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  centerText: {
    textAlign: 'center',
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
  error: {
    fontFamily: FONTS.regular,
    color: COLORS.statusAlert,
    marginBottom: 12,
  },
  debugReason: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  submit: {
    marginTop: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  footerLink: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },
});
