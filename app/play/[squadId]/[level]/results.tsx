import { CloseGlyph, RetryGlyph, ShareGlyph } from '@/components/ActionGlyphs';
import { EscuadraStrike } from '@/components/EscuadraStrike';
import { PhotoCredits } from '@/components/PhotoCredits';
import { PlayerCard } from '@/components/PlayerCard';
import { popIn, riseIn, slideIn } from '@/components/riseIn';
import { RoundStrip } from '@/components/RoundStrip';
import { ShareSheet } from '@/components/ShareSheet';
import { TipsLayer, type TipSpec } from '@/components/TipsLayer';
import { useTips } from '@/components/useTips';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { feedback } from '@/lib/haptics';
import { photoCreditRows, photoFor } from '@/lib/photos';
import type { Level } from '@/lib/questionEngine';
import {
  missedLine,
  resultActions,
  resultCopy,
  resultTier,
  type PrimaryAction,
  type ResultTier,
} from '@/lib/resultsView';
import { getPlayer, getRoster, getSquad } from '@/lib/squads';
import { bannerBands, stageVeil } from '@/lib/stageView';
import { askForReview } from '@/lib/storeReview';
import { track } from '@/lib/telemetry';
import { resultsTips } from '@/lib/tips';
import { selectMissed, selectScore, useSession, type QuestionResult } from '@/stores/session';
import { MARK_VIEWBOX, markGeometry } from '@/theme/brand';
import {
  borderWidths,
  durations,
  fontScaleCap,
  opacity,
  radii,
  resultsTimeline,
  sizes,
  spacing,
  spotlightMotion,
  stage,
  strikeTiming,
  typography,
} from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';
import type { TeamMarker } from '@/types/squad';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_LEVEL: Level = 3;

// Five circles to a row on a 10/10.
const ROSTER_COLUMNS = 5;

