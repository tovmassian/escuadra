import { StyleSheet, View } from 'react-native';
import type { DotOutcome } from '@/lib/roundView';
import { colors, opacity, radii, sizes, spacing } from '@/theme/tokens';

interface ProgressDotsProps {
  /** One entry per question, in order. */
  outcomes: DotOutcome[];
}

// A dash per question, coloured by what actually happened to it — ten
// identical dashes told the player nothing about their round.
export function ProgressDots({ outcomes }: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {outcomes.map((outcome, i) => (
        <View key={i} style={[styles.dot, dotStyle(outcome)]} />
      ))}
    </View>
  );
}

function dotStyle(outcome: DotOutcome) {
  switch (outcome) {
    case 'correct':
      return { backgroundColor: colors.success, opacity: opacity.dotPast };
    case 'wrong':
      return { backgroundColor: colors.error, opacity: opacity.dotPast };
    case 'current':
      return { backgroundColor: colors.accent, opacity: 1 };
    case 'future':
      return { backgroundColor: colors.border, opacity: opacity.dotFuture };
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xxs + 1 },
  dot: { flex: 1, height: sizes.progressDot, borderRadius: radii.sm - 5 },
});
