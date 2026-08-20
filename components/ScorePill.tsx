import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface ScorePillProps {
  correct: number;
  /** Total attempted so far — omit for the Team Picker's "best of 10" row pill. */
  total: number;
  /** header: "6/8 SCORE" pill in the question-screen chrome.
   *  row: fixed-width pill in a Team Picker row (renders "—" when there's no score). */
  variant?: 'header' | 'row';
  /** row variant only: true when this team has never been played. */
  empty?: boolean;
}

export function ScorePill({ correct, total, variant = 'header', empty }: ScorePillProps) {
  if (variant === 'row') {
    return (
      <View style={styles.rowPill}>
        <Text style={[styles.rowLabel, { color: empty ? colors.textMuted : colors.textPrimary }]}>
          {empty ? '—' : `${correct}/${total}`}
        </Text>
      </View>
    );
  }

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
  rowPill: {
    minWidth: 44,
    alignItems: 'center',
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs + 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
  },
  rowLabel: { ...typography.statMonoTiny },
});
