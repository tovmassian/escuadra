import { StyleSheet, Text, View } from 'react-native';
import { BestPill } from '@/components/BestPill';
import { Button } from '@/components/Button';
import { LadderBadge } from '@/components/LadderBadge';
import { type LadderRow, playLabel } from '@/lib/ladderView';
import { borderWidths, radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface DifficultyCardProps {
  row: LadderRow;
  title: string;
  description: string;
  onPlay: () => void;
}

// The focused rung, expanded in its own slot on the ladder: what the level
// asks, and a real Play button, so the way in is a labelled button rather
// than a card the player has to guess is pressable.
export function DifficultyCard({ row, title, description, onPlay }: DifficultyCardProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    // Drops the badge level with the title line rather than the card's top edge.
    badge: { paddingTop: spacing.md },
    card: {
      flex: 1,
      gap: spacing.sm,
      padding: spacing.xl,
      backgroundColor: colors.surfaceRaised,
      borderWidth: borderWidths.emphasis,
      borderColor: colors.accent,
      borderRadius: radii.xl,
    },
    header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
    title: { ...typography.sectionHead, color: colors.textPrimary },
    description: { ...typography.secondary, color: colors.textSecondary },
    action: { marginTop: spacing.xxs },
  });

  return (
    <View style={styles.row}>
      <View style={styles.badge}>
        <LadderBadge level={row.level} status={row.status} expanded />
      </View>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {row.best && (
            <BestPill
              correct={row.best.correct}
              total={row.best.total}
              cleared={row.status === 'cleared'}
            />
          )}
        </View>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.action}>
          <Button label={playLabel(row)} variant="filled" onPress={onPlay} />
        </View>
      </View>
    </View>
  );
}
