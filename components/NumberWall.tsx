import { useIsFocused } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Text as SvgText } from 'react-native-svg';
import { useAppActive } from './useAppActive';
import { useReduceMotion } from './useReduceMotion';
import { WALL_ROWS, layoutRow, numberWidth, rowOffset, type WallRowSpec } from '@/lib/numberWall';
import { numberWall, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// SVG paint values, not text: kept out of the JSX for the hard-coded-string lint.
const NO_PAINT = 'none';

// Home's number wall (#181): four rows of shirt numbers drifting in alternate
// directions behind the headline. React Native text has no outline, so each
// number is a small SVG of outlined text, drawn once; a row's view is moved on
// the UI thread. One SVG per number, not per row: Android caches an SVG as one
// bitmap, and a whole row would pass some GPUs' texture limit.
// Decorative: hidden from screen readers and from touches. The drift is the
// Motion rule's written exception; it stands still under Reduce Motion (read
// live, so turning it on mid-session stops the drift), and stops while the app
// is in the background or Home isn't the focused screen.
export function NumberWall({ top }: { top: number }) {
  const { width } = useWindowDimensions();
  const reduced = useReduceMotion();
  const focused = useIsFocused();
  const active = useAppActive();
  const running = !reduced && focused && active;

  return (
    <View
      style={[styles.wall, { top }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {WALL_ROWS.map((row) => (
        <WallRow key={row.from} row={row} viewport={width} running={running} />
      ))}
    </View>
  );
}

function WallRow({
  row,
  viewport,
  running,
}: {
  row: WallRowSpec;
  viewport: number;
  running: boolean;
}) {
  const colors = useThemeColors();
  const layout = useMemo(() => layoutRow(row, viewport), [row, viewport]);
  const progress = useSharedValue(0);
  const { loopWidth } = layout;

  useEffect(() => {
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    // Resume where it stopped: finish this loop, then loop from 0 for ever.
    const period = (loopWidth / numberWall.speed) * 1000;
    const linear = { easing: Easing.linear };
    progress.value = withSequence(
      withTiming(1, { ...linear, duration: (1 - progress.value) * period }),
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { ...linear, duration: period }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(progress);
  }, [running, loopWidth, progress]);

  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: rowOffset(progress.value, loopWidth, row.phase, row.direction) }],
  }));

  const fills = { primary: colors.textPrimary, mark: colors.mark } as const;
  return (
    <Animated.View style={[{ width: layout.width, height: numberWall.rowHeight }, drift]}>
      {layout.items.map((item) => (
        <Svg
          key={item.x}
          width={numberWidth(item.n) + 2 * numberWall.stroke}
          height={numberWall.rowHeight}
          style={[styles.number, { left: item.x }]}
        >
          <SvgText
            x={numberWall.stroke}
            y={numberWall.baseline}
            fontFamily={typography.shirtNumber.fontFamily}
            fontSize={numberWall.fontSize}
            letterSpacing={numberWall.tracking}
            fill={item.fill === null ? NO_PAINT : fills[item.fill]}
            stroke={item.fill === null ? colors.wallLine : NO_PAINT}
            strokeWidth={numberWall.stroke}
          >
            {String(item.n)}
          </SvgText>
        </Svg>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  number: { position: 'absolute', top: 0 },
  wall: { position: 'absolute', left: 0, right: 0, overflow: 'hidden', pointerEvents: 'none' },
});
