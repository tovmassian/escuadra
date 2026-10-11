import type { Level } from '@/lib/questionEngine';
import {
  elevation,
  heroCardSize,
  heroNumberSize,
  radii,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { StyleSheet, Text, View } from 'react-native';
import { Skeleton } from './Skeleton';

interface HeroCardProps {
  level: Level;
  shirtNumber: number;
  loading?: boolean;
  /** Overrides the level's full size, as fitted to the screen by `fitHeroCard`. */
  fit?: { size: number; numberSize: number };
}

// Every level currently holds a shirt number; the square footprint this
// reserves is deliberate — v1's photo drops in here without a redesign.
export function HeroCard({ level, shirtNumber, loading, fit }: HeroCardProps) {
  const colors = useThemeColors();
  const size = fit?.size ?? heroCardSize[level];
  const numberSize = fit?.numberSize ?? heroNumberSize[level];
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
