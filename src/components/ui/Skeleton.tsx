import React, { useEffect } from 'react';
import type { DimensionValue, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { COLORS } from '../../utils/constants';

interface SkeletonProps {
  width?: DimensionValue;
  height: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

// A pulsing grey placeholder block — the base primitive for skeleton loading
// states across the app (see e.g. HomeScreen/FriendsListScreen for composed
// row/card skeletons built from this).
export function Skeleton({ width = '100%', height, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: COLORS.border }, animatedStyle, style]} />
  );
}
