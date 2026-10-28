import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { EscuadraMark } from './EscuadraMark';
import { Flag } from './Flag';
import { fadeIn } from './riseIn';
import type { ShotTap } from '@/hooks/useShot';
import type { FlagCode } from '@/assets/flags/generated';
import { useT } from '@/i18n/useT';
import { feedback } from '@/lib/haptics';
import type { TileVerdict } from '@/lib/roundView';
import {
  borderWidths,
  durations,
  fontScaleCap,
  iconSize,
  opacity,
  radii,
  spacing,
  spotlightCues,
  spotlightMotion,
  typography,
  type Palette,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface AnswerTileProps {
  label: string;
  /** Under a position tile's code: "Keeper", "Defender"… */
  sub?: string;
  /** Nationality tiles only (22×15). */
  flag?: FlagCode | null;
  verdict: TileVerdict;
  /** Whether this part's pick was right. After a right pick the other tiles
   *  fade to 50 %, after a miss to 35 % (spec §6). */
  pickedRight: boolean;
  /** The least the tile is tall. It grows with the text at large sizes. */
  minHeight: number;
  /** The press, with where it landed and the tile, so the shot starts there. */
  onPress: (tap: ShotTap) => void;
  /** For the screen capture, which taps a position tile by its code, not its translated label. */
  testID?: string;
}

function look(colors: Palette, verdict: TileVerdict) {
  switch (verdict) {
    case 'correct-picked':
      return {
        bg: colors.stageSuccessBg,
        line: colors.success,
        width: borderWidths.emphasis,
        text: colors.textPrimary,
      };
    case 'correct-unpicked':
      return {
        bg: colors.stageAnswerBg,
        line: colors.success,
        width: borderWidths.emphasis,
        text: colors.textPrimary,
      };
    case 'incorrect-picked':
      return {
        bg: colors.stageErrorBg,
        line: colors.stageErrorLine,
        width: borderWidths.hairline,
        text: colors.stageErrorText,
      };
    case 'incorrect-other':
    case 'idle':
      return {
        bg: colors.tile,
        line: colors.tileLine,
        width: borderWidths.hairline,
        text: colors.textPrimary,
      };
  }
}

// One answer (spec §2.3, §2.4, §6). It keeps today's five verdicts. The
// effects:
// - a press scales it slightly, with a light haptic;
// - a right pick fills green and pops;
// - a wrong pick turns red and shakes;
// - after a miss, the right answer pops with an ANSWER tag;
// - the rest fade.
// It plays the correct and wrong haptics itself, so every part at every
// level gets them. Reduce Motion keeps colour and opacity only.
export function AnswerTile({
  label,
  sub,
  flag,
  verdict,
  pickedRight,
  minHeight,
  onPress,
  testID,
}: AnswerTileProps) {
  const colors = useThemeColors();
  const t = useT();
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const shift = useSharedValue(0);
  const fade = useSharedValue(1);
  const previous = useRef(verdict);
  const pressable = useRef<ViewInstance>(null);
  // The latest `answered`, for `onPressOut`: Pressability delays it for a press
  // shorter than 130 ms and then calls the closure from before the verdict,
  // where `answered` is still false. A press-out after the verdict must not
  // reset the scale the verdict effect is animating.
  const answeredRef = useRef(verdict !== 'idle');
  const answered = verdict !== 'idle';

  useEffect(() => {
    const from = previous.current;
    previous.current = verdict;
    answeredRef.current = verdict !== 'idle';
    const target =
      verdict === 'incorrect-other'
        ? pickedRight
          ? opacity.tileAfterCorrect
          : opacity.tileAfterMiss
        : 1;
    fade.value = withTiming(target, {
      duration: reduced ? durations.transition : durations.reveal,
    });
    if (from !== 'idle' || verdict === 'idle') return;
    if (verdict === 'correct-picked') feedback('correct');
    if (verdict === 'incorrect-picked') feedback('wrong');
    if (reduced) {
      // No press scale was applied; make sure none lingers.
      scale.value = 1;
      return;
    }
    if (verdict === 'correct-picked') {
      scale.value = withSequence(
        withTiming(spotlightMotion.popScale, {
          duration: durations.pop,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(1, { duration: durations.popSettle, easing: Easing.inOut(Easing.quad) }),
      );
    } else if (verdict === 'correct-unpicked') {
      scale.value = withDelay(
        spotlightCues.missAnswer,
        withSequence(
          withTiming(spotlightMotion.answerPopScale, { duration: durations.pop }),
          withTiming(1, { duration: durations.popSettle }),
        ),
      );
    } else if (verdict === 'incorrect-picked') {
      // Nothing else resets the press scale (0.97) on a wrong pick.
      scale.value = withTiming(1, { duration: durations.press });
      // Three swings of ±6 pt in the shake's 240 ms.
      const swing = durations.shake / 6;
      const { shake } = spotlightMotion;
      shift.value = withSequence(
        withTiming(shake, { duration: swing }),
        withTiming(-shake, { duration: swing }),
        withTiming(shake, { duration: swing }),
        withTiming(-shake, { duration: swing }),
        withTiming(shake, { duration: swing }),
        withTiming(0, { duration: swing }),
      );
    }
  }, [verdict, pickedRight, reduced, scale, shift, fade]);

  const motion = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: scale.value }, { translateX: shift.value }],
  }));
  const tone = look(colors, verdict);
  const isPosition = sub !== undefined;
  const strong = verdict === 'correct-picked' || verdict === 'correct-unpicked';
  const styles = StyleSheet.create({
    cell: { flex: 1 },
    tile: {
      // Fills its row when a neighbour grows, so the pair stays level.
      flex: 1,
      minHeight,
      borderRadius: radii.lg,
      borderWidth: tone.width,
      borderColor: tone.line,
      backgroundColor: tone.bg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: isPosition ? 'center' : 'space-between',
      gap: spacing.xs,
      paddingLeft: isPosition ? spacing.xs : spacing.md,
      paddingRight: isPosition ? spacing.xs : spacing.sm,
    },
    position: { alignItems: 'center', gap: spacing.xxs },
    code: { ...typography.tileCode, color: tone.text },
    sub: { ...typography.tileSubLabel, color: colors.tileSub },
    textBlock: { flex: 1, minWidth: 0 },
    tag: { ...typography.captionEyebrow, color: colors.stageSuccessText },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    label: {
      ...(strong ? typography.bodyStrong : typography.body),
      color: tone.text,
      flexShrink: 1,
    },
    cross: { width: iconSize.markSmall, height: iconSize.markSmall },
    bar: {
      position: 'absolute',
      top: iconSize.markSmall / 2 - borderWidths.thick,
      left: 0,
      width: iconSize.markSmall,
      height: borderWidths.thick * 2,
      borderRadius: borderWidths.thick,
      backgroundColor: colors.error,
    },
  });

  // The press handlers write `scale` with `.set()`: the effect above also uses
  // it, so the React Compiler lint rejects a `.value =` assignment here.
  return (
    <Animated.View style={[styles.cell, motion]}>
      <Pressable
        ref={pressable}
        testID={testID}
        onPress={(event) =>
          onPress({
            pageX: event.nativeEvent.pageX,
            pageY: event.nativeEvent.pageY,
            tile: pressable.current,
          })
        }
        onPressIn={() => {
          if (answered) return;
          feedback('tap');
          if (!reduced)
            scale.set(withTiming(spotlightMotion.pressScale, { duration: durations.press }));
        }}
        onPressOut={() => {
          if (!reduced && !answeredRef.current)
            scale.set(withTiming(1, { duration: durations.press }));
        }}
        disabled={answered}
        accessibilityRole="button"
        accessibilityState={{ disabled: answered }}
        // A position tile speaks its word alone: a screen reader spells the code out (#187).
        accessibilityLabel={[sub ?? label, t.round.tileSpoken[verdict]].filter(Boolean).join(', ')}
        style={styles.tile}
      >
        {isPosition ? (
          <View style={styles.position}>
            <Text style={styles.code} maxFontSizeMultiplier={fontScaleCap.display}>
              {label}
            </Text>
            <Text style={styles.sub}>{sub}</Text>
          </View>
        ) : (
          <View style={styles.textBlock}>
            {verdict === 'correct-unpicked' ? (
              <Animated.Text
                entering={fadeIn(reduced, durations.transition, spotlightCues.missAnswer)}
                style={styles.tag}
              >
                {t.round.answerTag}
              </Animated.Text>
            ) : null}
            <View style={styles.labelRow}>
              {flag ? <Flag code={flag} size="marker" label={label} /> : null}
              {/* One line under the ANSWER tag: tag and two lines overflow a
                  48-54 pt tile. The NAME (or POS, CLUB, NAT) slot above
                  shows the right answer in full after a miss. */}
              <Text
                style={styles.label}
                numberOfLines={verdict === 'correct-unpicked' ? 1 : 2}
                maxFontSizeMultiplier={fontScaleCap.display}
              >
                {label}
              </Text>
            </View>
          </View>
        )}
        {verdict === 'correct-picked' && !isPosition ? (
          <EscuadraMark size={iconSize.markLarge} color={colors.success} />
        ) : null}
        {verdict === 'incorrect-picked' && !isPosition ? (
          <View style={styles.cross}>
            <View style={[styles.bar, { transform: [{ rotate: '45deg' }] }]} />
            <View style={[styles.bar, { transform: [{ rotate: '-45deg' }] }]} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
