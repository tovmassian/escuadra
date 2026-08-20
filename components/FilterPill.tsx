import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function FilterPill({ label, active, onPress }: FilterPillProps) {
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
