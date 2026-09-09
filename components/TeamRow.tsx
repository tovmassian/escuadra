import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flag } from './Flag';
import { TeamMarker } from './TeamMarker';
import type { FlagCode } from '@/assets/flags/generated';
import type { TeamProgress } from '@/lib/pickerView';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { colors, iconSize, sizes, spacing, typography } from '@/theme/tokens';

interface TeamRowProps {
  name: string;
  marker: TeamMarkerData;
  /** A nation's flag image, which replaces the geometric marker for
   *  `kind: 'nation'` rows. Absent for clubs, which never get one — see
   *  CLAUDE.md hard constraint #2. Null means the nationality isn't in
   *  lib/flags.ts's table, and the row falls back to the marker. */
  flag?: FlagCode | null;
  /** `undefined` while the persisted store is still hydrating — "not yet
   *  known" — distinct from `null`, "known to have never been played".
   *  Rendering both the same way would have the row assert NOT PLAYED for a
   *  team with real progress during the hydration window. */
  progress: TeamProgress | null | undefined;
  onPress: () => void;
}

// Left edge (marker + name) stays put; the name truncates with an ellipsis.
// The row is the only place per-team progress can live, so it carries a mono
// sub-line rather than a right-hand pill that read the same on every row.
//
// A club's identity is its geometric marker, per the "no crests, ever"
// constraint. A nation's is its flag image instead; flags are that rule's
// only carve-out, because it exists for trademark exposure and a flag
// carries none.
export function TeamRow({ name, marker, flag, progress, onPress }: TeamRowProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      {flag ? <Flag code={flag} size="marker" label={name} /> : <TeamMarker marker={marker} />}
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.meta, progress?.cleared === true && styles.metaCleared]}>
          {progress === undefined
            ? '—'
            : progress === null
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
