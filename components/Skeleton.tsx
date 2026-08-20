import React, { useEffect } from 'react';
import { DimensionValue, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, durations, opacity, radii } from '@/theme/tokens';

interface SkeletonProps {
  width: DimensionValue;
  height: DimensionValue;
  radius?: number;
}

// No spinner, per the design spec: "a spinner reads as broken, a shimmer
// reads as arriving." A gently pulsing opacity block instead.
export function Skeleton({ width, height, radius = radii.sm }: SkeletonProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(opacity.faded, {
          duration: durations.skeleton,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(1, { duration: durations.skeleton, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: radius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceRaised },
});
