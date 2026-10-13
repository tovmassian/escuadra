import type { Level } from '@/lib/questionEngine';
import { heroTabMetrics } from '@/lib/roundView';
import {
  durations,
  elevation,
  heroCardSize,
  heroNumberSize,
  radii,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HeroTabFillet } from './HeroTabFillet';
import { Skeleton } from './Skeleton';

interface HeroCardProps {
  level: Level;
  shirtNumber: number;
  loading?: boolean;
  /** Overrides the level's full size, as fitted to the screen by `fitHeroCard`. */
  fit?: { size: number; numberSize: number };
  /** Photo POC: a Wikimedia Commons thumbnail to fill the card. The number
   *  card shows until it loads, and stays if it fails. */
  photoUrl?: string | null;
}

// Every level holds a shirt number; with a photo (Photo POC) the photo fills
// the same square footprint and the number moves into a bottom-left tab.
export function HeroCard({ level, shirtNumber, loading, fit, photoUrl }: HeroCardProps) {
  const colors = useThemeColors();
  const [photoShown, setPhotoShown] = useState(false);
  const size = fit?.size ?? heroCardSize[level];
  const numberSize = fit?.numberSize ?? heroNumberSize[level];
  const tab = heroTabMetrics(size);
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
    // The photo card clips to its rounded corners, and on iOS a clipping view
    // drops its own shadow — so the shadow sits on an outer view.
    shadow: { borderRadius: radii.xl, backgroundColor: colors.surface, ...elevation.e1 },
    clip: {
      flex: 1,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    tab: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      height: tab.thickness,
      minWidth: tab.thickness,
      paddingLeft: tab.padStart,
      paddingRight: tab.padEnd,
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderTopRightRadius: tab.fillet,
    },
    tabNumber: {
      fontFamily: 'IBMPlexMono-Bold',
      fontWeight: '700',
      color: colors.textPrimary,
      fontSize: tab.numberSize,
      lineHeight: Math.round(tab.numberSize * 1.05),
    },
    filletAbove: { position: 'absolute', left: 0, bottom: '100%' },
    filletBeside: { position: 'absolute', left: '100%', bottom: 0 },
  });

  const numberText = (
    <Text style={[styles.number, { fontSize: numberSize, lineHeight: numberSize * 1.05 }]}>
      {shirtNumber}
    </Text>
  );

  if (!photoUrl || loading) {
    return (
      <View style={[styles.card, { width: size, height: size }]}>
        {loading ? (
          <Skeleton width={numberSize} height={numberSize} radius={radii.sm} />
        ) : (
          <>
            {numberText}
            {level === 1 && <Text style={styles.label}>SHIRT NUMBER</Text>}
          </>
        )}
      </View>
    );
  }

  // The photo's own label is never read out: Commons file names and captions
  // usually name the player. The card reads as its shirt number, as it does
  // without a photo.
  return (
    <View
      style={[styles.shadow, { width: size, height: size }]}
      accessible
      accessibilityLabel={`Shirt number ${shirtNumber}`}
    >
      <View style={styles.clip}>
        {!photoShown && (
          <>
            {numberText}
            {level === 1 && <Text style={styles.label}>SHIRT NUMBER</Text>}
          </>
        )}
        <Image
          source={{ uri: photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          transition={durations.reveal}
          accessible={false}
          onLoad={() => setPhotoShown(true)}
          onError={() => setPhotoShown(false)}
        />
        {photoShown && (
          <View style={styles.tab}>
            <HeroTabFillet size={tab.fillet} color={colors.surface} style={styles.filletAbove} />
            <Text style={styles.tabNumber}>{shirtNumber}</Text>
            <HeroTabFillet size={tab.fillet} color={colors.surface} style={styles.filletBeside} />
          </View>
        )}
      </View>
    </View>
  );
}
