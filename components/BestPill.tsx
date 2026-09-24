import { StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface BestPillProps {
  correct: number;
  total: number;
}

// A played rung's best score, on the success wash.
export function BestPill({ correct, total }: BestPillProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    pill: {
      paddingVertical: spacing.xxs - 1,
      paddingHorizontal: spacing.xs,
      backgroundColor: colors.successBg,
      borderRadius: radii.pill,
      flexShrink: 0,
    },
    label: { ...typography.captionEyebrow, color: colors.success },
  });

  return (
    <View style={styles.pill}>
      <Text style={styles.label}>
        BEST {correct}/{total}
      </Text>
    </View>
  );
}
