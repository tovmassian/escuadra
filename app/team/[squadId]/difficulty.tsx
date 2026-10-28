import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewInstance,
  type ScrollViewInstance,
  type TextInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EraserGlyph, OutdatedGlyph } from '@/components/ActionGlyphs';
import { ExamModeRow } from '@/components/ExamModeRow';
import { LadderCard } from '@/components/LadderCard';
import { LadderHero } from '@/components/LadderHero';
import { LadderRung } from '@/components/LadderRung';
import { ResetSheet } from '@/components/ResetSheet';
import { BookGlyph } from '@/components/SettingsGlyphs';
import { TipsLayer } from '@/components/TipsLayer';
import { useTips } from '@/hooks/useTips';
import { useTitleFocus } from '@/hooks/useTitleFocus';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import {
  focusedLevel,
  formatLastUpdated,
  hasOutdated,
  ladderRows,
  levelDescription,
  squadUpdatedLine,
} from '@/lib/ladderView';
import type { Level } from '@/lib/questionEngine';
import { squadScores } from '@/lib/reset';
import { getSquad, squadLeague } from '@/lib/squads';
import { track } from '@/lib/telemetry';
import { paramOf, TEAM_FROM } from '@/lib/telemetryEvents';
import { useProgress } from '@/stores/progress';
import {
  borderWidths,
  fontScaleCap,
  iconSize,
  opacity,
  radii,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Difficulty (#178): the team's bands under a veil, then the ladder: cleared
// levels compact with their best, the focused level a Play card, locked
// levels with what opens them; Exam mode, as a placeholder; Study; and when
// the squad was last updated. The corner star keeps the team in Your squads
// (#179). A best set before the squad's last update is grey, and a line under
// the heading says why (#180).
export default function Difficulty() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const { squadId, from, search } = useLocalSearchParams<{
    squadId: string;
    from?: string;
    search?: string;
  }>();
  const bestScores = useProgress((s) => s.bestScores);
  const starred = useProgress((s) => s.starredSquads.includes(squadId));
  const toggleStar = useProgress((s) => s.toggleStar);
  const resetSquad = useProgress((s) => s.resetSquad);
  // Start over (#197): the sheet beside Study that sends this team back to unplayed.
  const [startOver, setStartOver] = useState(false);
  // The pinned footer's height, so the tips scroll a target clear of it.
  const [footerHeight, setFooterHeight] = useState(0);
  // How to play (#183): Play, the star, then Study, scrolled to on a short screen.
  const tips = useTips('difficulty');
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const playRef = useRef<ViewInstance>(null);
  const starRef = useRef<ViewInstance>(null);
  const studyRef = useRef<ViewInstance>(null);
  const titleRef = useRef<TextInstance>(null);
  const titleFocus = useTitleFocus(titleRef, !tips.open);

  // Usage statistics (#221): how the team was reached, once per visit. A screen
  // pushed over this one and closed again does not count a second time.
  const kind = getSquad(squadId)?.kind;
  useEffect(() => {
    if (!kind) return;
    const opener = paramOf(from, TEAM_FROM);
    track('team.opened', {
      squad: squadId,
      kind,
      from: opener,
      ...(opener === 'picker' ? { search: search === 'true' } : {}),
    });
    // Once per mount: the params are the route's, fixed for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId, kind]);

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingTop: spacing.sm - 2,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    headingBlock: { gap: spacing.xs - 2, paddingBottom: spacing.xxs / 2 },
    heading: { ...typography.monoCaption, color: colors.textMuted },
    outdatedNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs - 2 },
    outdatedText: { ...typography.secondarySmall, color: colors.textMuted, flexShrink: 1 },
    exam: { marginTop: spacing.xxs + 2 },
    // Study and the source line stay put while the ladder scrolls under their fade.
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: insets.bottom + spacing.sm,
      gap: spacing.xs,
      backgroundColor: colors.background,
    },
    fade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: '100%',
      height: sizes.ladderFooterFade,
    },
    actions: { flexDirection: 'row', gap: spacing.sm },
    study: {
      flex: 1,
      minHeight: sizes.ladderPill,
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + 2,
    },
    studyLabel: { ...typography.ladderStudy, color: colors.textPrimary },
    updated: { ...typography.secondarySmall, color: colors.textMuted, textAlign: 'center' },
    eraser: {
      alignSelf: 'center',
      width: sizes.ladderPill,
      height: sizes.ladderPill,
      borderRadius: sizes.ladderPill / 2,
      borderWidth: borderWidths.thick,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const squad = getSquad(squadId);
  if (!squad) return null;

  const name = squadDisplayName(squad, language);
  const scores = squadScores(bestScores, squad.id);
  const rows = ladderRows(squad.id, bestScores, squad.lastUpdated);
  const focused = focusedLevel(rows);
  const play = (level: Level) =>
    router.push({
      pathname: '/play/[squadId]/[level]',
      params: { squadId: squad.id, level: String(level) },
    });

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        {...tips.contentA11y}
        contentContainerStyle={{ paddingBottom: sizes.ladderFooterFade }}
      >
        <LadderHero
          squad={squad}
          league={squadLeague(squad.id)}
          onBack={() => router.back()}
          starred={starred}
          onToggleStar={() => toggleStar(squad.id)}
          starRef={starRef}
          titleRef={titleRef}
          barA11y={titleFocus.chrome}
        />
        <View style={styles.content}>
          <View style={styles.headingBlock}>
            <Text style={styles.heading} accessibilityRole="header">
              {t.ladder.heading}
            </Text>
            {hasOutdated(rows) && (
              <View style={styles.outdatedNote}>
                <OutdatedGlyph color={colors.textMuted} size={iconSize.outdatedNote} />
                <Text style={styles.outdatedText}>{squadUpdatedLine(squad.lastUpdated, t)}</Text>
              </View>
            )}
          </View>
          {rows.map((row) => {
            const title = t.ladder.levels[row.level].title;
            return row.level === focused ? (
              <LadderCard
                key={row.level}
                row={row}
                title={title}
                description={levelDescription(row.level, squad.kind, t)}
                onPlay={() => play(row.level)}
                playRef={playRef}
              />
            ) : (
              <LadderRung
                key={row.level}
                row={row}
                title={title}
                onPress={row.status === 'locked' ? undefined : () => play(row.level)}
              />
            );
          })}
          <View style={styles.exam}>
            <ExamModeRow />
          </View>
        </View>
      </ScrollView>

      <View
        style={styles.footer}
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        {...tips.contentA11y}
      >
        <LinearGradient
          colors={[colors.backgroundClear, colors.background]}
          style={styles.fade}
          pointerEvents="none"
        />
        <View style={styles.actions}>
          <Pressable
            ref={studyRef}
            testID="study"
            onPress={() =>
              router.push({
                pathname: '/team/[squadId]/study',
                params: { squadId: squad.id, from: 'ladder' },
              })
            }
            accessibilityRole="button"
            style={({ pressed }) => [styles.study, pressed && { opacity: opacity.settled }]}
          >
            <BookGlyph color={colors.textPrimary} />
            <Text style={styles.studyLabel} maxFontSizeMultiplier={fontScaleCap.display}>
              {t.ladder.studySquad}
            </Text>
          </Pressable>
          {scores.length > 0 ? (
            <Pressable
              testID="difficulty-start-over"
              onPress={() => setStartOver(true)}
              accessibilityRole="button"
              accessibilityLabel={t.ladder.startOver(name)}
              style={({ pressed }) => [styles.eraser, pressed && { opacity: opacity.settled }]}
            >
              <EraserGlyph color={colors.textPrimary} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.updated} maxFontSizeMultiplier={fontScaleCap.display}>
          {t.ladder.updated(formatLastUpdated(squad.lastUpdated, t))}
        </Text>
      </View>

      {tips.open && (
        <TipsLayer
          tips={[
            { target: playRef, radius: radii.pill, ...t.tips.difficulty.start },
            { target: starRef, radius: radii.pill, ...t.tips.difficulty.star },
            { target: studyRef, radius: radii.pill, ...t.tips.difficulty.study },
          ]}
          onClose={tips.close}
          onSkip={tips.skip}
          onShown={tips.onShown}
          // The footer's padding already holds the inset, which the layer adds itself.
          bottomClear={Math.max(0, footerHeight - insets.bottom)}
          scrollBy={(dy) =>
            scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + dy), animated: false })
          }
        />
      )}

      <ResetSheet
        visible={startOver}
        onClose={() => setStartOver(false)}
        testID="start-over"
        title={t.reset.team.title(name)}
        line={t.reset.team.line(name)}
        clears={[
          {
            label: t.reset.team.bestScores,
            value: scores.map((s) => t.reset.team.levelScore(s.level, s.score)).join(' · '),
          },
        ]}
        keeps={starred ? t.reset.team.keepsStar : undefined}
        confirmLabel={t.reset.team.confirm}
        onConfirm={() => {
          track('progress.reset', { scope: 'team', squad: squad.id });
          resetSquad(squad.id);
          // The eraser goes with the scores, so the focus can't go back to it.
          titleFocus.refocus();
        }}
      />
    </View>
  );
}
