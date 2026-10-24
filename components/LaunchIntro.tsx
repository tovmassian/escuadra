import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  type ViewInstance,
} from 'react-native';
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
import { scheduleOnRN } from 'react-native-worklets';
import { measureInWindow, useLaunchReveal } from './LaunchReveal';
import { useReduceMotion } from './useReduceMotion';
import { useScreenReader } from './useScreenReader';
import { A_LA_ESCUADRA, ESCUADRA_WORDMARK } from '@/i18n/names';
import {
  dockTransform,
  introPlan,
  isDockable,
  withinTime,
  type DockRect,
  type IntroPlan,
} from '@/lib/launchIntro';
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
//   1. Frame: the crossbar and post in `mark`.
//   2. Shot: the ball flies in from off-screen bottom left on an arc, shrinking
//      to size; each trail square shows as the ball passes it.
//   3. Goal: frame and ball flash `success`, a ring flashes out from the ball,
//      the frame kicks up and right.
//   4. A la escuadra: the colour comes back, the wordmark rises in, the tagline
//      fades in under it.
// Then the hand-off: the mark and word dock into Home's top-bar lockup as the
// ground fades and Home rises in (`LaunchReveal`). With no Home to dock into,
// under Reduce Motion, or on a tap, the whole intro fades instead.
// Every stop is in `launchIntro` (theme/tokens.ts), the canvas's timeline; the
// mark is `markGeometry` in plain Views, as `EscuadraMark` draws it. When it
// plays (once per JS launch, the end frame under Reduce Motion, never with a
// screen reader) is `introPlan` (lib/launchIntro.ts). A tap anywhere skips,
// unlabelled: a hint would be gone before anyone could read it.

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

/** Whether the intro will show this launch, as the root layout first renders:
 *  if not, Home starts at rest. A screen reader that answers later is caught
 *  on mount, which reveals Home then. */
export function introWillShow(): boolean {
  return (
    introPlan({ alreadyShown: shown, screenReader: screenReaderAtLaunch, reduceMotion: false }) !==
    'none'
  );
}

// The timings that end the intro run under Reduce Motion too (the `still`
// plan holds its end frame, then fades): left to Reanimated's default, they
// would end at once.
const ENDING = { reduceMotion: ReduceMotion.Never } as const;

type Move = ReturnType<typeof dockTransform>;
const AT_REST: Move = { translateX: 0, translateY: 0, scale: 1 };

