import { Pressable, StyleSheet, Text } from 'react-native';
import { borderWidths, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface PickerPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

// A league filter pill on the clubs tab (#176). Drawn at 40 pt; the slop takes
// its tap target to `minTapTarget`.
const SLOP = (sizes.minTapTarget - sizes.pickerPill) / 2;

export function PickerPill({ label, active, onPress }: PickerPillProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    pill: {
      justifyContent: 'center',
      height: sizes.pickerPill,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
    },
    pillActive: { backgroundColor: colors.ctaBg, borderColor: colors.ctaBg },
    label: { ...typography.pillLabel, color: colors.textSecondary },
    labelActive: { ...typography.pillLabelActive, color: colors.ctaText },
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      hitSlop={{ top: SLOP, bottom: SLOP }}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}
