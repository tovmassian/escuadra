import { StyleSheet, View } from 'react-native';
import type { DotOutcome } from '@/lib/roundView';
import { radii, sizes, spacing } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Stories-style progress over the photo (spec §2.1), one segment per question:
// - past: its verdict;
// - current: white until answered, then its verdict;
// - future: a faint track.
// Invariant 9: it counts questions, not parts.
export function RoundProgress({
  outcomes,
  currentIndex,
}: {
  outcomes: DotOutcome[];
  /** The question being asked, from 0, for the spoken label. */
  currentIndex: number;
}) {
  const colors = useThemeColors();
  const fill: Record<DotOutcome, string> = {
    correct: colors.photoSuccess,
    wrong: colors.photoError,
    current: colors.onPhoto,
    future: colors.photoTrack,
  };
  const answered = outcomes.filter((o) => o === 'correct' || o === 'wrong').length;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Question ${currentIndex + 1} of ${outcomes.length}`}
      accessibilityValue={{ min: 0, max: outcomes.length, now: answered }}
    >
      {outcomes.map((outcome, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: fill[outcome] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  segment: { flex: 1, height: sizes.segment.question, borderRadius: radii.xs },
});
