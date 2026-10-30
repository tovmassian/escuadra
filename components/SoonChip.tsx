import { StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The SOON chip on a feature that is coming (Settings' Coming next, Difficulty's
// Exam mode): mono capitals on a translucent pill.
export function SoonChip({ label }: { label: string }) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    chip: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs - spacing.hair,
      borderRadius: radii.pill,
      backgroundColor: colors.soonBg,
    },
    label: { ...typography.soonChip, color: colors.textSecondary },
  });
  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
