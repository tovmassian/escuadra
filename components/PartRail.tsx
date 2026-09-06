import { StyleSheet, Text, View } from 'react-native';
import { VerdictGlyph } from './VerdictGlyph';
import type { PartRailRow } from '@/lib/roundView';
import { colors, iconSize, opacity, radii, spacing, typography } from '@/theme/tokens';

interface PartRailProps {
  rows: PartRailRow[];
}

// One row per part of the current question, so the player can see how many
// parts remain and what they have already banked. Answered parts carry the
// mark as a real verdict — never a check that was not earned (invariant 8).
export function PartRail({ rows }: PartRailProps) {
  return (
    <View style={styles.root}>
      {rows.map((row, i) => (
        <View key={i} style={[styles.row, row.state === 'upcoming' && styles.rowUpcoming]}>
          {row.state === 'answered-correct' || row.state === 'answered-wrong' ? (
            <VerdictGlyph correct={row.state === 'answered-correct'} />
          ) : (
            <View style={[styles.bullet, row.state === 'current' && styles.bulletCurrent]} />
          )}
          <Text style={[styles.label, row.state === 'current' && styles.labelCurrent]}>
            {row.label}
          </Text>
          {row.answer !== null && (
            <Text style={styles.answer} numberOfLines={1}>
              {row.answer}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, gap: spacing.xs - 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 1 },
  rowUpcoming: { opacity: opacity.faded },
  bullet: {
    width: iconSize.markLarge,
    height: iconSize.markLarge,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulletCurrent: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { ...typography.captionEyebrow, color: colors.textMuted },
  labelCurrent: { color: colors.textPrimary },
  answer: {
    ...typography.secondarySmall,
    color: colors.textSecondary,
    marginLeft: 'auto',
    flexShrink: 1,
  },
});
