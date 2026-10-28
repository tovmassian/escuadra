import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OutdatedGlyph, PlayGlyph } from './ActionGlyphs';
import { Flag } from './Flag';
import { TeamMarker } from './TeamMarker';
import { useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import {
  continueMeta,
  continueSpoken,
  type HomeContinue as HomeContinueData,
} from '@/lib/homeView';
import { fontScaleCap, iconSize, opacity, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Home's Continue (#181): one ctaBg pill with the team's flag or marker,
// "CONTINUE SPAIN", the level Difficulty will offer next with its best (and
// OUTDATED when it is, #180) or A LA ESCUADRA once the squad is done, and a
// play circle. A tap opens the team's Difficulty; the screen passes that in.
// One button to a screen reader.
export function HomeContinue({
  data,
  name,
  onPress,
}: {
  data: HomeContinueData;
  name: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const t = useT();
  const flag = data.squad.kind === 'nation' ? flagFor(data.squad.name) : null;
  const styles = StyleSheet.create({
    button: {
      minHeight: sizes.home.continue,
      borderRadius: sizes.home.continue / 2,
      backgroundColor: colors.ctaBg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      paddingLeft: spacing.md + 2,
      paddingRight: spacing.sm,
      paddingVertical: spacing.xs,
    },
    text: { flex: 1, minWidth: 0, gap: spacing.xxs / 2 },
    title: { ...typography.homeButton, color: colors.ctaText },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: spacing.xxs,
    },
    meta: { ...typography.homeMeta, color: colors.ctaMuted },
    play: {
      width: sizes.home.play,
      height: sizes.home.play,
      borderRadius: sizes.home.play / 2,
      backgroundColor: colors.ctaText,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <Pressable
      testID="home-continue"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={continueSpoken(name, data, t)}
      style={({ pressed }) => [styles.button, pressed && { opacity: opacity.settled }]}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {flag ? (
          <Flag code={flag} size="continue" label={name} lineColor={colors.ctaLine} />
        ) : (
          <TeamMarker marker={data.squad.marker} variant="continue" ringColor={colors.ctaLine} />
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={fontScaleCap.display}>
          {t.home.continueTeam(name)}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{continueMeta(data, t)}</Text>
          {data.best?.outdated && (
            <>
              <Text style={styles.meta}>·</Text>
              <OutdatedGlyph color={colors.ctaMuted} size={iconSize.outdated} />
              <Text style={styles.meta}>{t.common.outdated}</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.play}>
        <PlayGlyph color={colors.ctaBg} />
      </View>
    </Pressable>
  );
}
