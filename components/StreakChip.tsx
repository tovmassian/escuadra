import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  borderWidths,
  durations,
  iconSize,
  radii,
  sizes,
  spacing,
  spotlightCues,
  spotlightMotion,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The streak (spec §2.5): correct answers in a row, shown from 2. It pops when
// it grows. A miss unmounts it, and its exit shrinks and fades it. Heat is
// brand, never a verdict colour: it only ever means the streak.
const exit = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: spotlightMotion.streakOutScale }] },
})
  .duration(durations.transition)
  .delay(spotlightCues.missStreak);

export function StreakChip({ count }: { count: number }) {
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    const half = durations.reveal / 2;
    scale.value = withDelay(
      spotlightCues.streak,
      withSequence(
        withTiming(spotlightMotion.streakPopScale, { duration: half }),
        withTiming(1, { duration: half }),
      ),
    );
  }, [count, reduced, scale]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const flame = iconSize.flameGlyph;
  const styles = StyleSheet.create({
    chip: {
      height: sizes.topBar.pill,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.heatLine,
      backgroundColor: colors.heatBg,
    },
    // A teardrop: a square, fully rounded but for one corner, turned so the
    // sharp corner points up.
    flame: {
      width: flame,
      height: flame,
      borderRadius: flame / 2,
      borderTopRightRadius: 0,
      backgroundColor: colors.heat,
      transform: [{ rotate: '-45deg' }],
    },
    count: { ...typography.statMonoSmall, color: colors.heatText },
  });

  return (
    <Animated.View
      style={[styles.chip, pop]}
      entering={FadeIn.duration(durations.transition)}
      exiting={reduced ? FadeOut.duration(durations.transition) : exit}
      accessible
      accessibilityLabel={`Streak: ${count} in a row`}
    >
      <View style={styles.flame} />
      <Animated.Text
        key={count}
        entering={reduced ? undefined : FadeIn.duration(durations.reveal)}
        style={styles.count}
      >
        {count}
      </Animated.Text>
    </Animated.View>
  );
}
