import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

interface PulsingDotProps {
  color: string;
  size?: number;
  // Rendered in place of the plain colored dot (e.g. an avatar image) — the
  // pulsing ring behind it still uses `color`.
  children?: React.ReactNode;
}

export function PulsingDot({ color, size = 18, children }: PulsingDotProps) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(withTiming(2.2, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ringStyle]}
      />
      {children ?? (
        <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  dot: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
