import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface Segment {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  segments: readonly Segment[];
  value: string;
  onChange: (key: string) => void;
}

export function SegmentedControl({ segments, value, onChange }: SegmentedControlProps) {
  return (
    <View style={styles.track}>
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <Pressable
            key={s.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(s.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, { color: active ? colors.accentOn : colors.textMuted }]}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: spacing.xs - 2,
    padding: spacing.xxs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  segmentActive: { backgroundColor: colors.accent },
  label: { ...typography.segmentLabel },
});
