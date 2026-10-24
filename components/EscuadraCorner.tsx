import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { CORNER_BALL, type LiveShot } from '@/lib/shot';
import {
  borderWidths,
  celebrationEasingCurves,
  durations,
  sizes,
  spotlightMotion,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

const { arm, bar, ball } = sizes.corner.question;
const { cornerKick, ring, shot } = spotlightMotion;
// The kick as keyframes over its progress, at rest at both ends; y moves
// opposite to x.
const KICK_AT = [0, ...cornerKick.map((swing) => swing.at), 1];
const KICK_X = [0, ...cornerKick.map((swing) => swing.x), 0];
const KICK_SCALE = [1, ...cornerKick.map((swing) => swing.scale), 1];
const kickEasing = Easing.out(Easing.quad);
const ringEasing = Easing.bezierFn(...celebrationEasingCurves.rise);

interface EscuadraCornerProps {
  /** The question on screen: a shot for another question (the one sliding
   *  out) leaves this corner as it is. */
  question: number;
  /** The shot and its clock, the ms since the ball left the tile (`useShot`). */
  live: SharedValue<LiveShot | null>;
  clock: SharedValue<number>;
  /** The corner's box, which never moves: the shot measures it to aim. */
  ref?: Ref<ViewInstance>;
}

// The escuadra corner at the shirt number's top right (spec §2.1, §6, #129).
// It reacts on the shot's clock, so it turns on the frame the ball arrives.
// - Asking: accent.
// - A goal: as the ball lands, the corner turns green, the frame kicks, a
//   ring flashes out and the ball settles under the crossbar, where it stays.
// - A miss: it turns red as the ball goes by. The frame never moves.
// Under Reduce Motion nothing flies (`useShot`). The colour turns, the ball
// fades in on a goal, and nothing moves.
export function EscuadraCorner({ question, live, clock, ref }: EscuadraCornerProps) {
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const asking = colors.accentLine;
  const goal = colors.success;
  const miss = colors.error;
  const turn = durations.transition;
  const kick = durations.cornerShake;
  const flash = durations.ring;
  const settle = durations.shotSettle;

  const bars = useAnimatedStyle(() => {
    const s = live.value;
    const since = s && s.question === question ? clock.value - s.impact : -1;
    const turned = since < 0 ? 0 : Math.min(1, since / turn);
    return {
      backgroundColor: interpolateColor(
        turned,
        [0, 1],
        [asking, s?.verdict === 'miss' ? miss : goal],
      ),
    };
  });

  const frame = useAnimatedStyle(() => {
    const s = live.value;
    const since =
      s && s.question === question && s.verdict === 'goal' && !reduced
        ? clock.value - s.impact
        : -1;
    const p = since < 0 || since >= kick ? 0 : kickEasing(since / kick);
    const x = interpolate(p, KICK_AT, KICK_X);
    return {
      transform: [
        { translateX: x },
        { translateY: -x },
        { scale: interpolate(p, KICK_AT, KICK_SCALE) },
      ],
    };
  });

  const flashStyle = useAnimatedStyle(() => {
    const s = live.value;
    const since =
      s && s.question === question && s.verdict === 'goal' && !reduced
        ? clock.value - s.impact
        : -1;
    if (since < 0 || since >= flash) return { opacity: 0, transform: [{ scale: ring.from }] };
    const p = ringEasing(since / flash);
    return {
      opacity: interpolate(p, [0, 1], [ring.opacity, 0]),
      transform: [{ scale: interpolate(p, [0, 1], [ring.from, ring.to]) }],
    };
  });

  const ballStyle = useAnimatedStyle(() => {
    const s = live.value;
    const since =
      s && s.question === question && s.verdict === 'goal' ? clock.value - s.impact : -1;
    if (since < 0) return { opacity: 0, transform: [{ scale: 1 }] };
    if (reduced) return { opacity: Math.min(1, since / turn), transform: [{ scale: 1 }] };
    return {
      opacity: 1,
      transform: [
        {
          scale: interpolate(
            since,
            [0, settle / 2, settle],
            [1, shot.settleScale, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const styles = StyleSheet.create({
    corner: { position: 'absolute', top: 0, right: 0, width: arm, height: arm },
    // It kicks from its top right, where the bars meet.
    frame: { transformOrigin: 'top right' },
    crossbar: { position: 'absolute', top: 0, right: 0, width: arm, height: bar },
    post: { position: 'absolute', top: 0, right: 0, width: bar, height: arm },
    ring: {
      position: 'absolute',
      left: CORNER_BALL.x - arm / 2,
      top: CORNER_BALL.y - arm / 2,
      width: arm,
      height: arm,
      borderRadius: arm / 2,
      borderWidth: borderWidths.emphasis,
      borderColor: goal,
    },
    ball: {
      position: 'absolute',
      left: CORNER_BALL.x - ball / 2,
      top: CORNER_BALL.y - ball / 2,
      width: ball,
      height: ball,
      borderRadius: ball / 2,
      backgroundColor: goal,
    },
  });

  return (
    <View
      ref={ref}
      pointerEvents="none"
      style={styles.corner}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.frame, frame]}>
        <Animated.View style={[styles.crossbar, bars]} />
        <Animated.View style={[styles.post, bars]} />
      </Animated.View>
      <Animated.View style={[styles.ring, flashStyle]} />
      <Animated.View style={[styles.ball, ballStyle]} />
    </View>
  );
}
