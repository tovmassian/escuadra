import type { FlagCode } from '@/assets/flags/generated';
import { sizes, spacing, typography, type Palette } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { StyleSheet, Text, View } from 'react-native';
import { Flag } from './Flag';

interface StudyRowProps {
  /** Null when Wikipedia hasn't assigned this player a shirt number yet. */
  number: number | null;
  name: string;
  position: string;
  /** Nationality (club squads) or club (nation squads) — see
   *  `Question.affiliation` in the question engine for the same conditional. */
  affiliation: string;
  /** The flag for `affiliation` on club squads, where it is a nationality.
   *  Nation squads show a club there and never pass one. */
  flag?: FlagCode | null;
}

// Two components in this file share one stylesheet, so it is a factory rather
// than an inline block in either of them.
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm - 1,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceRaised,
    },
    number: { ...typography.statMonoSmall, color: colors.textMuted },
    name: { flex: 1, ...typography.tableName, color: colors.textPrimary, marginLeft: spacing.sm },
    position: { ...typography.tableCell, color: colors.textSecondary, textAlign: 'center' },
    // Flag last, not first, so every flag lands on the same right edge and the
    // column reads as one aligned strip — a leading flag shifts with the length
    // of the name beside it.
    affiliationCell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.xs,
      paddingRight: spacing.sm,
    },
    affiliation: {
      ...typography.tableCell,
      color: colors.textMuted,
      textAlign: 'right',
      flexShrink: 1,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLabel: { ...typography.tableHeader, color: colors.textMuted },
    headerName: { flex: 1, marginLeft: spacing.sm },
  });

export function StudyRow({ number, name, position, affiliation, flag }: StudyRowProps) {
  const styles = makeStyles(useThemeColors());
  return (
    <View style={styles.row}>
      <Text style={[styles.number, { width: sizes.studyColumn.no }]}>{number ?? '—'}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.position, { width: sizes.studyColumn.position }]}>{position}</Text>
      <View style={[styles.affiliationCell, { width: sizes.studyColumn.affiliation }]}>
        <Text style={styles.affiliation} numberOfLines={1}>
          {affiliation}
        </Text>
        {flag ? <Flag code={flag} size="row" label={affiliation} /> : null}
      </View>
    </View>
  );
}

export function StudyHeaderRow({ affiliationLabel }: { affiliationLabel: 'NAT' | 'CLUB' }) {
  const styles = makeStyles(useThemeColors());
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.headerLabel, { width: sizes.studyColumn.no }]}>#</Text>
      <Text style={[styles.headerLabel, styles.headerName]}>NAME</Text>
      <Text
        style={[styles.headerLabel, { width: sizes.studyColumn.position, textAlign: 'center' }]}
      >
        POS
      </Text>
      <Text
        style={[styles.headerLabel, { width: sizes.studyColumn.affiliation, textAlign: 'right' }]}
      >
        {affiliationLabel}
      </Text>
    </View>
  );
}
