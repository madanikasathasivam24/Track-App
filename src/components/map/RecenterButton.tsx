import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

interface RecenterButtonProps {
  onPress: () => void;
  style?: ViewStyle;
}

// Floating "jump back to my location" control — an arrow/navigation glyph,
// matching the compass-style recenter button on Snap Map/Mapbox-style maps.
export function RecenterButton({ onPress, style }: RecenterButtonProps) {
  return (
    <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed, style]} onPress={onPress} hitSlop={8}>
      <Ionicons name="navigate" size={20} color={COLORS.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  pressed: {
    opacity: 0.8,
  },
});
