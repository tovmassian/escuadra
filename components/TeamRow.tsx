import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TeamMarker } from './TeamMarker';
import type { TeamProgress } from '@/lib/pickerView';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { colors, iconSize, sizes, spacing, typography } from '@/theme/tokens';

interface TeamRowProps {
  name: string;
  marker: TeamMarkerData;
  progress: TeamProgress | null;
  onPress: () => void;
}

// Left edge (marker + name) stays put; the name truncates with an ellipsis.
// The row is the only place per-team progress can live, so it carries a mono
// sub-line rather than a right-hand pill that read the same on every row. The
// identity marker is the team's only visual identifier, per the "no crests,
// ever" constraint.
export function TeamRow({ name, marker, progress, onPress }: TeamRowProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <TeamMarker marker={marker} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.meta, progress?.cleared === true && styles.metaCleared]}>
          {progress === null
            ? 'NOT PLAYED'
            : `LEVEL ${progress.level} · BEST ${progress.correct}/${progress.total}`}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: sizes.rowHeightTall,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  text: { flex: 1, minWidth: 0 },
  name: { ...typography.rowTitle, color: colors.textPrimary },
  meta: { ...typography.statMonoTiny, color: colors.textMuted, marginTop: spacing.xxs - 1 },
  metaCleared: { color: colors.success },
  chevron: { fontSize: iconSize.chevron, color: colors.border },
});
