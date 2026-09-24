import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BestPill } from '@/components/BestPill';
import { LadderBadge } from '@/components/LadderBadge';
import { type LadderRow, rungAccessibilityLabel } from '@/lib/ladderView';
import { borderWidths, opacity, radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface DifficultyRowProps {
  row: LadderRow;
  title: string;
  /** Absent for a locked rung, which can't be played. */
  onPress?: () => void;
}

// A rung the ladder isn't focused on: one line of badge, title and status. A
// played rung is still a button — tapping it starts that level directly,
// without moving the expanded card.
export function DifficultyRow({ row, title, onPress }: DifficultyRowProps) {
  const colors = useThemeColors();
  const locked = row.status === 'locked';
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    locked: { opacity: opacity.disabled },
    pressed: { opacity: opacity.settled },
    card: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      borderRadius: radii.md,
    },
    title: { ...typography.rowTitle, color: colors.textPrimary, flex: 1 },
    hint: { ...typography.captionEyebrow, color: colors.textMuted, flexShrink: 0 },
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={locked || !onPress}
      accessibilityRole="button"
      accessibilityLabel={rungAccessibilityLabel(row, title)}
      accessibilityState={{ disabled: locked }}
      style={({ pressed }) => [styles.row, locked && styles.locked, pressed && styles.pressed]}
    >
      <LadderBadge level={row.level} status={row.status} expanded={false} />
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {row.best && <BestPill correct={row.best.correct} total={row.best.total} />}
        {locked && row.unlockHint && <Text style={styles.hint}>{row.unlockHint}</Text>}
      </View>
    </Pressable>
  );
}
