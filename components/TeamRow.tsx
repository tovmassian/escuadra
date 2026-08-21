import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScorePill } from './ScorePill';
import { colors, iconSize, sizes, spacing, typography } from '@/theme/tokens';

interface TeamRowProps {
  name: string;
  primaryColor: string;
  best: { correct: number; total: number } | null;
  onPress: () => void;
}

// Left edge (dot + name) stays put; name truncates with an ellipsis. Right
// edge is a fixed-width score pill, so both edges stay clean regardless of
// name length — the accent dot is the team's only visual identity marker,
// per the "no crests, ever" constraint.
export function TeamRow({ name, primaryColor, best, onPress }: TeamRowProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <View style={[styles.dot, { backgroundColor: primaryColor ?? colors.textMuted }]} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <ScorePill
        correct={best?.correct ?? 0}
        total={best?.total ?? 10}
        variant="row"
        empty={!best}
      />
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: sizes.rowHeight,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  dot: { width: sizes.teamDot, height: sizes.teamDot, borderRadius: sizes.teamDot },
  name: { flex: 1, ...typography.rowTitle, color: colors.textPrimary },
  chevron: { fontSize: iconSize.chevron, color: colors.border },
});
