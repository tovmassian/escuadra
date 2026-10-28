import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { FlagCode } from '@/assets/flags/generated';
import { Flag } from '@/components/Flag';
import { useT } from '@/i18n/useT';
import { bannerBands, stageVeil } from '@/lib/stageView';
import {
  borderWidths,
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

interface StudyListRowProps {
  /** Null when Wikipedia lists the player with no shirt number yet: the
   *  number column and the avatar draw a dash. */
  shirtNumber: number | null;
  name: string;
  /** Study's Hide names: the name becomes a dashed "Tap to reveal" pill. */
  nameHidden: boolean;
  /** A club squad's nationality, or a nation squad's club. */
  affiliation: string;
  /** A flag before the affiliation (a club squad's nationality). */
  affiliationFlag: FlagCode | null;
  /** The position code, in the chip at the end of the row. */
  position: string;
  photo: PhotoCredit | null;
  marker: TeamMarker;
  /** What a screen reader hears: Study passes `studyLabel`, which never speaks
   *  a hidden name. */
  accessibilityLabel: string;
  /** Makes the whole row a Pressable (Study's reveal). Study passes the same
   *  one whether or not names are hidden, so the root never switches between
   *  View and Pressable, which would remount the row and reload its photo;
   *  the row is a button, and says so, only while `nameHidden`. */
  onPress?: () => void;
}

// A player as a row of Study's list view (spec §5.1): an avatar, the shirt
// number, the name over the club or nationality, and the position chip. The
// avatar is the player's photo over the team's bands under the veil, as
// `PlayerCard` is, with the number on the bands when there is no photo. One
// accessible element, a button when it can reveal a name; a revealed name
// fades in.
export function StudyListRow({
  shirtNumber,
  name,
  nameHidden,
  affiliation,
  affiliationFlag,
  position,
  photo,
  marker,
  accessibilityLabel,
  onPress,
}: StudyListRowProps) {
  const colors = useThemeColors();
  const t = useT();
  const themeName = useThemeName();
  // Whether this row has ever drawn the "Tap to reveal" pill. Only then does
  // a shown name fade in, as a reveal; a name that was never hidden has no
  // animation on mount. State rather than a ref, which the lint forbids
  // reading in render; set during the render that first hides the name.
  const [wasHidden, setWasHidden] = useState(nameHidden);
  if (nameHidden && !wasHidden) setWasHidden(true);
  const bands = bannerBands(marker);
  const number = shirtNumber ?? '—';
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      height: sizes.studyRow,
      borderBottomWidth: borderWidths.hairline,
      borderBottomColor: colors.hairline,
    },
    avatar: {
      width: sizes.avatar,
      height: sizes.avatar,
      borderRadius: radii.pill,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    bands: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
    veil: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.veilInk,
      opacity: stageVeil(bands, themeName),
    },
    avatarNumber: { ...typography.avatarNumber, color: colors.onPhoto },
    number: { ...typography.rowNumber, width: sizes.studyColumn.no, color: colors.textMuted },
    middle: { flex: 1, minWidth: 0, gap: spacing.xxs - 1 },
    name: { ...typography.cardName, color: colors.textPrimary },
    reveal: {
      alignSelf: 'flex-start',
      justifyContent: 'center',
      height: sizes.revealPill.row,
      paddingHorizontal: spacing.xs + 1,
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    revealLabel: { ...typography.revealLabel, color: colors.textMuted },
    affiliationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs - 2 },
    affiliation: { ...typography.rowAffiliation, color: colors.textSecondary, flexShrink: 1 },
    chip: {
      height: sizes.studyChip,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
    },
    chipText: { ...typography.positionChip, color: colors.textSecondary },
  });

  const nameText = (
    <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.display}>
      {name}
    </Text>
  );

  const content = (
    <>
      <View style={styles.avatar}>
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
        ) : (
          <Text style={styles.avatarNumber} maxFontSizeMultiplier={fontScaleCap.display}>
            {number}
          </Text>
        )}
      </View>
      <Text style={styles.number} maxFontSizeMultiplier={fontScaleCap.display}>
        {number}
      </Text>
      <View style={styles.middle}>
        {nameHidden ? (
          <View key="reveal" style={styles.reveal}>
            <Text style={styles.revealLabel} maxFontSizeMultiplier={fontScaleCap.display}>
              {t.study.tapToReveal}
            </Text>
          </View>
        ) : wasHidden ? (
          // Mounted when the pill goes, so a reveal fades the name in. Only a
          // row that has been hidden gets it: a name that was never hidden
          // shows at once. The wrapper sets no style of its own, and so no
          // transform (#125).
          <Animated.View key="name" entering={FadeIn.duration(durations.reveal)}>
            {nameText}
          </Animated.View>
        ) : (
          nameText
        )}
        <View style={styles.affiliationRow}>
          <Flag code={affiliationFlag} size="inline" label={affiliation} />
          <Text
            style={styles.affiliation}
            numberOfLines={1}
            maxFontSizeMultiplier={fontScaleCap.display}
          >
            {affiliation}
          </Text>
        </View>
      </View>
      <View style={styles.chip}>
        <Text style={styles.chipText} maxFontSizeMultiplier={fontScaleCap.display}>
          {position}
        </Text>
      </View>
    </>
  );

  return onPress ? (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessible
      accessibilityRole={nameHidden ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={nameHidden ? t.study.revealsName : undefined}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
}
