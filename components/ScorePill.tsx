import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface ScorePillProps {
  correct: number;
  total: number;
}

export function ScorePill({ correct, total }: ScorePillProps) {
  return (
    <View style={styles.headerPill}>
      <Text style={styles.headerScore}>
        {correct}/{total}
      </Text>
      <Text style={styles.headerLabel}>SCORE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs + 2,
    paddingVertical: spacing.xs - 3,
    paddingHorizontal: spacing.sm - 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
  },
  headerScore: { ...typography.statMonoSmall, color: colors.textPrimary },
  headerLabel: { ...typography.captionEyebrow, color: colors.textMuted },
});
