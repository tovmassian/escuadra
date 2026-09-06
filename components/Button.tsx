import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, opacity, radii, sizes, typography } from '@/theme/tokens';

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
          { height: large ? sizes.controlHeightLarge : sizes.controlHeight },
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

const styles = StyleSheet.create({
  pressed: { opacity: opacity.settled },
  control: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: colors.accent },
  outline: { borderWidth: 1, borderColor: colors.border },
  inert: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { ...typography.body },
  filledLabel: { color: colors.accentOn },
  outlineLabel: { color: colors.textSecondary },
  inertLabel: { color: colors.textMuted },
  textLabel: { ...typography.secondary, color: colors.textSecondary, textAlign: 'center' },
});
