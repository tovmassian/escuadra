// PROVISIONAL — sample output from the design pass, wired into the setup-check
// screen so the token set can be verified on device. It is the one place that
// still breaks hard constraint 5 (raw fontSize / borderWidth / marginTop
// literals). Expect the real design to replace this file wholesale; do not build
// on it or copy its hardcoded values.
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export type OptionVerdict = 'unanswered' | 'correct' | 'incorrect-picked' | 'incorrect-other';

interface AnswerOptionProps {
  label: string;
  verdict: OptionVerdict;
  disabled?: boolean;
  onPress: () => void;
}

// Colour stops per verdict — background/border only; text colour is derived below.
const VERDICT_BG: Record<OptionVerdict, string> = {
  unanswered: colors.surface,
  correct: colors.successBg,
  'incorrect-picked': colors.surface,
  'incorrect-other': colors.surface,
};
const VERDICT_BORDER: Record<OptionVerdict, string> = {
  unanswered: colors.border,
  correct: colors.success,
  'incorrect-picked': colors.errorBorderDim,
  'incorrect-other': colors.border,
};
const VERDICT_TEXT: Record<OptionVerdict, string> = {
  unanswered: colors.textPrimary,
  correct: colors.success,
  'incorrect-picked': colors.error,
  'incorrect-other': colors.textMuted,
};

export function AnswerOption({ label, verdict, disabled, onPress }: AnswerOptionProps) {
  const pressScale = useSharedValue(1);
  const revealProgress = useSharedValue(verdict === 'unanswered' ? 0 : 1);
  const popScale = useSharedValue(1);

  useEffect(() => {
    if (verdict === 'unanswered') {
      revealProgress.value = withTiming(0, { duration: 140 });
      return;
    }
    revealProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    if (verdict === 'correct') {
      popScale.value = withSequence(
        withTiming(1.04, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 120, easing: Easing.inOut(Easing.quad) }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (verdict === 'incorrect-picked') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [verdict, revealProgress, popScale]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    pressScale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.quad) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [disabled, pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) });
  }, [pressScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      revealProgress.value,
      [0, 1],
      [colors.surface, VERDICT_BG[verdict]],
    ),
    borderColor: interpolateColor(
      revealProgress.value,
      [0, 1],
      [colors.border, VERDICT_BORDER[verdict]],
    ),
    opacity: verdict === 'incorrect-other' ? 1 - 0.3 * revealProgress.value : 1,
    transform: [{ scale: pressScale.value * popScale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: VERDICT_TEXT[verdict] }]}>{label}</Text>
          {verdict === 'correct' && <Text style={[styles.mark, { color: colors.success }]}>✓</Text>}
          {verdict === 'incorrect-picked' && (
            <Text style={[styles.markSmall, { color: colors.error }]}>✕</Text>
          )}
        </View>
        {verdict === 'correct' && <Text style={styles.correctCaption}>CORRECT ANSWER</Text>}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: radii.lg,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.body,
  },
  mark: {
    fontSize: 18,
    fontWeight: '700',
  },
  markSmall: {
    fontSize: 13,
    fontWeight: '700',
  },
  correctCaption: {
    ...typography.eyebrow,
    fontSize: 10.5,
    color: colors.success,
    marginTop: 3,
  },
});
