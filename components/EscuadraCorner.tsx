import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  celebrationEasingCurves,
  durations,
  sizes,
  spotlightCues,
  spotlightMotion,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export type CornerState = 'asking' | 'correct' | 'wrong';

// The escuadra corner at the shirt number's top right (spec §2.1, §6).
// - Asking: accent.
// - Right answer: green, and the ball drops into the corner.
// - Miss: red, and the ball hits the post and bounces out.
// Reduce Motion keeps the colours and shows the ball without movement.
export function EscuadraCorner({ state }: { state: CornerState }) {
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const { arm, bar, ball } = sizes.corner.question;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (state === 'asking') {
      x.value = 0;
      y.value = 0;
      scale.value = 1;
      shown.value = 0;
      return;
    }
    if (reduced) {
      x.value = 0;
      y.value = 0;
      scale.value = 1;
      shown.value = state === 'correct' ? withTiming(1, { duration: durations.transition }) : 0;
      return;
    }
    const drop = spotlightMotion.ballDrop;
    if (state === 'correct') {
      const strike = Easing.bezier(...celebrationEasingCurves.strike);
      x.value = 0;
      y.value = -drop;
      scale.value = spotlightMotion.ballStartScale;
      shown.value = 0;
      y.value = withDelay(
        spotlightCues.ball,
        withTiming(0, { duration: durations.ballDrop, easing: strike }),
      );
      scale.value = withDelay(
        spotlightCues.ball,
        withTiming(1, { duration: durations.ballDrop, easing: strike }),
      );
      shown.value = withDelay(
        spotlightCues.ball,
        withTiming(1, { duration: durations.ballDrop / 2 }),
      );
      return;
    }
    // A miss: down onto the post, then off it, down and to the left, gone.
    const half = durations.ballBounce / 2;
    x.value = 0;
    y.value = -drop;
    scale.value = 1;
    shown.value = 1;
    y.value = withSequence(
      withTiming(0, { duration: half }),
      withTiming(drop * 2, { duration: half }),
    );
    x.value = withSequence(
      withTiming(0, { duration: half }),
      withTiming(-drop * 2, { duration: half }),
    );
    shown.value = withSequence(
      withTiming(1, { duration: half }),
      withTiming(0, { duration: half }),
    );
  }, [state, reduced, x, y, scale, shown]);

  const ballStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));
  const frame =
    state === 'correct' ? colors.success : state === 'wrong' ? colors.error : colors.accentLine;
  const styles = StyleSheet.create({
    corner: { position: 'absolute', top: 0, right: 0, width: arm, height: arm },
    crossbar: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: arm,
      height: bar,
      backgroundColor: frame,
    },
    post: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: bar,
      height: arm,
      backgroundColor: frame,
    },
    ball: {
      position: 'absolute',
      top: bar,
      right: bar + (arm - bar - ball) / 2,
      width: ball,
      height: ball,
      borderRadius: ball / 2,
      backgroundColor: state === 'wrong' ? colors.error : colors.success,
    },
  });

  return (
    <View
      pointerEvents="none"
      style={styles.corner}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.crossbar} />
      <View style={styles.post} />
      <Animated.View style={[styles.ball, ballStyle]} />
    </View>
  );
}
