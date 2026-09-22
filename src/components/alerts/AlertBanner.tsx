import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS } from '../../utils/constants';

interface AlertBannerProps {
  message: string;
}

// Placeholder shell — full alert UI/animation lands with the Alerts screens pass.
export function AlertBanner({ message }: AlertBannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.statusAlert,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
  },
});
