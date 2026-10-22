import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderWidths, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface PickerPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  /** What a screen reader says, when it differs from the label: "UEFA, Europe". */
  spokenLabel?: string;
  testID?: string;
}

// A filter pill: a league on Clubs, a confederation on Nations (#176, #177).
// The pill is drawn at 40 pt
// inside a transparent `minTapTarget`-tall Pressable. hitSlop would not do:
// it never reaches past the parent's bounds, and the pills' scroll row is
// only as tall as its children.
export function PickerPill({ label, active, onPress, spokenLabel, testID }: PickerPillProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    target: { height: sizes.minTapTarget, justifyContent: 'center' },
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
      testID={testID}
      accessibilityLabel={spokenLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      style={styles.target}
    >
      <View style={[styles.pill, active && styles.pillActive]}>
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </View>
    </Pressable>
  );
}
