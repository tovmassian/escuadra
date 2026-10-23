import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useReduceMotion } from './useReduceMotion';
import { useScreenReader } from './useScreenReader';
import { A_LA_ESCUADRA, ESCUADRA_WORDMARK } from '@/i18n/names';
import { useT } from '@/i18n/useT';
import { introPlan, type IntroPlan } from '@/lib/launchIntro';
import { MARK_VIEWBOX, markGeometry } from '@/theme/brand';
import {
  celebrationEasingCurves,
  durations,
  fontScaleCap,
  launchIntro,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The launch intro (#182), "the strike": on a cold launch the Escuadra mark is
// drawn as a perfect shot over the root stack, then fades to whatever the stack
// shows first. Four beats:
//   1. Frame: the crossbar and post in `mark`, "TAP TO SKIP" at the foot.
//   2. Shot: the ball flies in from off-screen bottom left on an arc, shrinking
//      to size; each trail square shows as the ball passes it.
//   3. Goal: frame and ball flash `success`, a ring flashes out from the ball,
//      the frame kicks up and right.
//   4. A la escuadra: the colour comes back, the wordmark rises in, the tagline
//      fades in under it, the skip hint fades out. Then the whole intro fades.
// Every stop is in `launchIntro` (theme/tokens.ts), the canvas's timeline; the
// mark is `markGeometry` in plain Views, as `EscuadraMark` draws it. When it
// plays (once per JS launch, the end frame under Reduce Motion, never with a
// screen reader) is `introPlan` (lib/launchIntro.ts). A tap anywhere skips.

// Set when the intro first mounts: a remount in the same JS launch (Android's
// back-out and reopen) never replays it.
let shown = false;

// Asked as the module loads, so a screen reader that is on already is known by
// the first mount (false while the answer is out). Not on web, where
// react-native-web resolves `true` whatever the browser (`useScreenReader`).
let screenReaderAtLaunch = false;
if (Platform.OS !== 'web') {
  AccessibilityInfo.isScreenReaderEnabled()
    .then((enabled) => {
      screenReaderAtLaunch = enabled;
    })
    .catch(() => {});
}

// The root fade runs under Reduce Motion too (the `still` plan holds its end
// frame, then fades): left to Reanimated's default, it would end at once.
const FADE = { reduceMotion: ReduceMotion.Never } as const;

export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const screenReader = useScreenReader();
  // Decided once, on mount, with the screen reader answer asked at load. If
  // that answer comes later, `useScreenReader` brings it and the effect below
  // ends the intro.
  const [plan] = useState<IntroPlan>(() =>
    introPlan({ alreadyShown: shown, screenReader: screenReaderAtLaunch, reduceMotion }),
  );
  const still = plan === 'still';

  // `onDone` is called once, whichever ends it first: the timeline, a tap or a
  // screen reader. A ref, so the worklet callbacks started on mount call the
  // current one.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };
  const skippingRef = useRef(false);

  // One value per layer, each run between its own stops. `still` starts every
  // one at its end-frame state.
  const ballIn = useSharedValue(still ? 1 : 0);
  const flyX = useSharedValue(still ? 1 : 0);
  const flyY = useSharedValue(still ? 1 : 0);
  const trailNear = useSharedValue(still ? 1 : 0);
  const trailFar = useSharedValue(still ? 1 : 0);
  const goal = useSharedValue(0); // 0 = `mark`, 1 = `success`
  const ringT = useSharedValue(0);
  const kick = useSharedValue(0);
  const word = useSharedValue(still ? 1 : 0);
  const tagline = useSharedValue(still ? 1 : 0);
  const skipHint = useSharedValue(still ? 0 : 1);
  const fade = useSharedValue(1);

  useEffect(() => {
    shown = true;
    if (plan === 'none') {
      finish();
      return;
    }
    const easeOut = Easing.out(Easing.ease);
    if (plan === 'play') {
      const { ballIn: inT, flight, trail, flash, ring, colourBack, wordmark } = launchIntro;
      ballIn.set(
        withDelay(inT.at, withTiming(1, { duration: inT.duration, easing: Easing.linear })),
      );
      flyX.set(
        withDelay(flight.at, withTiming(1, { duration: flight.duration, easing: Easing.linear })),
      );
      flyY.set(
        withDelay(
          flight.at,
          withTiming(1, { duration: flight.duration, easing: Easing.bezier(...flight.curve) }),
        ),
      );
      trailNear.set(
        withDelay(
          trail[0].at,
          withTiming(1, { duration: trail[0].duration, easing: Easing.linear }),
        ),
      );
      trailFar.set(
        withDelay(
          trail[1].at,
          withTiming(1, { duration: trail[1].duration, easing: Easing.linear }),
        ),
      );
      goal.set(
        withDelay(
          flash.at,
          withSequence(
            withTiming(1, { duration: flash.duration, easing: Easing.linear }),
            withDelay(
              colourBack.at - flash.at - flash.duration,
              withTiming(0, { duration: colourBack.duration, easing: Easing.linear }),
            ),
          ),
        ),
      );
      ringT.set(withDelay(ring.at, withTiming(1, { duration: ring.duration, easing: easeOut })));
      kick.set(
        withDelay(
          launchIntro.kick.at,
          withSequence(
            withTiming(1, { duration: launchIntro.kick.rise, easing: easeOut }),
            withTiming(0, { duration: launchIntro.kick.settle, easing: easeOut }),
          ),
        ),
      );
      word.set(
        withDelay(
          wordmark.at,
          withTiming(1, {
            duration: wordmark.duration,
            easing: Easing.bezier(...celebrationEasingCurves.rise),
          }),
        ),
      );
      tagline.set(
        withDelay(
          launchIntro.tagline.at,
          withTiming(1, { duration: launchIntro.tagline.duration, easing: Easing.linear }),
        ),
      );
      skipHint.set(
        withDelay(
          launchIntro.skipHint.at,
          withTiming(0, { duration: launchIntro.skipHint.duration, easing: Easing.linear }),
        ),
      );
    }
    fade.set(
      withDelay(
        launchIntro.end,
        withTiming(0, { duration: launchIntro.fadeOut, ...FADE }, (finished) => {
          if (finished) scheduleOnRN(finish);
        }),
        FADE.reduceMotion,
      ),
    );
    // Plays once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A screen reader that answers after the intro has started ends it at once.
  useEffect(() => {
    if (screenReader) finish();
  }, [screenReader]);

  const skip = () => {
    if (skippingRef.current) return;
    skippingRef.current = true;
    fade.set(
      withTiming(0, { duration: durations.transition, ...FADE }, (finished) => {
        if (finished) scheduleOnRN(finish);
      }),
    );
  };

  const u = sizes.introMark / MARK_VIEWBOX;
  // 200 dp is far over `MARK_SMALL_BALL_THRESHOLD`: the large ball.
  const { crossbar, post, ball, trail } = markGeometry;
  const { mark, success } = colors;

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const frameStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: launchIntro.kick.offset * u * kick.value },
      { translateY: -launchIntro.kick.offset * u * kick.value },
    ],
  }));
  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(goal.value, [0, 1], [mark, success]),
  }));
  const ballStyle = useAnimatedStyle(() => ({
    opacity: ballIn.value,
    backgroundColor: interpolateColor(goal.value, [0, 1], [mark, success]),
    transform: [
      { translateX: launchIntro.flight.from.x * u * (1 - flyX.value) },
      { translateY: launchIntro.flight.from.y * u * (1 - flyY.value) },
      { scale: 1 + (launchIntro.flight.scale - 1) * (1 - flyX.value) },
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    // Invisible until it starts, then it fades as it grows.
    opacity: ringT.value === 0 ? 0 : launchIntro.ring.opacity * (1 - ringT.value),
    transform: [
      { scale: interpolate(ringT.value, [0, 1], [launchIntro.ring.from, launchIntro.ring.to]) },
    ],
  }));
  const trailNearStyle = useAnimatedStyle(() => ({
    opacity: trailNear.value * markGeometry.trail[0].opacity,
  }));
  const trailFarStyle = useAnimatedStyle(() => ({
    opacity: trailFar.value * markGeometry.trail[1].opacity,
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: launchIntro.wordmark.rise * (1 - word.value) }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.value }));
  const skipStyle = useAnimatedStyle(() => ({ opacity: skipHint.value }));

  if (plan === 'none') return null;

  const ballBox = {
    left: (ball.cx - ball.r) * u,
    top: (ball.cy - ball.r) * u,
    width: ball.r * 2 * u,
    height: ball.r * 2 * u,
    borderRadius: ball.r * u,
  };
  // The canvas sets the hint 44 dp up from the foot of a frame that includes
  // the home indicator: just over the inset, never nearer the edge than that.
  const skipBottom = Math.max(insets.bottom + spacing.xs, spacing.xxxl);
  const themed = StyleSheet.create({
    root: { backgroundColor: colors.background },
    ring: { borderWidth: launchIntro.ring.stroke * u, borderColor: colors.success },
    trail: { backgroundColor: colors.mark },
    word: { ...typography.introWordmark, color: colors.textPrimary, marginTop: spacing.xxl },
    tagline: { ...typography.introTagline, color: colors.textMuted, marginTop: spacing.sm },
    skip: { ...typography.introSkip, color: colors.textMuted },
  });

  return (
    <Animated.View
      testID="launch-intro"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, themed.root, rootStyle]}
    >
      <Pressable style={styles.fill} onPress={skip}>
        <View style={{ width: sizes.introMark, height: sizes.introMark }}>
          <Animated.View style={[StyleSheet.absoluteFill, frameStyle]}>
            <Animated.View
              style={[
                styles.piece,
                {
                  left: crossbar.x * u,
                  top: crossbar.y * u,
                  width: crossbar.w * u,
                  height: crossbar.h * u,
                },
                barStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.piece,
                { left: post.x * u, top: post.y * u, width: post.w * u, height: post.h * u },
                barStyle,
              ]}
            />
          </Animated.View>
          {trail.map((square, i) => (
            <Animated.View
              key={`${square.x}-${square.y}`}
              style={[
                styles.piece,
                themed.trail,
                {
                  left: square.x * u,
                  top: square.y * u,
                  width: square.size * u,
                  height: square.size * u,
                },
                i === 0 ? trailNearStyle : trailFarStyle,
              ]}
            />
          ))}
          <Animated.View
            pointerEvents="none"
            style={[styles.piece, ballBox, themed.ring, ringStyle]}
          />
          <Animated.View style={[styles.piece, ballBox, ballStyle]} />
        </View>
        <Animated.Text
          style={[themed.word, wordStyle]}
          maxFontSizeMultiplier={fontScaleCap.display}
        >
          {ESCUADRA_WORDMARK}
        </Animated.Text>
        <Animated.Text
          style={[themed.tagline, taglineStyle]}
          maxFontSizeMultiplier={fontScaleCap.display}
        >
          {A_LA_ESCUADRA}
        </Animated.Text>
        <Animated.View style={[styles.foot, { bottom: skipBottom }, skipStyle]}>
          <Text style={themed.skip} maxFontSizeMultiplier={fontScaleCap.display}>
            {t.launch.tapToSkip}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute' },
  foot: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
