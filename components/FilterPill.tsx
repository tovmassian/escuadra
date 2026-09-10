import { Pressable, StyleSheet, Text } from 'react-native';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function FilterPill({ label, active, onPress }: FilterPillProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    pill: {
      paddingVertical: spacing.xs - 2,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    pillIdle: { backgroundColor: colors.surface, borderColor: colors.border },
    label: { ...typography.filterLabel },
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}
    >
      <Text style={[styles.label, { color: active ? colors.background : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}
