import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { bannerBands, stageVeil } from '@/lib/stageView';
import { cardGradient, durations, radii, spacing, stage, typography } from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';
import type { PhotoCredit, TeamMarker } from '@/types/squad';

interface PlayerCardProps {
  /** Results: `sizes.playerCard.results.width`. Study: omitted, so the card
   *  fills its column. */
  width?: number;
  height: number;
  shirtNumber: number;
  name: string;
  /** One line beneath the name, e.g. "You picked Marc Pubill". */
  line?: string;
  photo: PhotoCredit | null;
  marker: TeamMarker;
}

// A player as a card (spec §5.2), on Results and Study: the photo (or the
// team's bands under the veil), the shirt number top left, a gradient, and
// the name with one line beneath. One component, so the two screens match.
export function PlayerCard({
  width,
  height,
  shirtNumber,
  name,
  line,
  photo,
  marker,
}: PlayerCardProps) {
  const colors = useThemeColors();
  const themeName = useThemeName();
  const bands = bannerBands(marker);
  const styles = StyleSheet.create({
    card: {
      width,
      height,
      borderRadius: radii.card,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    bands: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
    veil: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.veilInk,
      opacity: stageVeil(bands, themeName),
    },
    number: {
      ...typography.cardNumber,
      color: colors.onPhoto,
      position: 'absolute',
      left: spacing.sm,
      top: spacing.xs,
    },
    text: {
      position: 'absolute',
      left: spacing.sm,
      right: spacing.sm,
      bottom: spacing.sm,
      gap: spacing.xxs,
    },
    name: { ...typography.cardName, color: colors.onPhoto },
    line: { ...typography.cardLine, color: colors.cardLine },
  });

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${shirtNumber}, ${name}${line ? `. ${line}` : ''}`}
    >
      {photo ? (
        <Image
          key={photo.url}
          recyclingKey={photo.url}
          source={{ uri: photo.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={stage.focal}
          transition={durations.reveal}
          cachePolicy="disk"
        />
      ) : (
        <>
          <View style={styles.bands}>
            {bands.map((band, i) => (
              <View key={i} style={{ flex: band.weight, backgroundColor: band.color }} />
            ))}
          </View>
          <View style={styles.veil} />
        </>
      )}
      <LinearGradient
        colors={cardGradient.colors}
        locations={cardGradient.locations}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Text style={styles.number}>{shirtNumber}</Text>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {line ? (
          <Text style={styles.line} numberOfLines={2}>
            {line}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
