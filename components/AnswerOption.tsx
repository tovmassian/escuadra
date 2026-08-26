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
import { VerdictGlyph } from './VerdictGlyph';
import {
  borderWidths,
  colors,
  durations,
  iconSize,
  opacity,
  radii,
  spacing,
  typography,
} from '@/theme/tokens';

// Five states, not four — the design gives "you picked the right answer" and
// "you picked wrong, here's what was right" visibly different weight (a
// modest pop vs. a bigger/bolder card with a "CORRECT ANSWER" caption), so
// collapsing them into one `correct` verdict would lose that asymmetry.
export type OptionVerdict =
  'idle' | 'correct-picked' | 'correct-unpicked' | 'incorrect-picked' | 'incorrect-other';

interface AnswerOptionProps {
  label: string;
  verdict: OptionVerdict;
  disabled?: boolean;
  onPress: () => void;
}

const VERDICT_BG: Record<OptionVerdict, string> = {
  idle: colors.surface,
  'correct-picked': colors.successBg,
  'correct-unpicked': colors.successBg,
  'incorrect-picked': colors.surface, // background fades to transparent via opacity below
  'incorrect-other': colors.surface,
};
const VERDICT_BORDER: Record<OptionVerdict, string> = {
  idle: colors.border,
  'correct-picked': colors.success,
  'correct-unpicked': colors.success,
  'incorrect-picked': colors.errorBorderDim,
  'incorrect-other': colors.border,
};
const VERDICT_TEXT: Record<OptionVerdict, string> = {
  idle: colors.textPrimary,
  'correct-picked': colors.success,
  'correct-unpicked': colors.success,
  'incorrect-picked': colors.errorTextDim,
  'incorrect-other': colors.textMuted,
};
const VERDICT_OPACITY: Record<OptionVerdict, number> = {
  idle: 1,
  'correct-picked': 1,
  'correct-unpicked': 1,
  'incorrect-picked': opacity.dimmed,
  'incorrect-other': opacity.faded,
};

export function AnswerOption({ label, verdict, disabled, onPress }: AnswerOptionProps) {
  const pressScale = useSharedValue(1);
  const revealProgress = useSharedValue(verdict === 'idle' ? 0 : 1);
  const popScale = useSharedValue(1);
  const boxOpacity = useSharedValue(VERDICT_OPACITY[verdict]);

  useEffect(() => {
    if (verdict === 'idle') {
      revealProgress.value = withTiming(0, { duration: durations.press });
      boxOpacity.value = withTiming(1, { duration: durations.reveal });
      return;
    }
    revealProgress.value = withTiming(1, {
      duration: durations.reveal,
      easing: Easing.out(Easing.cubic),
    });
    boxOpacity.value = withTiming(VERDICT_OPACITY[verdict], { duration: durations.reveal });

    if (verdict === 'correct-picked') {
      popScale.value = withSequence(
        withTiming(1.04, { duration: durations.pop, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: durations.popSettle, easing: Easing.inOut(Easing.quad) }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (verdict === 'correct-unpicked') {
      popScale.value = withSequence(
        withTiming(1.03, { duration: durations.pop, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: durations.popSettle, easing: Easing.inOut(Easing.quad) }),
      );
    } else if (verdict === 'incorrect-picked') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [verdict, revealProgress, popScale, boxOpacity]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    pressScale.value = withTiming(0.97, {
      duration: durations.press,
      easing: Easing.out(Easing.quad),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [disabled, pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withTiming(1, {
      duration: durations.press,
      easing: Easing.out(Easing.quad),
    });
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
    borderWidth: verdict === 'correct-unpicked' ? borderWidths.emphasis : borderWidths.thick,
    opacity: boxOpacity.value,
    transform: [{ scale: pressScale.value * popScale.value }],
  }));

  const isEmphasised = verdict === 'correct-unpicked';

  return (
    <Pressable
      testID="answer-option"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={styles.row}>
          <Text
            style={[
              isEmphasised ? styles.labelEmphasis : styles.label,
              { color: VERDICT_TEXT[verdict] },
            ]}
          >
            {label}
          </Text>
          {(verdict === 'correct-picked' || verdict === 'correct-unpicked') && (
            <VerdictGlyph correct />
          )}
          {verdict === 'incorrect-picked' && (
            <VerdictGlyph correct={false} size={iconSize.markSmall} />
          )}
        </View>
        {verdict === 'correct-unpicked' && (
          <Text style={styles.correctCaption}>CORRECT ANSWER</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
  labelEmphasis: {
    ...typography.bodyEmphasis,
  },
  correctCaption: {
    ...typography.captionEyebrow,
    color: colors.success,
    marginTop: spacing.xxs - 1,
  },
});