export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors();
  const launch = useLaunchReveal();
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
  // It ends once, by the timeline or a tap, whichever comes first.
  const endingRef = useRef(false);
  const markRef = useRef<ViewInstance>(null);
  const wordRef = useRef<ViewInstance>(null);
  // Stops the measuring's time limit if the intro unmounts mid-measure.
  const cancelMeasureRef = useRef<(() => void) | null>(null);

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
  const fade = useSharedValue(1);
  // The dock: the ground, and the trail and tagline as they clear, run 1 → 0;
  // the mark's glide and the word's run 0 → 1 along `move`, set as they start.
  const ground = useSharedValue(1);
  const clear = useSharedValue(1);
  const glide = useSharedValue(0);
  const glideWord = useSharedValue(0);
  const move = useSharedValue<{ mark: Move; word: Move }>({ mark: AT_REST, word: AT_REST });

  // Fades the whole intro, with Home already at rest beneath it.
  const fadeOut = (duration: number) => {
    launch?.reveal.set(1);
    fade.set(
      withTiming(0, { duration, ...ENDING }, (finished) => {
        if (finished) scheduleOnRN(finish);
      }),
    );
  };

  // `from` is the intro's mark and word, `to` Home's, all measured just now.
  const dockInto = (from: { mark: DockRect; word: DockRect }, to: typeof from) => {
    const { duration, wordDelay } = launchIntro.dock;
    const linear = { duration, easing: Easing.linear, ...ENDING };
    const rise = Easing.bezier(...celebrationEasingCurves.rise);
    move.set({
      mark: dockTransform(from.mark, to.mark),
      word: dockTransform(from.word, to.word),
    });
    clear.set(withTiming(0, { ...linear, duration: launchIntro.dock.clear }));
    ground.set(withTiming(0, linear));
    launch?.reveal.set(withTiming(1, linear));
    // The word sets off after the mark and lands with it, so it rises clear
    // of the mark's foot rather than under it.
    glideWord.set(
      withDelay(
        wordDelay,
        withTiming(1, { duration: duration - wordDelay, easing: rise, ...ENDING }),
        ENDING.reduceMotion,
      ),
    );
    glide.set(
      withTiming(1, { duration, easing: rise, ...ENDING }, (finished) => {
        if (finished) scheduleOnRN(finish);
      }),
    );
  };

  // At `end`: when the strike played and Home's lockup is there, measure both
  // ends now and dock; otherwise, if any end has no size, or if measuring
  // outlasts `dock.measureTimeout`, fade. A measure that comes in after that
  // is ignored (`withinTime` settles once).
  const end = () => {
    if (endingRef.current) return;
    endingRef.current = true;
    const home = launch?.lockup() ?? null;
    if (plan !== 'play' || !home) {
      fadeOut(launchIntro.fadeOut);
      return;
    }
    const measuring = withinTime(
      Promise.all([
        measureInWindow(markRef.current),
        measureInWindow(wordRef.current),
        measureInWindow(home.mark.current),
        measureInWindow(home.word.current),
      ]),
      launchIntro.dock.measureTimeout,
    );
    cancelMeasureRef.current = measuring.cancel;
    void measuring.result.then((boxes) => {
      if (doneRef.current) return;
      if (!boxes) {
        fadeOut(launchIntro.fadeOut);
        return;
      }
      const [markBox, wordBox, homeMark, homeWord] = boxes;
      if (
        isDockable(markBox) &&
        isDockable(wordBox) &&
        isDockable(homeMark) &&
        isDockable(homeWord)
      ) {
        dockInto({ mark: markBox, word: wordBox }, { mark: homeMark, word: homeWord });
      } else {
        fadeOut(launchIntro.fadeOut);
      }
    });
  };

  useEffect(() => {
    shown = true;
    if (plan === 'none') {
      finish();
      return;
    }
    // A JS timer, since the dock needs JS (measuring). Safe: every UI-thread
    // beat is over by `end`, so a stalled JS thread only holds the end frame.
    const timer = setTimeout(end, launchIntro.end);
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
    }
    return () => {
      clearTimeout(timer);
      cancelMeasureRef.current?.();
    };
    // Plays once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A screen reader that answers after the intro has started ends it at once.
  useEffect(() => {
    if (screenReader) finish();
  }, [screenReader]);

  const skip = () => {
    if (endingRef.current) return;
    endingRef.current = true;
    fadeOut(durations.transition);
  };

  const u = sizes.introMark / MARK_VIEWBOX;
  // 200 dp is far over `MARK_SMALL_BALL_THRESHOLD`: the large ball.
  const { crossbar, post, ball, ballSmall, trail } = markGeometry;
  const { mark, success } = colors;

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const groundStyle = useAnimatedStyle(() => ({ opacity: ground.value }));
  // Each end of the glide scales about its own centre (`dockTransform`).
  const markDockStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: move.value.mark.translateX * glide.value },
      { translateY: move.value.mark.translateY * glide.value },
      { scale: 1 + (move.value.mark.scale - 1) * glide.value },
    ],
  }));
  const wordDockStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: move.value.word.translateX * glideWord.value },
      { translateY: move.value.word.translateY * glideWord.value },
      { scale: 1 + (move.value.word.scale - 1) * glideWord.value },
    ],
  }));
  const frameStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: launchIntro.kick.offset * u * kick.value },
      { translateY: -launchIntro.kick.offset * u * kick.value },
    ],
  }));
  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(goal.value, [0, 1], [mark, success]),
  }));
  // Docking, the ball becomes `ballSmall`, as Home's small mark draws it.
  const ballStyle = useAnimatedStyle(() => ({
    opacity: ballIn.value,
    backgroundColor: interpolateColor(goal.value, [0, 1], [mark, success]),
    transform: [
      {
        translateX:
          launchIntro.flight.from.x * u * (1 - flyX.value) +
          (ballSmall.cx - ball.cx) * u * glide.value,
      },
      { translateY: launchIntro.flight.from.y * u * (1 - flyY.value) },
      {
        scale:
          (1 + (launchIntro.flight.scale - 1) * (1 - flyX.value)) *
          (1 + (ballSmall.r / ball.r - 1) * glide.value),
      },
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
    opacity: trailNear.value * clear.value * markGeometry.trail[0].opacity,
  }));
  const trailFarStyle = useAnimatedStyle(() => ({
    opacity: trailFar.value * clear.value * markGeometry.trail[1].opacity,
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: launchIntro.wordmark.rise * (1 - word.value) }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.value * clear.value }));

  if (plan === 'none') return null;

  const ballBox = {
    left: (ball.cx - ball.r) * u,
    top: (ball.cy - ball.r) * u,
    width: ball.r * 2 * u,
    height: ball.r * 2 * u,
    borderRadius: ball.r * u,
  };
  const themed = StyleSheet.create({
    ground: { backgroundColor: colors.background },
    ring: { borderWidth: launchIntro.ring.stroke * u, borderColor: colors.success },
    trail: { backgroundColor: colors.mark },
    word: { ...typography.introWordmark, color: colors.textPrimary },
    tagline: { ...typography.introTagline, color: colors.textMuted, marginTop: spacing.sm },
  });

  // The ground is its own layer, so it can fade alone as the lockup docks. The
  // Pressable over it fills the screen and takes every tap until the intro
  // unmounts, so Home gets none mid-dock.
  return (
    <Animated.View
      testID="launch-intro"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, rootStyle]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, themed.ground, groundStyle]} />
      <Pressable style={styles.fill} onPress={skip}>
        <Animated.View ref={markRef} style={[styles.mark, markDockStyle]}>
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
        </Animated.View>
        <Animated.View ref={wordRef} style={[styles.word, wordDockStyle]}>
          <Animated.Text
            style={[themed.word, wordStyle]}
            maxFontSizeMultiplier={fontScaleCap.display}
          >
            {ESCUADRA_WORDMARK}
          </Animated.Text>
        </Animated.View>
        <Animated.Text
          style={[themed.tagline, taglineStyle]}
          maxFontSizeMultiplier={fontScaleCap.display}
        >
          {A_LA_ESCUADRA}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { width: sizes.introMark, height: sizes.introMark },
  word: { marginTop: spacing.xxl },
  piece: { position: 'absolute' },
});
