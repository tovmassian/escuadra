import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarGlyph } from '@/components/ActionGlyphs';
import { HomeContinue } from '@/components/HomeContinue';
import { HomeSquads } from '@/components/HomeSquads';
import { NumberWall } from '@/components/NumberWall';
import { GearGlyph } from '@/components/SettingsGlyphs';
import { Wordmark } from '@/components/Wordmark';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { homeView } from '@/lib/homeView';
import { getRoster, getSquad, listSquads } from '@/lib/squads';
import { useProgress, useProgressHydrated } from '@/stores/progress';
import { useSession } from '@/stores/session';
import { borderWidths, iconSize, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Home (#181): the number wall drifting behind "KNOW EVERY NUMBER.", then
// Continue and the starred squads for a returning player, or START TRAINING
// and the star hint on first run. Spec:
// docs/superpowers/specs/2026-10-23-number-wall-home-design.md.
export default function Home() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const hydrated = useProgressHydrated();
  const lastPlayed = useProgress((s) => s.lastPlayed);
  const bestScores = useProgress((s) => s.bestScores);
  const starred = useProgress((s) => s.starredSquads);
  const setLastPlayed = useProgress((s) => s.setLastPlayed);
  const startRound = useSession((s) => s.startRound);

  const view = homeView({ hydrated, lastPlayed, bestScores, starred, squads: listSquads() });
  const wallTop = insets.top + sizes.roundButton;
  const topFade = wallTop + sizes.home.topFade;

  const openPicker = () => router.push('/team-picker');
  const openSquad = (squadId: string) =>
    router.push({ pathname: '/team/[squadId]/difficulty', params: { squadId } });
  // Continue starts the round at the last-played level, as Start Training did.
  const continueRound = (squadId: string, level: number) => {
    const squad = getSquad(squadId);
    if (squad === undefined) return;
    startRound(squad, getRoster(squad.id), level as 1 | 2 | 3);
    setLastPlayed(squad.id, level);
    router.push({
      pathname: '/play/[squadId]/[level]',
      params: { squadId: squad.id, level: String(level) },
    });
  };

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    topFade: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: topFade,
      pointerEvents: 'none',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: sizes.roundButton,
      marginTop: insets.top,
      paddingHorizontal: spacing.lg,
    },
    gear: {
      width: sizes.roundButton,
      height: sizes.roundButton,
      borderRadius: sizes.roundButton / 2,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spacer: { flex: 1 },
    skirt: { height: sizes.home.skirt, pointerEvents: 'none' },
    block: {
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingBottom: insets.bottom + spacing.xl,
      gap: spacing.md,
    },
    headline: { ...typography.homeHeadline, color: colors.textPrimary, marginBottom: spacing.xxs },
    start: {
      minHeight: sizes.home.start,
      borderRadius: radii.pill,
      backgroundColor: colors.ctaBg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    startLabel: { ...typography.homeButton, color: colors.ctaText, textAlign: 'center' },
    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: sizes.minTapTarget,
    },
    hintText: {
      ...typography.homeHint,
      color: colors.textMuted,
      flexShrink: 1,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.root}>
      <NumberWall top={wallTop} />
      <LinearGradient
        colors={[colors.background, colors.background, colors.backgroundClear]}
        locations={[0, insets.top / topFade, 1]}
        style={styles.topFade}
      />

      <View style={styles.topBar}>
        <Wordmark />
        <Pressable
          testID="home-settings"
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={t.home.settings}
          style={({ pressed }) => [styles.gear, pressed && { opacity: opacity.settled }]}
        >
          <GearGlyph color={colors.textPrimary} ground={colors.surface} />
        </Pressable>
      </View>

      <View style={styles.spacer} />

      <LinearGradient colors={[colors.backgroundClear, colors.background]} style={styles.skirt} />
      <View style={styles.block}>
        <Text style={styles.headline}>{t.home.headline}</Text>

        {view.kind === 'returning' && (
          <HomeContinue
            data={view.continue}
            name={squadDisplayName(view.continue.squad, language)}
            onPress={() => continueRound(view.continue.squad.id, view.continue.level)}
          />
        )}
        {view.kind === 'firstRun' && (
          <Pressable
            testID="home-start"
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel={t.home.startTraining}
            style={({ pressed }) => [styles.start, pressed && { opacity: opacity.settled }]}
          >
            <Text style={styles.startLabel}>{t.home.startTraining}</Text>
          </Pressable>
        )}

        {view.kind === 'returning' || (view.kind === 'firstRun' && view.starred.length > 0) ? (
          <HomeSquads squads={view.starred} onOpen={openSquad} onAllTeams={openPicker} />
        ) : view.kind === 'firstRun' ? (
          <View style={styles.hint}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <StarGlyph color={colors.textMuted} filled={false} size={iconSize.starHint} />
            </View>
            <Text style={styles.hintText}>{t.home.starHint}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
