import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '@/theme/tokens';

interface StudyRowProps {
  number: number;
  name: string;
  position: string;
  /** Nationality (club squads) or club (nation squads) — see
   *  `Question.affiliation` in the question engine for the same conditional. */
  affiliation: string;
}

export function StudyRow({ number, name, position, affiliation }: StudyRowProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.number, { width: sizes.studyColumn.no }]}>{number}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.position, { width: sizes.studyColumn.position }]}>{position}</Text>
      <Text
        style={[styles.affiliation, { width: sizes.studyColumn.affiliation }]}
        numberOfLines={1}
      >
        {affiliation}
      </Text>
    </View>
  );
}

export function StudyHeaderRow({ affiliationLabel }: { affiliationLabel: 'NAT' | 'CLUB' }) {
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

const styles = StyleSheet.create({
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
  affiliation: { ...typography.tableCell, color: colors.textMuted, textAlign: 'right' },
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
