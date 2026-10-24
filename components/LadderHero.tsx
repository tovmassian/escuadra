import { LinearGradient } from 'expo-linear-gradient';
import type { Ref } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarGlyph } from './ActionGlyphs';
import { Flag } from './Flag';
import { RoundBackButton, RoundButton, useRoundGlyphColor } from './RoundBackButton';
import { TeamMarker } from './TeamMarker';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { flagFor } from '@/lib/flags';
import { heroLine } from '@/lib/ladderView';
import { bannerBands, heroTextAlpha, withAlpha } from '@/lib/stageView';
import { fontScaleCap, ladderHero, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';
import type { League, Squad } from '@/types/squad';

interface LadderHeroProps {
  squad: Squad;
  /** A club's league, for the mono line; a nation reads "National team". */
  league: League | undefined;
  onBack: () => void;
  /** Whether the team is in Your squads (#179), and the star that toggles it. */
  starred: boolean;
  onToggleStar: () => void;
  /** The star's own view: Difficulty's second How to play tip rings it (#183). */
  starRef?: Ref<ViewInstance>;
}

// The Difficulty hero (#178, spec §1): the squad's marker as vertical bands,
// the in-round banner rule, full bleed from the top of the window. Over them,
// the top bar (back, and the Your squads star), then the team's flag or marker,
// its name and the mono line.
//
// The veil is the palette's `background`, and it is computed, not the
// canvas's fixed fade: Real Madrid's white, or a black band in light theme,
// would leave the name unreadable. `heroTextAlpha` is the least wash at which
// the name and the mono line hold their contrast over every band. Each layer
// sits behind its own row, so the guarantee holds however far a long name
// wraps: the top bar fades from the theme's floor to that alpha, the identity
// block from that alpha to solid ground.
export function LadderHero({
  squad,
  league,
  onBack,
  starred,
  onToggleStar,
  starRef,
}: LadderHeroProps) {
  const colors = useThemeColors();
  const theme = useThemeName();
  const t = useT();
  const language = useLanguage();
  const insets = useSafeAreaInsets();
  const bands = bannerBands(squad.marker);
  const textAlpha = heroTextAlpha(bands, theme);
  // A nation shows its flag (guardrail 2's carve-out); a club, or a nation
  // with no flag in lib/flags.ts, its bands.
  const flag = squad.kind === 'nation' ? flagFor(squad.name) : null;
  // Glass in dark theme only. In light theme the veil is the light ground at
  // its floor, so over a pale band (Real Madrid's white) the glass's white
  // glyph falls to 2.85:1, under 3:1; the ground button (surface, border,
  // textPrimary glyph) is solid.
  const glass = theme === 'dark';
  const glyph = useRoundGlyphColor(glass);

  const styles = StyleSheet.create({
    hero: { overflow: 'hidden' },
    bands: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
    // The bar's padding takes in the status bar, so its veil runs up behind it
    // to the top of the window.
    bar: { paddingTop: insets.top, paddingHorizontal: spacing.lg },
    barRow: {
      height: sizes.roundButton,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    identity: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm + 2,
      gap: spacing.xs,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { ...typography.heroName, color: colors.textPrimary, flexShrink: 1 },
    line: { ...typography.monoCaption, color: colors.textSecondary },
  });

  return (
    <View style={styles.hero}>
      <View
        style={styles.bands}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {bands.map((band, i) => (
          <View key={i} style={{ flex: band.weight, backgroundColor: band.color }} />
        ))}
      </View>
      <View style={styles.bar}>
        <LinearGradient
          colors={[
            withAlpha(colors.background, ladderHero.veilFloor[theme]),
            withAlpha(colors.background, textAlpha),
          ]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.barRow}>
          <RoundBackButton
            glass={glass}
            label={t.common.back}
            onPress={onBack}
            testID="difficulty-back"
          />
          {/* A constant name, so it reads "One of your squads, on" or "off".
              aria-pressed is for react-native-web, which does not read
              accessibilityState. */}
          <RoundButton
            testID="difficulty-star"
            ref={starRef}
            glass={glass}
            onPress={onToggleStar}
            accessibilityRole="togglebutton"
            accessibilityLabel={t.ladder.star}
            accessibilityState={{ checked: starred }}
            aria-pressed={starred}
          >
            <StarGlyph color={glyph} filled={starred} />
          </RoundButton>
        </View>
      </View>
      <View style={styles.identity}>
        <LinearGradient
          colors={[withAlpha(colors.background, textAlpha), colors.background]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.nameRow}>
          {/* Hidden: the name follows it. */}
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {flag ? (
              <Flag code={flag} size="picker" label="" />
            ) : (
              <TeamMarker marker={squad.marker} variant="picker" />
            )}
          </View>
          <Text
            style={styles.name}
            accessibilityRole="header"
            maxFontSizeMultiplier={fontScaleCap.display}
          >
            {squadDisplayName(squad, language)}
          </Text>
        </View>
        <Text style={styles.line}>{heroLine(squad, league, t)}</Text>
      </View>
    </View>
  );
}
