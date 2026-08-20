import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { OptionVerdict } from './AnswerOption';
import {
  borderWidths,
  colors,
  durations,
  opacity,
  radii,
  spacing,
  typography,
} from '@/theme/tokens';

interface ChipOptionProps {
  label: string;
  verdict: OptionVerdict;
  disabled?: boolean;
  onPress: () => void;
}

// Position chips (GK/DF/MF/FW) reuse AnswerOption's verdict vocabulary for
// consistent colour logic, but lay out as equal-flex pills with no marks or
// "CORRECT ANSWER" caption — the design treats both correct states alike here.
const BG: Record<OptionVerdict, string> = {
  idle: colors.surface,
  'correct-picked': colors.successBg,
  'correct-unpicked': colors.successBg,
  'incorrect-picked': colors.errorBg,
  'incorrect-other': colors.surface,
};
const BORDER: Record<OptionVerdict, string> = {
  idle: colors.border,
  'correct-picked': colors.success,
  'correct-unpicked': colors.success,
  'incorrect-picked': colors.error,
  'incorrect-other': colors.border,
};
const TEXT: Record<OptionVerdict, string> = {
  idle: colors.textPrimary,
  'correct-picked': colors.success,
  'correct-unpicked': colors.success,
  'incorrect-picked': colors.error,
  'incorrect-other': colors.textMuted,
};

export function ChipOption({ label, verdict, disabled, onPress }: ChipOptionProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withTiming(0.97, { duration: durations.press, easing: Easing.out(Easing.quad) });
  }, [disabled, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: durations.press, easing: Easing.out(Easing.quad) });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      style={styles.flex}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Animated.View
        style={[
          styles.chip,
          { backgroundColor: BG[verdict], borderColor: BORDER[verdict] },
          verdict === 'incorrect-other' && { opacity: opacity.faded },
          animatedStyle,
        ]}
      >
        <Text style={[styles.label, { color: TEXT[verdict] }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chip: {
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.chipLabel },
});
