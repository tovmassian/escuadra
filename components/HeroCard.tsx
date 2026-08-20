import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Skeleton } from './Skeleton';
import {
  colors,
  elevation,
  heroCardSize,
  heroNumberSize,
  radii,
  spacing,
  typography,
} from '@/theme/tokens';
import type { Level } from '@/lib/questionEngine';

interface HeroCardProps {
  level: Level;
  shirtNumber: number;
  loading?: boolean;
}

// Every level currently holds a shirt number; the square footprint this
// reserves is deliberate — v1's photo drops in here without a redesign.
export function HeroCard({ level, shirtNumber, loading }: HeroCardProps) {
  const size = heroCardSize[level];
  const numberSize = heroNumberSize[level];

  return (
    <View style={[styles.card, { width: size, height: size }]}>
      {loading ? (
        <Skeleton width={numberSize} height={numberSize} radius={radii.sm} />
      ) : (
        <>
          <Text style={[styles.number, { fontSize: numberSize, lineHeight: numberSize * 1.05 }]}>
            {shirtNumber}
          </Text>
          {level === 1 && <Text style={styles.label}>SHIRT NUMBER</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.e1,
  },
  number: {
    fontFamily: 'IBMPlexMono-Bold',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  label: {
    ...typography.captionEyebrow,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
