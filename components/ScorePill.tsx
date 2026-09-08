import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface ScorePillProps {
  correct: number;
  total: number;
}

// The score alone, with no "SCORE" caption. Mid-round the pill sits opposite
// the exit link with the team label centred between them, and the caption
// bought nothing a bare `7/9` in a pill doesn't already read as.
export function ScorePill({ correct, total }: ScorePillProps) {
  return (
    <View style={styles.headerPill}>
      <Text style={styles.headerScore}>
        {correct}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs - 3,
    paddingHorizontal: spacing.sm - 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
  },
  headerScore: { ...typography.statMonoSmall, color: colors.textPrimary },
});
