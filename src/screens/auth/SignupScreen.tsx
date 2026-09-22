import React from 'react';
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

const signupSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'Enter a valid 10-digit phone number'),
  pin: z
    .string()
    .length(PIN_LENGTH.min, `PIN must be ${PIN_LENGTH.min} digits`)
    .regex(/^[0-9]+$/, 'Numbers only'),
  name: z.string().trim().min(1, 'Enter your name'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { phoneNumber: '', pin: '', name: '' },
  });

  const onSubmit = (values: SignupFormValues) => {
    navigation.navigate('AvatarPicker', values);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={40}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Track keeps your group in sync — let's get you set up.</Text>

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Name"
              placeholder="Your name"
              autoCapitalize="words"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.name?.message}
            />
          )}
        />

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
              label={`PIN (${PIN_LENGTH.min} digits)`}
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

        <Button label="Continue" onPress={handleSubmit(onSubmit)} style={styles.submit} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Text style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
            Log in
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
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
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
  submit: {
    marginTop: 8,
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
