import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VerdictGlyph } from './VerdictGlyph';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface CompletedPartPillProps {
  label: string;
  /** Whether the picked option was actually correct — drives the pill's
   *  mark and colour. The label shown is always the correct answer, so the
   *  player learns it immediately either way; only the verdict styling
   *  differs. */
  correct: boolean;
}

// The L2/L3 progressive-reveal collapse state: once a part is answered it
// shrinks to this single pill and the next part slides in below.
// Deliberately a different component from AnswerOption — this summarizes a
// whole finished part, not one option among several — but it must still
// reflect the real verdict (CLAUDE.md requires instant feedback); collapsing
// straight to a green check regardless of correctness was the bug this
// `correct` prop exists to fix.
export function CompletedPartPill({ label, correct }: CompletedPartPillProps) {
  return (
    <View style={[styles.pill, correct ? styles.pillCorrect : styles.pillIncorrect]}>
      <VerdictGlyph correct={correct} />
      <Text style={[styles.label, correct ? styles.labelCorrect : styles.labelIncorrect]}>
        {label}
      </Text>
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
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  pillCorrect: { backgroundColor: colors.successBg, borderColor: colors.success },
  pillIncorrect: { backgroundColor: colors.errorBg, borderColor: colors.error },
  label: { ...typography.rowTitle },
  labelCorrect: { color: colors.success },
  labelIncorrect: { color: colors.error },
});
