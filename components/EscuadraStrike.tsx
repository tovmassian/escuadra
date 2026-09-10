import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MARK_SMALL_BALL_THRESHOLD, MARK_VIEWBOX, markGeometry } from '@/theme/brand';
import {
  borderWidths,
  celebrationEasingCurves,
  MOTION_DISTANCE_SCALE,
  type StrikeTiming,
} from '@/theme/tokens';

// The animated counterpart to `EscuadraMark` — used only where the mark
// plays its "a la escuadra" strike (results screen, home lockup). Everywhere
// else (icon plates, VerdictGlyph, LockGlyph, the non-hero wordmark) keeps
// using the plain static `EscuadraMark`.
//
// Motion offsets (the ball's fly-in distance, the frame's entrance offset,
// the trail's catch-up distance) are authored in the design source at the
// celebration mark's 120dp size and scaled here by `size / REFERENCE_SIZE`,
// so the choreography holds proportionally at the home lockup's smaller
// size too, rather than travelling the same fixed distance regardless of
// mark size. That same scale also carries `MOTION_DISTANCE_SCALE` (see
// theme/tokens.ts) — 1 in the shipped build, so this is a no-op until that
// preview knob is turned up.
const REFERENCE_SIZE = 120;
// Exaggerates a scale multiplier's departure from rest (1) — e.g. an
// overshoot of 1.16 becomes a bigger overshoot, never a smaller one.
function overshoot(scaleAtRest: number): number {
  return 1 + (scaleAtRest - 1) * MOTION_DISTANCE_SCALE;
}
const BALL_START = { x: -96, y: 116, scale: 0.48 };
const BALL_OVERSHOOT_SCALE = overshoot(1.16);
const BALL_SETTLE_SCALE = overshoot(0.95);
const FRAME_ENTER = { x: 7, y: -7, scale: overshoot(0.9) };
const RECOIL_BAR = { x: 3, y: -4 }; // crossbar's kick direction on impact
const RECOIL_POST = { x: 4, y: 3 }; // post's kick direction on impact
const TRAIL_START = { x: 26, y: -26 };
const FLASH_MAX_SCALE = 0.35 + (2.3 - 0.35) * MOTION_DISTANCE_SCALE;

interface EscuadraStrikeProps {
  /** Rendered edge length in dp. The mark is square. */
  size: number;
  /** Fill for the crossbar and post. */
  color: string;
  /** Ball (and trail) fill, when it differs from the frame. Defaults to `color`. */
  ballColor?: string;
  /** Per-context choreography — see `strikeTiming` in theme/tokens.ts. */
  timing: StrikeTiming;
}

