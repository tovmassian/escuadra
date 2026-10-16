import { Pressable, StyleSheet, Text } from 'react-native';
import { opacity, radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Study's players per position, drawn after the label. The team picker
   *  passes none. */
  count?: number;
}

export function FilterPill({ label, active, onPress, count }: FilterPillProps) {
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
    // Only with a count, so a pill without one lays out as it always did.
    pillCounted: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs - 2 },
    label: { ...typography.filterLabel },
    count: { ...typography.filterCount, opacity: opacity.settled },
  });
  const ink = active ? colors.accentOn : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.pill,
        active ? styles.pillActive : styles.pillIdle,
        count === undefined ? null : styles.pillCounted,
      ]}
    >
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
      {count === undefined ? null : <Text style={[styles.count, { color: ink }]}>{count}</Text>}
    </Pressable>
  );
}