// The Results screen (spec §3), top to bottom: a top bar (close, the team and
// level, share), the score with its escuadra corner, the tier's title and
// verdict, the round strip, then the missed players as swipeable cards (or,
// on a 10/10, the ten players in circles), and the actions. The share button
// opens the share sheet (spec §4.1), a modal over the screen. Its motion is the
// celebration carve-out (`resultsTimeline`, spec §6): the strip fills and the
// score counts up with it, then the tier's beat, then the actions.
export default function Results() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const reduced = useReducedMotion();
  const { squadId, level: levelParam } = useLocalSearchParams<{ squadId: string; level: string }>();
  const level = Number(levelParam) as Level;
  const session = useSession();
  const squad = getSquad(squadId);
  const score = selectScore(session.results);
  const tier = resultTier(score.correct, score.attempted);
  // Sharing is not a next step in the study loop, so it sits in the top bar,
  // apart from the actions, and opens a sheet rather than leaving the screen.
  const [sharing, setSharing] = useState(false);
  // The photo-credits sheet, and a credit's in-app browser opened from it.
  const [crediting, setCrediting] = useState(false);

  // How to play (#184): once, after the first round ever, when the
  // celebration is over. The misses' cards, then the actions, scrolled to on a
  // short screen. A tip with nothing to point at is left out, and with both
  // out the layer never opens, so Results keeps its tips for next time.
  const [celebrated, setCelebrated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setCelebrated(true), resultsTimeline.tips);
    return () => clearTimeout(timer);
  }, []);
  // Not behind a sheet opened before then: the tips wait for it to close.
  const tips = useTips('results', celebrated && !sharing && !crediting);
  const missed = selectMissed(session.results);
  const tipKeys = resultsTips({
    missed: missed.length,
    passed: tier !== 'fail',
    hasNextLevel: level < MAX_LEVEL,
  });
  const showTips = tips.open && tipKeys.length > 0;
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const missedRef = useRef<View>(null);
  const actionsRef = useRef<View>(null);

  // After an a la escuadra round, once the celebration is over, perhaps ask
  // for a store rating (#57). Nothing here sets state, so the screen never
  // waits on it or re-renders for it. The wait calls the ask off if the
  // screen is left or covered (Study is pushed over it), if the share sheet
  // or the photo-credits sheet opens, or while the How to play tips show.
  // Coming back, or closing the sheet or the tips, starts the wait again.
  // lib/storeReview.ts also never asks while the app is in the background.
  const flawless =
    tier === 'excellent' && !!squad && session.squadId === squadId && session.level === level;
  const earlierRounds = session.earlierRounds;
  useFocusEffect(
    useCallback(() => {
      if (!flawless || sharing || crediting || showTips) return;
      let shown = true;
      const timer = setTimeout(
        () => askForReview({ flawless, earlierRounds }, () => shown),
        resultsTimeline.reviewPrompt,
      );
      return () => {
        shown = false;
        clearTimeout(timer);
      };
    }, [flawless, earlierRounds, sharing, crediting, showTips]),
  );

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: {
      flexGrow: 1,
      paddingTop: insets.top,
      paddingBottom: insets.bottom + spacing.lg,
    },
    topBar: {
      height: sizes.topBar.height,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
    },
    close: {
      width: sizes.minTapTarget,
      height: sizes.minTapTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    context: {
      ...typography.rowTitle,
      flex: 1,
      minWidth: 0,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    share: {
      width: sizes.minTapTarget,
      height: sizes.minTapTarget,
      borderRadius: sizes.minTapTarget / 2,
      borderWidth: borderWidths.thick,
      borderColor: colors.border,
      backgroundColor: colors.tile,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.xs },
    title: {
      ...typography.titleDisplay,
      color: tier === 'excellent' ? colors.success : colors.textPrimary,
    },
    verdict: { ...typography.secondary, color: colors.textSecondary },
    strip: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    spacer: { flex: 1, minHeight: spacing.lg },
    actions: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    // The main button and the Study row, without the credits: the second tip's target.
    actionsButtons: { gap: spacing.sm },
    cta: {
      minHeight: sizes.cta.normal,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.ctaBg,
    },
    ctaText: { ...typography.ctaLabel, color: colors.ctaText },
    row: { flexDirection: 'row', gap: spacing.sm },
    outline: {
      flex: 1,
      minHeight: sizes.cta.compact,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { ...typography.ctaLabel, color: colors.textPrimary },
    retry: {
      width: sizes.cta.compact,
      height: sizes.cta.compact,
      borderRadius: sizes.cta.compact / 2,
      borderWidth: borderWidths.thick,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  if (!squad || session.squadId !== squadId || session.level !== level) return null;

  const teamName = squadDisplayName(squad, language);
  const copy = resultCopy({ tier, level, teamName, season: squad.season }, t);
  const actions = resultActions(tier !== 'fail', level < MAX_LEVEL);
  const strip = session.results.map((r) => ({
    no: r.question.memberNo,
    correct: r.correct === true,
  }));
  const photoCredits = photoCreditRows(session.results, (id) => photoFor(getPlayer(id)));
  // The tier's beat (spec §6): a fail's title and cards come at once the strip
  // has mostly filled; a pass waits for the strip, then the strike.
  const beat = tier === 'fail' ? resultsTimeline.failBeat : resultsTimeline.passBeat;
  const actionAt = (k: number) =>
    beat + resultsTimeline.actionsAfter + k * resultsTimeline.actionsStagger;

  const retry = (atLevel: Level) => {
    const roster = getRoster(squadId);
    session.startRound(squad, roster, atLevel);
    router.replace({
      pathname: '/play/[squadId]/[level]',
      params: { squadId, level: String(atLevel) },
    });
  };

  const chooseDifferentTeam = () => {
    session.reset();
    router.dismissTo('/team-picker');
  };

  const studySquad = () => {
    router.push({ pathname: '/team/[squadId]/study', params: { squadId } });
  };

  const primary: Record<PrimaryAction, { label: string; onPress: () => void }> = {
    retry: { label: t.results.retry, onPress: () => retry(level) },
    nextLevel: {
      label: t.results.playLevel(level + 1),
      onPress: () => retry((level + 1) as Level),
    },
    chooseTeam: { label: t.results.chooseTeam, onPress: chooseDifferentTeam },
  };
  const main = primary[actions.primary];
  const tipSpecs: TipSpec[] = tipKeys.map((key) => ({
    target: key === 'missed' ? missedRef : actionsRef,
    radius: radii.xl,
    ...t.tips.results[key],
  }));

  return (
    <>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        {...(showTips ? tips.contentA11y : {})}
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.topBar}>
          <Pressable
            testID="results-close"
            onPress={chooseDifferentTeam}
            accessibilityRole="button"
            accessibilityLabel={t.results.close}
            style={({ pressed }) => [styles.close, pressed && { opacity: opacity.settled }]}
          >
            <CloseGlyph color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.context} numberOfLines={1}>
            {[teamName, t.common.level(level)].join(' · ')}
          </Text>
          <Pressable
            testID="results-share"
            onPress={() => setSharing(true)}
            accessibilityRole="button"
            accessibilityLabel={t.share.title}
            style={({ pressed }) => [styles.share, pressed && { opacity: opacity.settled }]}
          >
            <ShareGlyph color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.scoreBlock}>
          <Score
            correct={score.correct}
            attempted={score.attempted}
            outcomes={strip.map((s) => s.correct)}
            tier={tier}
          />
          <Animated.Text
            entering={riseIn(reduced, spotlightMotion.numberRise, resultsTimeline.rise, beat)}
            style={styles.title}
            maxFontSizeMultiplier={fontScaleCap.display}
            accessibilityRole="header"
          >
            {copy.title}
          </Animated.Text>
          <Animated.Text
            entering={riseIn(
              reduced,
              spotlightMotion.numberRise,
              resultsTimeline.rise,
              beat + resultsTimeline.actionsStagger,
            )}
            style={styles.verdict}
          >
            {copy.verdict}
          </Animated.Text>
        </View>

        <View style={styles.strip}>
          <RoundStrip items={strip} />
        </View>

        {missed.length > 0 ? (
          <MissedCards ref={missedRef} missed={missed} marker={squad.marker} beat={beat} />
        ) : null}
        {tier === 'excellent' ? <Roster results={session.results} marker={squad.marker} /> : null}

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <View ref={actionsRef} collapsable={false} style={styles.actionsButtons}>
            <Animated.View
              entering={riseIn(
                reduced,
                spotlightMotion.numberRise,
                resultsTimeline.rise,
                actionAt(0),
              )}
            >
              <Pressable
                testID="results-primary"
                onPress={main.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cta, pressed && { opacity: opacity.settled }]}
              >
                <Text style={styles.ctaText}>{main.label}</Text>
              </Pressable>
            </Animated.View>
            <Animated.View
              entering={riseIn(
                reduced,
                spotlightMotion.numberRise,
                resultsTimeline.rise,
                actionAt(1),
              )}
              style={styles.row}
            >
              <Pressable
                testID="results-study"
                onPress={studySquad}
                accessibilityRole="button"
                style={({ pressed }) => [styles.outline, pressed && { opacity: opacity.settled }]}
              >
                <Text style={styles.outlineText}>{t.results.studySquad}</Text>
              </Pressable>
              {actions.retryIcon ? (
                <Pressable
                  testID="results-retry"
                  onPress={() => retry(level)}
                  accessibilityRole="button"
                  accessibilityLabel={t.results.retry}
                  style={({ pressed }) => [styles.retry, pressed && { opacity: opacity.settled }]}
                >
                  <RetryGlyph color={colors.textPrimary} />
                </Pressable>
              ) : null}
            </Animated.View>
          </View>
          <Animated.View
            entering={riseIn(
              reduced,
              spotlightMotion.numberRise,
              resultsTimeline.rise,
              actionAt(2),
            )}
          >
            <PhotoCredits rows={photoCredits} onOpenChange={setCrediting} />
          </Animated.View>
        </View>
      </ScrollView>
      <ShareSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        card={{
          teamName,
          season: squad.season,
          level,
          items: strip,
          marker: squad.marker,
        }}
        text={{ teamName, level, outcomes: session.results.map((r) => r.correct) }}
        onShared={(format) => track('result.shared', { level, score: score.correct, format })}
      />
      {/* Last, so the layer covers the whole screen. */}
      {showTips && (
        <TipsLayer
          tips={tipSpecs}
          onClose={tips.close}
          onSkip={tips.skip}
          onShown={tips.onShown}
          scrollBy={(dy) =>
            scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + dy), animated: false })
          }
        />
      )}
    </>
  );
}

