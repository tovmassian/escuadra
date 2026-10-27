import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarGlyph } from '@/components/ActionGlyphs';
import { HomeContinue } from '@/components/HomeContinue';
import { HomeSquads } from '@/components/HomeSquads';
import { useLaunchReveal } from '@/components/LaunchReveal';
import { NumberWall } from '@/components/NumberWall';
import { GearGlyph } from '@/components/SettingsGlyphs';
import { Wordmark } from '@/components/Wordmark';
import { useTitleFocus } from '@/hooks/useTitleFocus';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { homeView } from '@/lib/homeView';
import { listSquads } from '@/lib/squads';
import type { TeamFrom } from '@/lib/telemetryEvents';
import { useProgress, useProgressHydrated } from '@/stores/progress';
import {
  borderWidths,
  iconSize,
  launchIntro,
  opacity,
  radii,
  sizes,
  spacing,
  spotlightMotion,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Home (#181): the number wall drifting behind "KNOW EVERY NUMBER.", then
// Continue and the starred squads for a returning player, or START TRAINING
// and the star hint on first run. Spec:
// docs/superpowers/specs/2026-10-23-number-wall-home-design.md.
// On a cold launch the intro's lockup docks into the top bar (#182): the gear
// and the block rise in with the dock's last stretch; the wall is already there.
export default function Home() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const hydrated = useProgressHydrated();
  const lastPlayed = useProgress((s) => s.lastPlayed);
  const bestScores = useProgress((s) => s.bestScores);
  const starred = useProgress((s) => s.starredSquads);
  const view = homeView({ hydrated, lastPlayed, bestScores, starred, squads: listSquads() });
  const wallTop = insets.top + sizes.roundButton;
  const topFade = wallTop + sizes.home.topFade;
  const titleRef = useRef<ViewInstance>(null);
  // The gear is out of VoiceOver's order while Home settles: coming back from
  // Settings, VoiceOver would return to it rather than start on the wordmark.
  const titleFocus = useTitleFocus(titleRef);

  // At rest whenever the reveal is 1, so a launch without the intro, or any
  // later visit, shows Home as it is.
  const reveal = useLaunchReveal()?.reveal;
  const arriveStyle = useAnimatedStyle(() => {
    const arrive = interpolate(
      reveal ? reveal.value : 1,
      [launchIntro.dock.contentDelay / launchIntro.dock.duration, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: arrive,
      transform: [{ translateY: spotlightMotion.rise * (1 - arrive) }],
    };
  });

  const openPicker = () => router.push('/team-picker');
  // Continue and a starred team both open that team's Difficulty, which picks
  // the level to play next. `from` tells usage statistics which one (#221).
  const openSquad = (squadId: string, from: TeamFrom) =>
    router.push({ pathname: '/team/[squadId]/difficulty', params: { squadId, from } });

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
    },
    blockContent: { gap: spacing.md },
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
        <Wordmark ref={titleRef} />
        <Animated.View style={arriveStyle} {...titleFocus.chrome}>
          <Pressable
            testID="home-settings"
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t.home.settings}
            style={({ pressed }) => [styles.gear, pressed && { opacity: opacity.settled }]}
          >
            <GearGlyph color={colors.textPrimary} ground={colors.surface} />
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.spacer} />

      <LinearGradient colors={[colors.backgroundClear, colors.background]} style={styles.skirt} />
      <View style={styles.block}>
        <Animated.View style={[styles.blockContent, arriveStyle]}>
          <Text style={styles.headline}>{t.home.headline}</Text>

          {view.kind === 'returning' && (
            <HomeContinue
              data={view.continue}
              name={squadDisplayName(view.continue.squad, language)}
              onPress={() => openSquad(view.continue.squad.id, 'continue')}
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
            <HomeSquads
              squads={view.starred}
              onOpen={(squadId) => openSquad(squadId, 'squads')}
              onAllTeams={openPicker}
            />
          ) : view.kind === 'firstRun' ? (
            <View style={styles.hint}>
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <StarGlyph color={colors.textMuted} filled={false} size={iconSize.starHint} />
              </View>
              <Text style={styles.hintText}>{t.home.starHint}</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}
