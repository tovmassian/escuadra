import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
  type TextInstance,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { measureInWindow } from './LaunchReveal';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useScreenAppearance } from '@/hooks/useScreenAppearance';
import { useT } from '@/i18n/useT';
import { withinTime } from '@/lib/launchIntro';
import {
  placeTip,
  roundedRectPath,
  scrollDelta,
  settled,
  type Box,
  type RoundedBox,
} from '@/lib/tips';
import {
  borderWidths,
  durations,
  fontScaleCap,
  opacity,
  radii,
  sizes,
  spacing,
  tips,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export interface TipSpec {
  target: RefObject<ViewInstance | null>;
  radius: number;
  heading: string;
  body: string;
}

interface TipsLayerProps {
  tips: readonly TipSpec[];
  onClose: () => void;
  onSkip: () => void;
  /** Called once, as the first tip shows: `useTips` marks the screen seen. */
  onShown: () => void;
  /** Scrolls the screen by `dy` points, without animation: down for a target
   *  below the fold, up (negative) for one above the top; it stops at 0. */
  scrollBy?: (dy: number) => void;
  /** How far a pinned element covers the screen's bottom, above the safe-area
   *  inset (Difficulty's footer). The scroll keeps a target clear of it; the
   *  tip, drawn over everything, is placed as before. */
  bottomClear?: number;
  /** Replace the step kicker and its spoken name: with one tip, "Step 1 of 1"
   *  would say nothing. The step dots are hidden then too. */
  kicker?: string;
  spoken?: string;
}

// How to play (#183; spec docs/superpowers/specs/2026-10-23-how-to-play-tips-design.md):
// a screen's tips, one at a time, over the screen they explain. Each target is
// measured in the window, against the layer's own origin, until two frames agree
// (a pushed screen is still sliding in) or `tips.settleCap` passes; one below the
// fold or above the top is scrolled to once. Then the scrim is cut round it,
// ringed, pointed at, and the tip is placed by `placeTip` and fades in. A tap
// anywhere, the tip included, or Next, moves on; the last closes; Skip tips ends
// every screen's tips; Android's back button closes, while the screen is focused.
// Rendered last inside the screen's root, so it covers it. A single tip takes its
// own `kicker` and `spoken` name and shows no dots (#184).

// SVG paint and path data, not text: kept out of the JSX for the
// hard-coded-string lint. The arrow is drawn in its 40 × 40 box
// (`tips.arrow`), curving up and right to the target, or down and right.
const NO_PAINT = 'none';
const EVEN_ODD = 'evenodd';
const ROUND = 'round';
const DIALOG = 'dialog';
const ARROW = {
  up: { stem: 'M10 36 C 6 24, 10 12, 24 4', head: 'M13 5 L25 3 L23 15' },
  down: { stem: 'M10 4 C 6 16, 10 28, 24 36', head: 'M13 35 L25 37 L23 25' },
} as const;

interface Measure {
  /** The target, in the layer's coordinates. */
  box: Box;
  /** The layer's own size: the screen it covers. */
  screen: { width: number; height: number };
}

export function TipsLayer({
  tips: specs,
  onClose,
  onSkip,
  onShown,
  scrollBy,
  bottomClear = 0,
  kicker,
  spoken,
}: TipsLayerProps) {
  const colors = useThemeColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const rootRef = useRef<ViewInstance>(null);
  const kickerRef = useRef<TextInstance>(null);

  const [step, setStep] = useState(0);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [tipHeight, setTipHeight] = useState<number | null>(null);
  // Set on leaving the first placed tip: from then on, between steps, Skip tips
  // stays and a plain scrim holds, so the screen never blinks through.
  const [shown, setShown] = useState(false);

  // The measuring loop starts once per step and reads these as they are now.
  const latest = useRef({ specs, scrollBy, bottomClear, insets, onClose, onShown });
  useEffect(() => {
    latest.current = { specs, scrollBy, bottomClear, insets, onClose, onShown };
  });

  const n = specs.length;
  const last = step >= n - 1;
  const kickerText = kicker ?? t.tips.kicker(step + 1, n);
  const spokenText = spoken ?? t.tips.spoken(step + 1, n);
  const goTo = (next: number) => {
    if (next >= latest.current.specs.length) {
      latest.current.onClose();
      return;
    }
    setStep(next);
    setMeasure(null);
    setTipHeight(null);
  };

  // Measure the step's target every frame until it holds still or the cap
  // passes; scroll it on screen once if it is below the fold, then measure
  // again. A target that never mounts is skipped.
  useEffect(() => {
    const spec = latest.current.specs[step];
    if (!spec) {
      latest.current.onClose();
      return;
    }
    let cancelled = false;
    let frame = 0;
    let started = Date.now();
    let previous: Box | null = null;
    let scrolled = false;
    let stopMeasure: (() => void) | null = null;

    const poll = () => {
      // Bounded, as the launch intro's is: a native callback that never fires
      // reads as a target that never mounted.
      const measuring = withinTime(
        Promise.all([measureInWindow(rootRef.current), measureInWindow(spec.target.current)]),
        tips.settleCap,
      );
      stopMeasure = measuring.cancel;
      void measuring.result.then((boxes) => {
        if (cancelled) return;
        const [root, target] = boxes ?? [null, null];
        const late = Date.now() - started >= tips.settleCap;
        if (!root || !target || target.width === 0 || target.height === 0) {
          if (late) goTo(step + 1);
          else frame = requestAnimationFrame(poll);
          return;
        }
        const box = {
          x: target.x - root.x,
          y: target.y - root.y,
          width: target.width,
          height: target.height,
        };
        if (!settled(previous, box) && !late) {
          previous = box;
          frame = requestAnimationFrame(poll);
          return;
        }
        const screen = { width: root.width, height: root.height };
        const { scrollBy: scroll, insets: safe, bottomClear: clear } = latest.current;
        if (scroll && !scrolled) {
          const delta = scrollDelta(
            { target: box, radius: spec.radius, screen, insets: safe, bottomClear: clear },
            tips,
          );
          if (delta !== 0) {
            // Once per step, so a scroll that cannot go further never loops;
            // the screen moved, so it must settle again, with a fresh cap.
            scrolled = true;
            scroll(delta);
            previous = null;
            started = Date.now();
            frame = requestAnimationFrame(poll);
            return;
          }
        }
        setMeasure({ box, screen });
      });
    };
    frame = requestAnimationFrame(poll);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stopMeasure?.();
    };
    // Once per step; the rest is read from `latest`.
  }, [step]);

  // Android's back button closes the tips, as it closes a sheet; only while
  // the screen is focused, so a screen pushed over it keeps its own back.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        latest.current.onClose();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const spec = specs[step];
  const placement =
    spec && measure && tipHeight !== null
      ? placeTip(
          {
            target: measure.box,
            radius: spec.radius,
            screen: measure.screen,
            insets,
            tipHeight,
          },
          tips,
        )
      : null;
  const placed = placement !== null;

  // The first placed tip tells the screen its tips have shown (`useTips` marks
  // it seen then, not before).
  const announced = useRef(false);
  useEffect(() => {
    if (!placed || announced.current) return;
    announced.current = true;
    latest.current.onShown();
  }, [placed]);

  // Each placed step moves the screen reader to its kicker, which speaks the
  // dialog's name: once the tip has faded in, since neither screen reader will
  // focus what is still see-through, and on iOS once the screen has settled,
  // since VoiceOver moves to the screen's first element itself before that
  // (#187). Until the first move, Skip tips stays out of the order, so a
  // screen reader never starts there. Not on web, where react-native-web has no
  // `sendAccessibilityEvent`.
  const { settling } = useScreenAppearance();
  const waiting = Platform.OS === 'ios' && settling;
  const [skipReachable, setSkipReachable] = useState(false);
  useEffect(() => {
    if (!placed || waiting) return;
    const timer = setTimeout(
      () => {
        const kicker = kickerRef.current;
        if (kicker && Platform.OS !== 'web') {
          AccessibilityInfo.sendAccessibilityEvent(kicker, 'focus');
        }
        setSkipReachable(true);
      },
      reduceMotion ? 0 : durations.tipFade,
    );
    return () => clearTimeout(timer);
  }, [placed, step, waiting, reduceMotion]);

  const advance = () => {
    if (!placed) return;
    setShown(true);
    goTo(step + 1);
  };
  // Once a tip has shown, Skip tips stays, and the scrim holds, uncut, while the
  // next target is measured.
  const held = shown && !placed;

  const screen = measure?.screen ?? windowSize;
  const fade = reduceMotion ? undefined : FadeIn.duration(durations.tipFade);
  // Skip tips is drawn under the 44 pt tap target and reaches it through hitSlop.
  const skipSlop = (sizes.minTapTarget - tips.skipHeight) / 2;

  const styles = StyleSheet.create({
    tipFrame: {
      position: 'absolute',
      left: tips.gutter,
      right: tips.gutter,
      top: placement?.tipTop ?? 0,
    },
    tip: { gap: tips.stack },
    // Its own view, under the tip's text: iOS draws a view's box shadow over that
    // view's children wherever they reach into its rounded corners (#187).
    backing: {
      ...StyleSheet.absoluteFill,
      pointerEvents: 'none',
      borderRadius: radii.lg,
      backgroundColor: colors.tipBacking,
      boxShadow: [
        {
          offsetX: 0,
          offsetY: 0,
          blurRadius: tips.backingBlur,
          spreadDistance: tips.backingSpread,
          color: colors.tipBacking,
        },
      ],
    },
    hidden: { opacity: 0 },
    kicker: { ...typography.tipKicker, color: colors.accentLine },
    heading: { ...typography.tipHeading, color: colors.textPrimary },
    body: { ...typography.tipBody, color: colors.tipBody },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: n > 1 ? 'space-between' : 'flex-end',
      marginTop: spacing.xs,
    },
    dots: { flexDirection: 'row', alignItems: 'center', gap: tips.dotGap },
    dot: {
      width: tips.dot,
      height: tips.dot,
      borderRadius: radii.pill,
      backgroundColor: colors.border,
    },
    dotActive: { width: tips.dotActive, backgroundColor: colors.textPrimary },
    next: {
      height: sizes.minTapTarget,
      paddingHorizontal: tips.buttonPad,
      borderRadius: radii.pill,
      backgroundColor: colors.ctaBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextLabel: { ...typography.tipButton, color: colors.ctaText },
    skip: {
      position: 'absolute',
      top: insets.top + spacing.xs,
      left: spacing.md,
      height: tips.skipHeight,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceRaised,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    skipLabel: { ...typography.tipSkip, color: colors.textPrimary },
    paint: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
    scrim: { flex: 1, backgroundColor: colors.tipScrim },
  });

  const content = spec ? (
    <>
      {/* Speaks the dialog's name, first, since the dialog itself is not one
          element on native; focus lands here on each step. */}
      <Text ref={kickerRef} style={styles.kicker} accessibilityLabel={spokenText}>
        {kickerText}
      </Text>
      <Text
        style={styles.heading}
        accessibilityRole="header"
        maxFontSizeMultiplier={fontScaleCap.display}
      >
        {spec.heading}
      </Text>
      <Text style={styles.body}>{spec.body}</Text>
      <View style={styles.row}>
        {n > 1 ? (
          <View
            style={styles.dots}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {specs.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>
        ) : null}
        <Pressable
          testID="tip-next"
          accessibilityRole="button"
          onPress={advance}
          style={({ pressed }) => [styles.next, pressed && { opacity: opacity.settled }]}
        >
          <Text style={styles.nextLabel}>{last ? t.tips.gotIt : t.tips.next}</Text>
        </Pressable>
      </View>
    </>
  ) : null;

  return (
    <View
      ref={rootRef}
      testID="tips-layer"
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      // iOS's two-finger scrub, since the catcher is hidden from screen readers.
      onAccessibilityEscape={onClose}
    >
      {/* The scrim fades in with the first tip and stays: cut round each placed
          target, whole while the next one is measured. */}
      {placement || held ? (
        <Animated.View
          entering={fade}
          style={styles.paint}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {placement ? (
            <Svg width={screen.width} height={screen.height}>
              <Path
                d={scrimPath(screen, placement.cut)}
                fill={colors.tipScrim}
                fillRule={EVEN_ODD}
              />
            </Svg>
          ) : (
            <View style={styles.scrim} />
          )}
        </Animated.View>
      ) : null}

      {/* Takes every tap, so none reaches the screen under the tips; once a
          tip shows, a tap anywhere moves on. Next is the accessible way. */}
      <Pressable
        testID="tips-catcher"
        style={StyleSheet.absoluteFill}
        onPress={advance}
        focusable={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      {/* Laid out hidden first, to learn its height, then placed and faded in.
          The tip remounts for each step and again once placed, so its
          `onLayout` fires on mount every time: react-native-web reports layout
          only through a ResizeObserver, which says nothing when the next
          step's tip is the same height. A tap on the tip, off Next, moves on
          as the catcher's does: through the responder system, which adds
          nothing a screen reader sees, on native and on react-native-web. */}
      <View
        style={styles.tipFrame}
        pointerEvents={placed ? 'box-none' : 'none'}
        accessibilityElementsHidden={!placed || waiting}
        importantForAccessibility={placed && !waiting ? 'auto' : 'no-hide-descendants'}
      >
        <Animated.View
          key={placed ? step : -1 - step}
          entering={placed ? fade : undefined}
          role={DIALOG}
          aria-modal
          accessibilityLabel={spokenText}
          style={[styles.tip, !placed && styles.hidden]}
          onLayout={(e) => setTipHeight(e.nativeEvent.layout.height)}
          onStartShouldSetResponder={() => placed}
          onResponderRelease={advance}
        >
          <View
            style={styles.backing}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          {content}
        </Animated.View>
      </View>

      {/* The ring and arrow come with each tip, drawn over its frame, so the
          backing's soft edge never veils the arrow. */}
      {placement ? (
        <Animated.View
          key={step}
          entering={fade}
          style={styles.paint}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width={screen.width} height={screen.height}>
            <Rect
              x={placement.ring.x}
              y={placement.ring.y}
              width={placement.ring.width}
              height={placement.ring.height}
              rx={placement.ring.radius}
              ry={placement.ring.radius}
              stroke={colors.accentLine}
              strokeWidth={tips.ring}
              fill={NO_PAINT}
            />
            <Arrow
              x={placement.arrow.x}
              y={placement.arrow.y}
              flip={placement.arrow.flip}
              up={placement.side === 'below'}
              color={colors.textPrimary}
            />
          </Svg>
        </Animated.View>
      ) : null}

      {shown || placed ? (
        <Pressable
          testID="tips-skip"
          accessibilityRole="button"
          accessibilityElementsHidden={!skipReachable}
          importantForAccessibility={skipReachable ? 'auto' : 'no-hide-descendants'}
          onPress={onSkip}
          hitSlop={skipSlop}
          style={({ pressed }) => [styles.skip, pressed && { opacity: opacity.settled }]}
        >
          <Text style={styles.skipLabel}>{t.tips.skip}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The whole layer, less the target: `fillRule="evenodd"` leaves the inner
 *  rect unpainted. */
function scrimPath(screen: { width: number; height: number }, cut: RoundedBox): string {
  return `M0 0H${screen.width}V${screen.height}H0Z${roundedRectPath(cut)}`;
}

/** The arrow between the tip and its target, pointing at the target: up when
 *  the tip is below it. `flip` mirrors it about its centre, to curve left. */
function Arrow({
  x,
  y,
  flip,
  up,
  color,
}: {
  x: number;
  y: number;
  flip: boolean;
  up: boolean;
  color: string;
}) {
  const path = up ? ARROW.up : ARROW.down;
  const transform = flip
    ? `translate(${x + tips.arrow.width} ${y}) scale(-1 1)`
    : `translate(${x} ${y})`;
  return (
    <G
      transform={transform}
      stroke={color}
      strokeWidth={tips.arrowStroke}
      strokeLinecap={ROUND}
      strokeLinejoin={ROUND}
      fill={NO_PAINT}
    >
      <Path d={path.stem} />
      <Path d={path.head} />
    </G>
  );
}
