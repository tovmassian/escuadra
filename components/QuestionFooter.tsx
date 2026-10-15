import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PhotoCreditLine } from './PhotoCreditLine';
import type { FooterMode } from '@/lib/roundView';
import {
  borderWidths,
  durations,
  opacity,
  radii,
  sizes,
  spacing,
  spotlightCues,
  spotlightMotion,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { PhotoCredit } from '@/types/squad';

interface QuestionFooterProps {
  mode: FooterMode;
  compact: boolean;
  onNext: () => void;
  /** The current question's photo credit, shown for the whole question
   *  (spec §2.7, guardrail 1). */
  credit: PhotoCredit | null;
}

function risingCta(reduced: boolean) {
  if (reduced) return FadeIn.duration(durations.transition);
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: spotlightMotion.rise }] },
    100: { opacity: 1, transform: [{ translateY: 0 }] },
  })
    .duration(durations.toggle)
    .delay(spotlightCues.missCta);
}

// Under the answers (spec §2.1, §2.4):
// - before a tap, a quiet "Tap your answer";
// - after a miss, "Got it — next", which waits;
// - after a right answer, a bar that fills and moves on by itself (tap to
//   skip), or a plain "Next question" with a screen reader on.
// Then the photo credit, always.
export function QuestionFooter({ mode, compact, onNext, credit }: QuestionFooterProps) {
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const height = compact ? sizes.cta.compact : sizes.cta.normal;
  const styles = StyleSheet.create({
    footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    hint: { height, alignItems: 'center', justifyContent: 'center' },
    hintText: { ...typography.secondary, color: colors.textMuted },
    cta: {
      height,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.ctaBg,
    },
    ctaText: { ...typography.ctaLabel, color: colors.ctaText },
  });

  return (
    <View style={styles.footer}>
      {mode === 'waiting' ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Tap your answer</Text>
        </View>
      ) : null}
      {mode === 'gotIt' || mode === 'next' ? (
        <Animated.View
          entering={mode === 'gotIt' ? risingCta(reduced) : FadeIn.duration(durations.transition)}
        >
          <Pressable
            testID="question-next"
            onPress={onNext}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: opacity.settled }]}
          >
            <Text style={styles.ctaText}>
              {mode === 'gotIt' ? 'Got it — next' : 'Next question'}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
      {mode === 'autoNext' ? <NextBar height={height} onNext={onNext} /> : null}
      <PhotoCreditLine credit={credit} />
    </View>
  );
}

// Fills over `durations.autoAdvance`. The screen moves on when it is full;
// a tap moves on now.
function NextBar({ height, onNext }: { height: number; onNext: () => void }) {
  const colors = useThemeColors();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: durations.autoAdvance, easing: Easing.linear });
  }, [progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));
  const styles = StyleSheet.create({
    bar: {
      height,
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.nextLine,
      backgroundColor: colors.nextBg,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.nextFill },
    label: { ...typography.rowTitle, color: colors.nextText },
  });
  return (
    <Pressable
      testID="question-next"
      onPress={onNext}
      accessibilityRole="button"
      accessibilityLabel="Next question"
      accessibilityHint="Moves on by itself in a moment"
      style={styles.bar}
    >
      <Animated.View style={[styles.fill, fill]} />
      <Text style={styles.label}>Next question · tap to skip</Text>
    </Pressable>
  );
}
