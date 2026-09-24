import { StyleSheet, Text, View } from 'react-native';
import { borderWidths, radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface BestPillProps {
  correct: number;
  total: number;
  /** Green only once the score passes; a best below the bar stays neutral,
   *  so the ladder never shows a success colour the player didn't earn. */
  cleared: boolean;
}

// A played rung's best score.
export function BestPill({ correct, total, cleared }: BestPillProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    pill: {
      paddingVertical: spacing.xxs - 1,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.pill,
      flexShrink: 0,
    },
    pillCleared: { backgroundColor: colors.successBg },
    pillOpen: { borderWidth: borderWidths.hairline, borderColor: colors.border },
    label: { ...typography.captionEyebrow },
    labelCleared: { color: colors.success },
    labelOpen: { color: colors.textSecondary },
  });

  return (
    <View style={[styles.pill, cleared ? styles.pillCleared : styles.pillOpen]}>
      <Text style={[styles.label, cleared ? styles.labelCleared : styles.labelOpen]}>
        BEST {correct}/{total}
      </Text>
    </View>
  );
}