export function EscuadraStrike({ size, color, ballColor = color, timing }: EscuadraStrikeProps) {
  const u = size / MARK_VIEWBOX;
  const k = (size / REFERENCE_SIZE) * MOTION_DISTANCE_SCALE;
  const { crossbar, post, ball, ballSmall } = markGeometry;
  const activeBall = size < MARK_SMALL_BALL_THRESHOLD ? ballSmall : ball;

  const strikeEasing = Easing.bezier(...celebrationEasingCurves.strike);
  const recoilEasing = Easing.bezier(...celebrationEasingCurves.recoil);
  const riseEasing = Easing.bezier(...celebrationEasingCurves.rise);

  const crossbarEnter = useSharedValue(0);
  const postEnter = useSharedValue(0);
  const kick = useSharedValue(0); // frame recoil, shared by both bars
  const bx = useSharedValue(BALL_START.x * k);
  const by = useSharedValue(BALL_START.y * k);
  const bs = useSharedValue(BALL_START.scale);
  const bOpacity = useSharedValue(0);
  const flash = useSharedValue(0);
  const trail0 = useSharedValue(0);
  const trail1 = useSharedValue(0);

  useEffect(() => {
    crossbarEnter.value = withTiming(1, { duration: timing.frameDuration, easing: riseEasing });
    postEnter.value = withDelay(
      timing.frameStagger,
      withTiming(1, { duration: timing.frameDuration, easing: riseEasing }),
    );
    kick.value = withDelay(
      timing.recoilDelay,
      withSequence(
        withTiming(1, { duration: Math.round(timing.recoilDuration * 0.29), easing: recoilEasing }),
        withTiming(-0.35, {
          duration: Math.round(timing.recoilDuration * 0.31),
          easing: recoilEasing,
        }),
        withTiming(0, { duration: Math.round(timing.recoilDuration * 0.4), easing: recoilEasing }),
      ),
    );

    bOpacity.value = withDelay(
      timing.ballDelay,
      withTiming(1, { duration: Math.round(timing.ballDuration * 0.22) }),
    );
    bx.value = withDelay(
      timing.ballDelay,
      withTiming(0, { duration: timing.ballDuration, easing: strikeEasing }),
    );
    by.value = withDelay(
      timing.ballDelay,
      withTiming(0, { duration: timing.ballDuration, easing: strikeEasing }),
    );
    bs.value = withDelay(
      timing.ballDelay,
      withSequence(
        withTiming(BALL_OVERSHOOT_SCALE, {
          duration: Math.round(timing.ballDuration * 0.72),
          easing: strikeEasing,
        }),
        withTiming(BALL_SETTLE_SCALE, { duration: Math.round(timing.ballDuration * 0.14) }),
        withTiming(1, { duration: Math.round(timing.ballDuration * 0.14) }),
      ),
    );

    if (timing.flash) {
      flash.value = withDelay(
        timing.flash.delay,
        withTiming(1, { duration: timing.flash.duration, easing: Easing.out(Easing.ease) }),
      );
    }

    if (timing.trail) {
      const { delay, duration, stagger } = timing.trail;
      trail0.value = withDelay(delay, withTiming(1, { duration, easing: riseEasing }));
      trail1.value = withDelay(delay + stagger, withTiming(1, { duration, easing: riseEasing }));
    }
    // Plays once, on mount — a fresh strike each time the results screen or
    // home screen mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crossbarStyle = useAnimatedStyle(() => ({
    opacity: crossbarEnter.value,
    transform: [
      {
        translateX: FRAME_ENTER.x * k * (1 - crossbarEnter.value) + RECOIL_BAR.x * k * kick.value,
      },
      {
        translateY: FRAME_ENTER.y * k * (1 - crossbarEnter.value) + RECOIL_BAR.y * k * kick.value,
      },
      { scale: FRAME_ENTER.scale + (1 - FRAME_ENTER.scale) * crossbarEnter.value },
    ],
  }));
  const postStyle = useAnimatedStyle(() => ({
    opacity: postEnter.value,
    transform: [
      { translateX: FRAME_ENTER.x * k * (1 - postEnter.value) + RECOIL_POST.x * k * kick.value },
      { translateY: FRAME_ENTER.y * k * (1 - postEnter.value) + RECOIL_POST.y * k * kick.value },
      { scale: FRAME_ENTER.scale + (1 - FRAME_ENTER.scale) * postEnter.value },
    ],
  }));
  const ballStyle = useAnimatedStyle(() => ({
    opacity: bOpacity.value,
    transform: [{ translateX: bx.value }, { translateY: by.value }, { scale: bs.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flash.value, [0, 0.18, 1], [0, 0.55, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(flash.value, [0, 1], [0.35, FLASH_MAX_SCALE], Extrapolation.CLAMP) },
    ],
  }));
  const trail0Style = useAnimatedStyle(() => ({
    opacity: trail0.value * markGeometry.trail[0].opacity,
    transform: [
      { translateX: TRAIL_START.x * k * (1 - trail0.value) },
      { translateY: TRAIL_START.y * k * (1 - trail0.value) },
      { scale: 0.3 + 0.7 * trail0.value },
    ],
  }));
  const trail1Style = useAnimatedStyle(() => ({
    opacity: trail1.value * markGeometry.trail[1].opacity,
    transform: [
      { translateX: TRAIL_START.x * k * (1 - trail1.value) },
      { translateY: TRAIL_START.y * k * (1 - trail1.value) },
      { scale: 0.3 + 0.7 * trail1.value },
    ],
  }));

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.piece,
          {
            left: crossbar.x * u,
            top: crossbar.y * u,
            width: crossbar.w * u,
            height: crossbar.h * u,
            backgroundColor: color,
          },
          crossbarStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.piece,
          {
            left: post.x * u,
            top: post.y * u,
            width: post.w * u,
            height: post.h * u,
            backgroundColor: color,
          },
          postStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.piece,
          {
            left: (activeBall.cx - activeBall.r) * u,
            top: (activeBall.cy - activeBall.r) * u,
            width: activeBall.r * 2 * u,
            height: activeBall.r * 2 * u,
            borderRadius: activeBall.r * u,
            backgroundColor: ballColor,
          },
          ballStyle,
        ]}
      />
      {timing.flash && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.piece,
            {
              left: (activeBall.cx - activeBall.r) * u,
              top: (activeBall.cy - activeBall.r) * u,
              width: activeBall.r * 2 * u,
              height: activeBall.r * 2 * u,
              borderRadius: activeBall.r * u,
              borderWidth: borderWidths.emphasis,
              borderColor: ballColor,
            },
            flashStyle,
          ]}
        />
      )}
      {timing.trail && (
        <>
          <Animated.View
            style={[
              styles.piece,
              {
                left: markGeometry.trail[0].x * u,
                top: markGeometry.trail[0].y * u,
                width: markGeometry.trail[0].size * u,
                height: markGeometry.trail[0].size * u,
                backgroundColor: ballColor,
              },
              trail0Style,
            ]}
          />
          <Animated.View
            style={[
              styles.piece,
              {
                left: markGeometry.trail[1].x * u,
                top: markGeometry.trail[1].y * u,
                width: markGeometry.trail[1].size * u,
                height: markGeometry.trail[1].size * u,
                backgroundColor: ballColor,
              },
              trail1Style,
            ]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  piece: { position: 'absolute' },
});
