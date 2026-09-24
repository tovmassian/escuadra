import { StyleSheet, Text, View } from 'react-native';
import { LockGlyph } from '@/components/LockGlyph';
import { VerdictGlyph } from '@/components/VerdictGlyph';
import type { DifficultyStatus } from '@/lib/ladderView';
import type { Level } from '@/lib/questionEngine';
import { borderWidths, iconSize, ladderBadgeSize, radii, sizes, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface LadderBadgeProps {
  level: Level;
  status: DifficultyStatus;
  expanded: boolean;
}

// A rung's badge: its number while playable, the mark once cleared, a padlock
// while locked. Centred in the ladder's fixed-width column so both badge
// sizes, and the connector segments between them, share one vertical axis.
export function LadderBadge({ level, status, expanded }: LadderBadgeProps) {
  const colors = useThemeColors();
  const size = expanded ? ladderBadgeSize.expanded : ladderBadgeSize.compact;
  const styles = StyleSheet.create({
    column: { width: sizes.difficultyBadgeColumn, alignItems: 'center', flexShrink: 0 },
    badge: {
      width: size,
      height: size,
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locked: { backgroundColor: colors.surface, borderColor: colors.border },
    unlocked: { backgroundColor: colors.accent, borderColor: colors.accent },
    cleared: { backgroundColor: colors.success, borderColor: colors.success },
    number: { ...typography.badgeNumber, color: colors.accentOn },
  });

  return (
    <View style={styles.column}>
      <View style={[styles.badge, styles[status]]}>
        {status === 'locked' ? (
          <LockGlyph size={Math.round(size * iconSize.lockGlyphRatio)} />
        ) : status === 'cleared' ? (
          <VerdictGlyph
            correct
            size={expanded ? iconSize.markLarge : iconSize.markSmall}
            color={colors.accentOn}
          />
        ) : (
          <Text style={styles.number}>{level}</Text>
        )}
      </View>
    </View>
  );
}
