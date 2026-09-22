import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../utils/constants';

// Placeholder — deferred until the LiveShare pass (see WHAT NOT TO BUILD YET).
export function ReceivedShareScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Received share — coming soon</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
});
