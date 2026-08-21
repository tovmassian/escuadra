import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ScorePill } from './ScorePill';
import { TeamMarker } from './TeamMarker';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { colors, iconSize, sizes, spacing, typography } from '@/theme/tokens';

interface TeamRowProps {
  name: string;
  marker: TeamMarkerData;
  best: { correct: number; total: number } | null;
  onPress: () => void;
}

// Left edge (marker + name) stays put; name truncates with an ellipsis. Right
// edge is a fixed-width score pill, so both edges stay clean regardless of
// name length — the identity marker is the team's only visual identifier,
// per the "no crests, ever" constraint.
export function TeamRow({ name, marker, best, onPress }: TeamRowProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <TeamMarker marker={marker} />
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
  name: { flex: 1, ...typography.rowTitle, color: colors.textPrimary },
  chevron: { fontSize: iconSize.chevron, color: colors.border },
});
