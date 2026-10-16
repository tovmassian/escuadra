import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderWidths, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export type ButtonVariant = 'filled' | 'outline' | 'inert' | 'text';

interface ButtonProps {
  label: string;
  variant: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  /** Start Training is the one 56px control; everything else is 52px. */
  large?: boolean;
}

export function Button({ label, variant, onPress, disabled, large }: ButtonProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    pressed: { opacity: opacity.settled },
    // The 2.0 buttons (Results, the question footer): a pill, `ctaLabel`.
    control: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filled: { backgroundColor: colors.ctaBg },
    outline: { borderWidth: borderWidths.thick, borderColor: colors.border },
    inert: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    label: { ...typography.ctaLabel },
    filledLabel: { color: colors.ctaText },
    outlineLabel: { color: colors.textPrimary },
    inertLabel: { color: colors.textMuted },
    textLabel: { ...typography.secondary, color: colors.textSecondary, textAlign: 'center' },
  });

  if (variant === 'text') {
    return (
      <Pressable
        testID="app-button"
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <Text style={styles.textLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID="app-button"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <View
        style={[
          styles.control,
          // The least it is tall; it grows with the text at large sizes.
          { minHeight: large ? sizes.controlHeightLarge : sizes.controlHeight },
          variant === 'filled' && styles.filled,
          variant === 'outline' && styles.outline,
          variant === 'inert' && styles.inert,
        ]}
      >
        <Text
          style={[
            styles.label,
            variant === 'filled' && styles.filledLabel,
            variant === 'outline' && styles.outlineLabel,
            variant === 'inert' && styles.inertLabel,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
