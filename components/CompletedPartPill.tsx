import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface CompletedPartPillProps {
  label: string;
}

// The L2/L3 progressive-reveal collapse state: once a part is answered
// correctly it shrinks to this single check pill and the next part slides
// in below. Deliberately a different component from AnswerOption — this
// summarizes a whole finished part, not one option among several.
export function CompletedPartPill({ label }: CompletedPartPillProps) {
  return (
    <View style={styles.pill}>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md - 2,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radii.lg,
  },
  check: { color: colors.success, fontWeight: '700' },
  label: { ...typography.rowTitle, color: colors.success },
});
