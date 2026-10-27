import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useT } from '@/i18n/useT';
import {
  durations,
  fontScaleCap,
  radii,
  resultsTimeline,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

// The round in ten segments (spec §3.1), each labelled with its shirt number.
// They fill left to right on arrival (spec §6). Reduce Motion: they fade in
// together.
export function RoundStrip({ items }: { items: { no: number; correct: boolean }[] }) {
  const t = useT();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={t.results.roundSpoken(
        items.filter((i) => i.correct).length,
        items.length,
      )}
    >
      {items.map((item, i) => (
        <Segment key={i} index={i} no={item.no} correct={item.correct} />
      ))}
    </View>
  );
}

function Segment({ index, no, correct }: { index: number; no: number; correct: boolean }) {
  const colors = useThemeColors();
  const reduced = useReduceMotion();
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = reduced
      ? withTiming(1, { duration: durations.transition })
      : withDelay(
          index * resultsTimeline.segmentStagger,
          withTiming(1, { duration: resultsTimeline.segmentFill }),
        );
  }, [index, reduced, fill]);
  const filled = useAnimatedStyle(() => ({ opacity: fill.value }));
  return (
    <View style={styles.cell}>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[styles.bar, { backgroundColor: correct ? colors.success : colors.error }, filled]}
        />
      </View>
      <Text
        style={[typography.stripNumber, { color: correct ? colors.textMuted : colors.error }]}
        maxFontSizeMultiplier={fontScaleCap.display}
      >
        {no}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xxs },
  cell: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.xxs },
  track: {
    alignSelf: 'stretch',
    height: sizes.segment.results,
    borderRadius: radii.xs,
    overflow: 'hidden',
  },
  bar: { ...StyleSheet.absoluteFill },
});
