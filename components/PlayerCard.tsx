import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { FlagCode } from '@/assets/flags/generated';
import { Flag } from '@/components/Flag';
import { useT } from '@/i18n/useT';
import { bannerBands, stageVeil } from '@/lib/stageView';
import {
  borderWidths,
  cardGradient,
  durations,
  fontScaleCap,
  radii,
  sizes,
  spacing,
  stage,
  typography,
} from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';
import type { PhotoCredit, TeamMarker } from '@/types/squad';

interface PlayerCardProps {
  /** Results: `sizes.playerCard.results.width`. Study: omitted, so the card
   *  fills its column. */
  width?: number;
  height: number;
  /** Null when Wikipedia lists the player with no shirt number yet (Study
   *  only): the card draws a dash. */
  shirtNumber: number | null;
  name: string;
  /** One line beneath the name: Results' "You picked Marc Pubill", Study's
   *  club or nationality. */
  line?: string;
  photo: PhotoCredit | null;
  marker: TeamMarker;
  /** Study: the position code, top right. */
  badge?: string;
  /** Study's Hide names: the name becomes a dashed "Tap to reveal" pill. */
  nameHidden?: boolean;
  /** 'miss' (Results, `cardLine`) or 'neutral' (Study, `onPhotoMuted`).
   *  Default 'miss'. */
  lineTone?: 'miss' | 'neutral';
  /** A flag before the line (a club squad's nationality). */
  lineFlag?: FlagCode | null;
  /** Replaces the default label (Study passes `studyLabel`). */
  accessibilityLabel?: string;
  /** Makes the whole card a Pressable (Study's reveal). Study passes the same
   *  one whether or not names are hidden, so the root never switches between
   *  View and Pressable, which would remount the card and reload its photo;
   *  the card is a button, and says so, only while `nameHidden`. */
  onPress?: () => void;
}

// A player as a card (spec §5.2), on Results and Study: the team's bands under
// the veil, the photo over them, the shirt number top left, a gradient, and the
// name with one line beneath. The bands are always drawn, so a photo that is
// loading, failed or offline (spec §13) leaves a dark card the white number
// and `cardLine` hold on, never the bare surface. One component, so the two
// screens match.
//
// Results passes only the basics. Study adds slots, each off by default: a
// position chip top right, a flag before the line, a neutral line colour, a
// hidden name drawn as a "Tap to reveal" pill, its own screen-reader label and
// a press, which makes the card a Pressable (a button while its name is hidden)
// and fades a revealed name in.
export function PlayerCard({
  width,
  height,
  shirtNumber,
  name,
  line,
  photo,
  marker,
  badge,
  nameHidden = false,
  lineTone = 'miss',
  lineFlag,
  accessibilityLabel,
  onPress,
}: PlayerCardProps) {
  const colors = useThemeColors();
  const t = useT();
  const themeName = useThemeName();
  // Whether this card has ever drawn the "Tap to reveal" pill. Only then does
  // a shown name fade in, as a reveal; a name that was never hidden has no
  // animation on mount. State rather than a ref, which the lint forbids
  // reading in render; set during the render that first hides the name.
  const [wasHidden, setWasHidden] = useState(nameHidden);
  if (nameHidden && !wasHidden) setWasHidden(true);
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
    badge: {
      position: 'absolute',
      top: spacing.xs + 2,
      right: spacing.xs + 2,
      height: sizes.studyChip,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.glassLine,
      backgroundColor: colors.photoChip,
    },
    badgeText: { ...typography.positionChip, color: colors.onPhoto },
    reveal: {
      alignSelf: 'flex-start',
      justifyContent: 'center',
      height: sizes.revealPill.card,
      paddingHorizontal: spacing.xs + 2,
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      borderStyle: 'dashed',
      borderColor: colors.revealLine,
    },
    revealLabel: { ...typography.revealLabel, color: colors.revealText },
    name: { ...typography.cardName, color: colors.onPhoto },
    line: { ...typography.cardLine, color: colors.cardLine },
    lineNeutral: { ...typography.cardAffiliation, color: colors.onPhotoMuted, flexShrink: 1 },
    lineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs - 2 },
  });

  const neutral = lineTone === 'neutral';
  const lineText = line ? (
    <Text
      style={neutral ? styles.lineNeutral : styles.line}
      numberOfLines={neutral ? 1 : 2}
      maxFontSizeMultiplier={fontScaleCap.display}
    >
      {line}
    </Text>
  ) : null;
  const nameText = (
    <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={fontScaleCap.display}>
      {name}
    </Text>
  );
  // A hidden name is never spoken, not even by the fallback.
  const label =
    accessibilityLabel ??
    (nameHidden
      ? `${shirtNumber ?? t.study.noNumber}, ${t.study.nameHidden}`
      : `${shirtNumber ?? t.study.noNumber}, ${name}${line ? `. ${line}` : ''}`);

  const content = (
    <>
      <View style={styles.bands}>
        {bands.map((band, i) => (
          <View key={i} style={{ flex: band.weight, backgroundColor: band.color }} />
        ))}
      </View>
      <View style={styles.veil} />
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
      ) : null}
      <LinearGradient
        colors={cardGradient.colors}
        locations={cardGradient.locations}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Text style={styles.number} maxFontSizeMultiplier={fontScaleCap.display}>
        {shirtNumber ?? '—'}
      </Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} maxFontSizeMultiplier={fontScaleCap.display}>
            {badge}
          </Text>
        </View>
      ) : null}
      <View style={styles.text}>
        {nameHidden ? (
          <View key="reveal" style={styles.reveal}>
            <Text style={styles.revealLabel} maxFontSizeMultiplier={fontScaleCap.display}>
              {t.study.tapToReveal}
            </Text>
          </View>
        ) : wasHidden ? (
          // Mounted when the pill goes, so a reveal fades the name in. Only a
          // card that has been hidden gets it: a name that was never hidden
          // shows at once. The wrapper sets no style of its own, and so no
          // transform (#125).
          <Animated.View key="name" entering={FadeIn.duration(durations.reveal)}>
            {nameText}
          </Animated.View>
        ) : (
          nameText
        )}
        {lineText && lineFlag ? (
          <View style={styles.lineRow}>
            <Flag code={lineFlag} size="inline" label={line ?? ''} lineColor={colors.glassLine} />
            {lineText}
          </View>
        ) : (
          lineText
        )}
      </View>
    </>
  );

  return onPress ? (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessible
      accessibilityRole={nameHidden ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={nameHidden ? t.study.revealsName : undefined}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.card} accessible accessibilityLabel={label}>
      {content}
    </View>
  );
}
