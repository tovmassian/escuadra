import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PhotoCreditLine } from './PhotoCreditLine';
import { riseIn } from './riseIn';
import { useT } from '@/i18n/useT';
import { nextButtonText, type FooterMode } from '@/lib/roundView';
import {
  borderWidths,
  durations,
  opacity,
  sizes,
  spacing,
  spotlightCues,
  spotlightMotion,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { PhotoCredit } from '@/types/squad';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface QuestionFooterProps {
  mode: FooterMode;
  compact: boolean;
  /** The round's last question, whose button goes to the results. */
  last: boolean;
  onNext: () => void;
  /** The current question's photo credit, shown for the whole question
   *  (spec §2.7, guardrail 1). */
  credit: PhotoCredit | null;
}

// Under the answers (spec §2.1, §2.4):
// - before a tap, a quiet "Tap your answer";
// - after a miss, "Got it — next", which waits;
// - after a right answer, a bar that fills and moves on by itself (tap to
//   skip), or a plain "Next question" with a screen reader on.
// On the last question each says "See results" instead.
// Then the photo credit, always.
export function QuestionFooter({ mode, compact, last, onNext, credit }: QuestionFooterProps) {
  const colors = useThemeColors();
  const t = useT();
  const reduced = useReduceMotion();
  // The least the button is tall; it grows with the text at large sizes.
  const minHeight = compact ? sizes.cta.compact : sizes.cta.normal;
  const styles = StyleSheet.create({
    footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    hint: {
      minHeight,
      paddingVertical: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintText: { ...typography.secondary, color: colors.textMuted },
    cta: {
      minHeight,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: minHeight / 2,
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
          <Text style={styles.hintText}>{t.round.tapYourAnswer}</Text>
        </View>
      ) : null}
      {mode === 'gotIt' || mode === 'next' ? (
        <Animated.View
          entering={
            mode === 'gotIt'
              ? riseIn(reduced, spotlightMotion.rise, durations.toggle, spotlightCues.missCta)
              : FadeIn.duration(durations.transition)
          }
        >
          <Pressable
            testID="question-next"
            onPress={onNext}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: opacity.settled }]}
          >
            <Text style={styles.ctaText}>{nextButtonText(mode, last, t).label}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
      {mode === 'autoNext' ? <NextBar minHeight={minHeight} last={last} onNext={onNext} /> : null}
      <PhotoCreditLine credit={credit} />
    </View>
  );
}

// Fills over `durations.autoAdvance`. The screen moves on when it is full;
// a tap moves on now.
function NextBar({
  minHeight,
  last,
  onNext,
}: {
  minHeight: number;
  last: boolean;
  onNext: () => void;
}) {
  const colors = useThemeColors();
  const t = useT();
  const text = nextButtonText('autoNext', last, t);
  const progress = useSharedValue(0);
  useEffect(() => {
    // A timer cue, not decorative motion: it shows how long is left before the
    // round moves on, so it runs under Reduce Motion too. Left to Reanimated's
    // default (`ReduceMotion.System`), it would jump to full at once.
    progress.value = withTiming(1, {
      duration: durations.autoAdvance,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    });
  }, [progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));
  const styles = StyleSheet.create({
    bar: {
      minHeight,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: minHeight / 2,
      borderWidth: borderWidths.hairline,
      borderColor: colors.nextLine,
      backgroundColor: colors.nextBg,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.nextFill },
    // The main button's face, so the two read as one button in two states.
    label: { ...typography.ctaLabel, color: colors.nextText },
  });
  return (
    <Pressable
      testID="question-next"
      onPress={onNext}
      accessibilityRole="button"
      accessibilityLabel={text.spoken}
      accessibilityHint={t.round.movesOn}
      style={styles.bar}
    >
      <Animated.View style={[styles.fill, fill]} />
      <Text style={styles.label}>{text.label}</Text>
    </Pressable>
  );
}