// The score, counting up as the strip fills, with the escuadra corner at its
// top right: two grey bars on a fail; on a pass, the strike, mounted at the
// pass beat. A 10/10's score is green and pops as the strike starts. The
// haptic plays as the ball lands (spec §7); a fail plays none.
function Score({
  correct,
  attempted,
  outcomes,
  tier,
}: {
  correct: number;
  attempted: number;
  outcomes: boolean[];
  tier: ResultTier;
}) {
  const colors = useThemeColors();
  const t = useT();
  const reduced = useReducedMotion();
  const passed = tier !== 'fail';
  const flawless = tier === 'excellent';
  const timing = flawless ? strikeTiming.excellent : strikeTiming.passed;
  // Reduce Motion: the final score and the strike's resting mark, at once.
  // The strike settles on its own because `EscuadraStrike`'s `withTiming`,
  // `withDelay` and `withSequence` keep Reanimated's default
  // `ReduceMotion.System`; a `reduceMotion: ReduceMotion.Never` added there
  // would break this.
  const [shown, setShown] = useState(reduced ? correct : 0);
  const [struck, setStruck] = useState(passed && reduced);
  const pop = useSharedValue(1);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduced) {
      // One step per green segment, as it finishes filling.
      let count = 0;
      outcomes.forEach((ok, i) => {
        if (!ok) return;
        count += 1;
        const value = count;
        timers.push(
          setTimeout(
            () => setShown(value),
            i * resultsTimeline.segmentStagger + resultsTimeline.segmentFill,
          ),
        );
      });
      if (passed) timers.push(setTimeout(() => setStruck(true), resultsTimeline.passBeat));
      if (flawless) {
        pop.value = withDelay(
          resultsTimeline.passBeat,
          withSequence(
            withTiming(spotlightMotion.streakPopScale, { duration: durations.pop }),
            withTiming(1, { duration: durations.popSettle }),
          ),
        );
      }
    }
    if (passed) {
      const lands = reduced ? 0 : resultsTimeline.passBeat + timing.ballDelay + timing.ballDuration;
      timers.push(setTimeout(() => feedback(flawless ? 'escuadra' : 'passed'), lands));
    }
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimation(pop);
    };
    // Once, on mount: the round is over, so nothing here changes while the
    // screen shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const corner = sizes.corner.results;
  // Sized so the strike's crossbar is `corner.arm` long, and placed so the
  // crossbar's top right meets the row's top right, where the bars sit on a
  // fail.
  const { crossbar } = markGeometry;
  const strikeSize = (corner.arm * MARK_VIEWBOX) / crossbar.w;
  const unit = strikeSize / MARK_VIEWBOX;
  const styles = StyleSheet.create({
    row: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'baseline',
      paddingRight: corner.arm + spacing.md,
    },
    count: { ...typography.scoreDisplay, color: flawless ? colors.success : colors.textPrimary },
    tail: { ...typography.scoreTail, color: colors.textMuted },
    crossbar: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: corner.arm,
      height: corner.bar,
      backgroundColor: colors.textMuted,
    },
    post: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: corner.bar,
      height: corner.arm,
      backgroundColor: colors.textMuted,
    },
    strike: {
      position: 'absolute',
      top: -crossbar.y * unit,
      right: -(MARK_VIEWBOX - crossbar.x - crossbar.w) * unit,
    },
  });

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={t.common.scoreSpoken(correct, attempted)}
    >
      <Animated.Text style={[styles.count, popStyle]} maxFontSizeMultiplier={fontScaleCap.display}>
        {shown}
      </Animated.Text>
      <Text style={styles.tail} maxFontSizeMultiplier={fontScaleCap.display}>
        /{attempted}
      </Text>
      {passed ? (
        struck ? (
          <View style={styles.strike} pointerEvents="none">
            <EscuadraStrike
              size={strikeSize}
              color={flawless ? colors.success : colors.accentLine}
              ballColor={colors.success}
              timing={timing}
            />
          </View>
        ) : null
      ) : (
        <>
          <View style={styles.crossbar} />
          <View style={styles.post} />
        </>
      )}
    </View>
  );
}

