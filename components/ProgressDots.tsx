import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, opacity, radii, sizes, spacing } from '@/theme/tokens';

interface ProgressDotsProps {
  total: number;
  /** 0-indexed position of the current question. */
  current: number;
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { opacity: i === current ? 1 : i < current ? opacity.dotPast : opacity.dotFuture },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xxs + 1 },
  dot: {
    flex: 1,
    height: sizes.progressDot,
    borderRadius: radii.sm - 5,
    backgroundColor: colors.accent,
  },
});