// The missed players as a row of cards that snaps one card at a time. Each
// slides in from the right at the tier's beat, `cardStagger` apart. `ref` is
// the section's, the How to play tip's target.
function MissedCards({
  ref,
  missed,
  marker,
  beat,
}: {
  ref?: Ref<View>;
  missed: QuestionResult[];
  marker: TeamMarker;
  beat: number;
}) {
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const reduced = useReducedMotion();
  const card = sizes.playerCard.results;
  const styles = StyleSheet.create({
    section: { paddingTop: spacing.xl, gap: spacing.sm },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    label: { ...typography.captionEyebrow, color: colors.error },
    hint: { ...typography.secondarySmall, color: colors.textMuted },
    list: { paddingHorizontal: spacing.lg },
  });

  return (
    <View ref={ref} collapsable={false} style={styles.section}>
      <Animated.View
        entering={riseIn(reduced, spotlightMotion.rise, resultsTimeline.rise, beat)}
        style={styles.labelRow}
      >
        <Text style={styles.label}>{t.results.missedCount(missed.length)}</Text>
        {missed.length > 2 ? <Text style={styles.hint}>{t.results.swipeForAll}</Text> : null}
      </Animated.View>
      <FlatList
        horizontal
        data={missed}
        keyExtractor={(r) => r.question.playerId}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={slideIn(
              reduced,
              spotlightMotion.slide,
              resultsTimeline.rise,
              beat + index * resultsTimeline.cardStagger,
            )}
          >
            <PlayerCard
              width={card.width}
              height={card.height}
              shirtNumber={item.question.memberNo}
              name={item.question.playerName}
              line={missedLine(item, language, t)}
              photo={photoFor(getPlayer(item.question.playerId))}
              marker={marker}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={CardGap}
        snapToInterval={card.width + spacing.sm}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function CardGap() {
  return <View style={{ width: spacing.sm }} />;
}

// A 10/10: the ten players in circles, five to a row, each popping in from the
// pass beat, `circleStagger` apart. A circle is the player's photo over the
// team's bands and shirt number, so a photo that is loading, failed or offline
// (spec §13) leaves the bands and number.
function Roster({ results, marker }: { results: QuestionResult[]; marker: TeamMarker }) {
  const colors = useThemeColors();
  const t = useT();
  const reduced = useReducedMotion();
  const styles = StyleSheet.create({
    section: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.sm },
    label: { ...typography.captionEyebrow, color: colors.successText },
    grid: { gap: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.xs },
    cell: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.xxs },
    name: { ...typography.rosterName, color: colors.textSecondary },
  });
  const rows: (QuestionResult | null)[][] = [];
  for (let i = 0; i < results.length; i += ROSTER_COLUMNS) {
    const row: (QuestionResult | null)[] = results.slice(i, i + ROSTER_COLUMNS);
    // Pad a short last row, so its circles stay in their columns.
    while (row.length < ROSTER_COLUMNS) row.push(null);
    rows.push(row);
  }

  return (
    <View style={styles.section}>
      <Animated.View
        entering={riseIn(
          reduced,
          spotlightMotion.rise,
          resultsTimeline.rise,
          resultsTimeline.passBeat,
        )}
      >
        <Text style={styles.label}>{t.results.nothingMissed(results.length)}</Text>
      </Animated.View>
      <View style={styles.grid}>
        {rows.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((result, c) => {
              if (!result) return <View key={c} style={styles.cell} />;
              const i = r * ROSTER_COLUMNS + c;
              const { playerId, playerName, memberNo } = result.question;
              return (
                <Animated.View
                  key={playerId}
                  entering={popIn(
                    reduced,
                    spotlightMotion.rosterInScale,
                    resultsTimeline.rise,
                    resultsTimeline.passBeat + i * resultsTimeline.circleStagger,
                  )}
                  style={styles.cell}
                  accessible
                  accessibilityLabel={`${memberNo}, ${playerName}`}
                >
                  <RosterCircle
                    shirtNumber={memberNo}
                    photoUrl={photoFor(getPlayer(playerId))?.url ?? null}
                    marker={marker}
                  />
                  <Text style={styles.name} numberOfLines={1}>
                    {shortName(playerName)}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function RosterCircle({
  shirtNumber,
  photoUrl,
  marker,
}: {
  shirtNumber: number;
  photoUrl: string | null;
  marker: TeamMarker;
}) {
  const colors = useThemeColors();
  const themeName = useThemeName();
  const bands = bannerBands(marker);
  const size = sizes.rosterAvatar;
  const styles = StyleSheet.create({
    circle: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: borderWidths.emphasis,
      borderColor: colors.success,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bands: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
    veil: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.veilInk,
      opacity: stageVeil(bands, themeName),
    },
    number: { ...typography.badgeNumber, color: colors.onPhoto },
  });

  return (
    <View style={styles.circle}>
      <View style={styles.bands}>
        {bands.map((band, i) => (
          <View key={i} style={{ flex: band.weight, backgroundColor: band.color }} />
        ))}
      </View>
      <View style={styles.veil} />
      <Text style={styles.number} maxFontSizeMultiplier={fontScaleCap.display}>
        {shirtNumber}
      </Text>
      {photoUrl ? (
        <Image
          key={photoUrl}
          recyclingKey={photoUrl}
          source={{ uri: photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={stage.focal}
          transition={durations.reveal}
          cachePolicy="disk"
        />
      ) : null}
    </View>
  );
}

/** The name under a circle: its last word ("Ferran Torres" → "Torres"). */
function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  return words[words.length - 1] ?? name;
}
