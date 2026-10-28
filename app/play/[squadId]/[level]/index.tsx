import { AnswerGrid } from '@/components/AnswerGrid';
import { EscuadraCorner } from '@/components/EscuadraCorner';
import { GlassCloseButton } from '@/components/GlassCloseButton';
import { QuestionFooter } from '@/components/QuestionFooter';
import { riseIn } from '@/components/riseIn';
import { RoundProgress } from '@/components/RoundProgress';
import { ShotOverlay } from '@/components/ShotOverlay';
import { SlotChip } from '@/components/SlotChip';
import { SpotlightStage } from '@/components/SpotlightStage';
import { StreakChip } from '@/components/StreakChip';
import { TeamMarker } from '@/components/TeamMarker';
import { TipsLayer } from '@/components/TipsLayer';
import { useAppActive } from '@/hooks/useAppActive';
import { useFocusHandOff } from '@/hooks/useFocusHandOff';
import { useRoundClock } from '@/hooks/useRoundClock';
import { useScreenReader } from '@/hooks/useScreenReader';
import { useShot } from '@/hooks/useShot';
import { useTips } from '@/hooks/useTips';
import { useTitleFocus } from '@/hooks/useTitleFocus';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import { feedback } from '@/lib/haptics';
import { photoFor, roundPhotoUrls } from '@/lib/photos';
import type { Level } from '@/lib/questionEngine';
import { isFlawless } from '@/lib/resultsView';
import { leftRound, missesByPart, previousBestValue } from '@/lib/roundStats';
import {
  answerLayout,
  drawsRound,
  footerMode,
  isCompact,
  partCounter,
  progressOutcomes,
  promptText,
  slotStates,
  startsNewRound,
  streak,
  streakMilestone,
} from '@/lib/roundView';
import { getPlayer, getRoster, getSquad } from '@/lib/squads';
import { withAlpha } from '@/lib/stageView';
import { scoreKey } from '@/lib/scoring';
import { track } from '@/lib/telemetry';
import { roundSeconds } from '@/lib/telemetryEvents';
import type { TipScreen } from '@/lib/tips';
import { useProgress } from '@/stores/progress';
import { selectScore, useSession } from '@/stores/session';
import {
  borderWidths,
  durations,
  fontScaleCap,
  radii,
  sizes,
  spacing,
  spotlightMotion,
  stage,
  stageGradients,
  typography,
} from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInstance,
  type ViewInstance,
  type ScrollViewInstance,
} from 'react-native';
import Animated, { FadeOut, Keyframe } from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/hooks/useReduceMotion';

/** Usage statistics (#221): a round still in progress, about to be thrown away. */
function trackLeftRound(): void {
  const left = leftRound(useSession.getState());
  const squad = left ? getSquad(left.squad) : undefined;
  if (!left || !squad) return;
  track('round.left', {
    squad: left.squad,
    kind: squad.kind,
    level: left.level,
    question: left.question,
    score: left.score,
    seconds: roundSeconds(left.activeMs),
  });
}

// The Spotlight question screen (spec §2). Its layers, back to front:
// - the photo stage;
// - the stage gradient over the whole window;
// - a column: progress, top bar, and, in a scroll, the hero (number, corner,
//   slots), the prompt, the answers and the footer;
// - the shot (the ball and its trail), over everything (#129).
// The scroll is bottom-aligned, so it never moves when everything fits (every
// level at 360×640). It only scrolls at large text sizes (SCREENS.md
// invariant 6).
export default function Question() {
  const insets = useSafeAreaInsets();
  // The provider's frame, not `useWindowDimensions`: on edge-to-edge Android
  // the window's treatment of the system bars varies by OS version.
  const frame = useSafeAreaFrame();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const themeName = useThemeName();
  const reduced = useReduceMotion();
  const screenReader = useScreenReader();
  const {
    squadId,
    level: levelParam,
    seed: seedParam,
  } = useLocalSearchParams<{ squadId: string; level: string; seed?: string }>();
  const level = Number(levelParam) as Level;
  // Optional `?seed=` makes a round reproducible, for the screenshot capture.
  const seed = seedParam === undefined ? undefined : Number(seedParam);
  const compact = isCompact(frame.height - insets.top - insets.bottom);
  const numberType = compact ? typography.shirtNumberCompact : typography.shirtNumber;
  // The number's design box: its line box less the margin that offsets the
  // clip-proof line height (see the Archivo block in theme/tokens.ts).
  const numberBox = numberType.lineHeight + 2 * numberType.marginVertical;
  const stageHeight = Math.round(
    frame.height * (compact ? sizes.stage.ratioCompact : sizes.stage.ratio),
  );

  const session = useSession();
  const setLastPlayed = useProgress((s) => s.setLastPlayed);
  const recordScore = useProgress((s) => s.recordScore);
  const squad = getSquad(squadId);
  // The round this screen opened on, when it starts a new one below: never
  // drawn (`drawsRound`).
  const [replaced] = useState(() => {
    const opened = useSession.getState();
    return startsNewRound(opened, squadId, level) ? opened.questions : null;
  });

  useEffect(() => {
    if (!squad) return;
    if (startsNewRound(session, squadId, level)) {
      // A round still in progress for another squad or level is thrown away here.
      trackLeftRound();
      session.startRound(
        squad,
        getRoster(squadId),
        level,
        Number.isFinite(seed) ? seed : undefined,
      );
      track('round.started', { squad: squad.id, kind: squad.kind, level, source: 'ladder' });
    }
    setLastPlayed(squadId, level);
    // Only when the route target changes: starting a round mutates `session`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId, level, seedParam]);

  // The phase this effect last saw. A round is over when it turns `complete`
  // while the screen is up, never on mount: opened on the last round's
  // `complete` session, the screen starts a new round above, and this effect's
  // first run still sees the stale phase (#222).
  const seenPhase = useRef(session.phase);
  useEffect(() => {
    const previous = seenPhase.current;
    seenPhase.current = session.phase;
    if (previous !== 'playing' || session.phase !== 'complete') return;
    if (session.squadId === squadId && session.level === level) {
      const score = selectScore(session.results);
      // Before `recordScore`, which keeps a best score for every completed
      // round, even a 0/10: any key now means an earlier round (#57), and the
      // best this round had to beat (#221).
      const { bestScores } = useProgress.getState();
      session.setEarlierRounds(Object.keys(bestScores).length > 0);
      if (squad) {
        const previousBest = previousBestValue(bestScores[scoreKey(squadId, level)]);
        recordScore(squadId, level, score.correct, squad.lastUpdated);
        // The clock stopped in this same commit: `complete` turned it off, and
        // React runs every effect's cleanup before any effect's setup (React 17+).
        track('round.completed', {
          squad: squad.id,
          kind: squad.kind,
          level,
          score: score.correct,
          aLaEscuadra: isFlawless(score.correct, score.attempted),
          previousBest,
          ...missesByPart(session.results, level),
          seconds: roundSeconds(useSession.getState().activeMs),
        });
      }
      router.replace({
        pathname: '/play/[squadId]/[level]/results',
        params: { squadId, level: levelParam },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase]);

  // A round's photos are fetched when it starts (spec §9), so no question
  // waits on its photo. The result is ignored: it is false as soon as one
  // fails, and a failure only means the team colours show a moment longer.
  useEffect(() => {
    if (session.squadId !== squadId || session.questions.length === 0) return;
    const urls = roundPhotoUrls(session.questions, getPlayer);
    if (urls.length > 0) Image.prefetch(urls, { cachePolicy: 'disk' }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.questions]);

  const verdict = session.results[session.currentIndex]?.correct ?? null;

  // A right answer moves on after `durations.autoAdvance`; a miss waits for
  // its button; with a screen reader on nothing moves on by itself (§2.4).
  useEffect(() => {
    if (verdict !== true || screenReader) return;
    const timer = setTimeout(() => useSession.getState().advanceQuestion(), durations.autoAdvance);
    return () => clearTimeout(timer);
  }, [verdict, screenReader, session.currentIndex]);

  const currentStreak = streak(session.results, session.currentIndex);
  const previousStreak = useRef(currentStreak);
  useEffect(() => {
    if (streakMilestone(previousStreak.current, currentStreak)) feedback('streak');
    previousStreak.current = currentStreak;
  }, [currentStreak]);

  const { live, clock, overlayRef, cornerRef, fire } = useShot(session.currentIndex);

  // How to play (#184): once per level, on this route's first question, before
  // any part of it is answered. The catcher takes every tap, so nothing is
  // answered behind the tips, and auto-advance only follows an answer.
  const firstQuestion =
    session.phase === 'playing' &&
    session.squadId === squadId &&
    session.level === level &&
    session.currentIndex === 0 &&
    session.currentPartIndex === 0 &&
    session.results[0]?.parts.every((p) => p === null) === true;
  const tips = useTips(`question-${level}` as TipScreen, firstQuestion);
  // The round's active time (#221): only while this screen is the one in front,
  // the app is active and no tip covers the question.
  const focused = useIsFocused();
  const appActive = useAppActive();
  const roundClock = useRoundClock(
    focused &&
      appActive &&
      !tips.open &&
      session.phase === 'playing' &&
      session.squadId === squadId &&
      session.level === level,
  );
  const heroRef = useRef<ViewInstance>(null);
  const slotsRef = useRef<ViewInstance>(null);
  const answersRef = useRef<ViewInstance>(null);
  // The prompt is the round's title: a screen reader starts on the question.
  const promptRef = useRef<TextInstance>(null);
  // VoiceOver moves to the first element it can see once the screen has opened.
  // So on iOS everything but the prompt (above it and below it) is out of its
  // order while the screen settles, and the round starts on the question
  // (#187).
  const titleFocus = useTitleFocus(promptRef, !tips.open);
  // A later question or part starts on its prompt too: Next and a part's tile
  // go with the press, so VoiceOver waits on the score, which stays, and moves
  // to the prompt once the next question or part has risen in (#226).
  const scoreRef = useRef<ViewInstance>(null);
  const handOff = useFocusHandOff(
    promptRef,
    scoreRef,
    `${session.currentIndex}:${session.currentPartIndex}`,
  );
  // At large text sizes the scroll overflows and opens at the top, with the
  // answers below the fold: the layer scrolls a tip's target into view.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    column: { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom },
    topBar: {
      height: sizes.topBar.height,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    team: { flex: 1, minWidth: 0, gap: spacing.xxs },
    teamName: { ...typography.topBarTeam, color: colors.onPhoto },
    teamSub: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    level: { ...typography.filterLabel, color: colors.onPhotoMuted },
    scorePill: {
      height: sizes.topBar.pill,
      minWidth: sizes.topBar.pillMinWidth,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.glassLine,
      backgroundColor: colors.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    score: { ...typography.statMonoSmall, color: colors.onPhoto },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: spacing.xxs },
    // The hero carries its own ground (`stage.heroBacking`), so the number and
    // chips stay legible over any photo wherever the content puts them: clear
    // to `top` over `rise`, then to solid over the number, solid behind the
    // chips. The chips start one number line and the hero's gap below its
    // top; read from the tokens, not measured. Larger text only moves them
    // further onto solid ground.
    // The rise is a flex item: it takes free space above the hero, at most
    // `rise`, so it always starts clear. When less is free (two rows of slots
    // at 360×600), the scroll's top edge would otherwise cut it mid-fade, a
    // seam under the top bar. It never adds height.
    backingRise: { flexGrow: 1, maxHeight: stage.heroBacking.rise },
    heroFrame: { position: 'relative' },
    backingNumber: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: numberBox + spacing.sm,
    },
    backingChips: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: numberBox + spacing.sm,
      bottom: 0,
      backgroundColor: colors.background,
    },
    hero: { paddingHorizontal: spacing.lg },
    // The number and the slots, in one view for level 1's first tip to ring;
    // as wide as its content, so the ring hugs the chips when they fit a line.
    heroContent: { alignSelf: 'flex-start', gap: spacing.sm },
    // Under the hero, the prompt, answers and footer sit on solid ground.
    ground: { backgroundColor: colors.background },
    numberWrap: {
      alignSelf: 'flex-start',
      paddingRight: sizes.corner.question.arm + sizes.corner.question.bar,
    },
    number: { ...numberType, color: colors.onStage },
    slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    promptRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    counter: { ...typography.statMonoTiny, color: colors.onStageMuted },
    // The grid's inset, here rather than in the grid, so level 1's second tip
    // rings the tiles and not the screen's edges.
    answers: { marginHorizontal: spacing.md },
  });

  if (!squad || !drawsRound(session, squadId, level, replaced)) return null;

  const question = session.questions[session.currentIndex];
  const result = session.results[session.currentIndex];
  if (!question || !result) return null;
  const part = question.parts[session.currentPartIndex];
  if (!part) return null;

  const score = selectScore(session.results);
  const photo = photoFor(getPlayer(question.playerId));
  const slots = slotStates(question, result, session.currentPartIndex, squad.kind, level);
  const answeredIndex = result.parts[session.currentPartIndex]?.pickedIndex ?? null;
  const counter = partCounter(question, session.currentPartIndex, t);
  const prompt = promptText(part, question.memberNo, verdict, t);
  const promptColor =
    verdict === true ? colors.success : verdict === false ? colors.error : colors.onStage;

  // Leave throws the round away, unlike Back, which can resume it (#221).
  const exit = () => {
    roundClock.stop();
    trackLeftRound();
    session.reset();
    router.back();
  };
  const next = () => handOff(() => session.advanceQuestion());
  const backingTop = withAlpha(colors.background, stage.heroBacking.top[themeName]);

  const heroEntering = riseIn(reduced, spotlightMotion.numberRise, durations.transition);
  const heroExiting = reduced
    ? FadeOut.duration(durations.transition)
    : new Keyframe({
        0: { opacity: 1, transform: [{ translateX: 0 }] },
        100: { opacity: 0, transform: [{ translateX: -spotlightMotion.slide }] },
      }).duration(durations.transition);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SpotlightStage
        height={stageHeight}
        photo={photo}
        marker={squad.marker}
        dimmed={verdict === false}
      />
      <LinearGradient
        colors={stageGradients[themeName].colors}
        locations={stageGradients[themeName].locations}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.column} {...tips.contentA11y}>
        <View {...titleFocus.chrome}>
          <RoundProgress
            outcomes={progressOutcomes(session.results, session.currentIndex)}
            currentIndex={session.currentIndex}
          />
        </View>
        <View style={styles.topBar} {...titleFocus.chrome}>
          <GlassCloseButton label={t.round.leave} onPress={exit} />
          <View style={styles.team}>
            <Text
              style={styles.teamName}
              numberOfLines={1}
              maxFontSizeMultiplier={fontScaleCap.display}
            >
              {squadDisplayName(squad, language)}
            </Text>
            <View style={styles.teamSub}>
              <TeamMarker marker={squad.marker} variant="banner" />
              <Text style={styles.level} maxFontSizeMultiplier={fontScaleCap.display}>
                {t.common.level(level)}
              </Text>
            </View>
          </View>
          {currentStreak >= 2 ? <StreakChip count={currentStreak} /> : null}
          <View
            ref={scoreRef}
            style={styles.scorePill}
            accessible
            accessibilityLabel={t.common.scoreSpoken(score.correct, score.attempted)}
          >
            <Text style={styles.score} maxFontSizeMultiplier={fontScaleCap.display}>
              {score.correct}/{score.attempted}
            </Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          onScroll={(e) => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          {/* Not keyed: the backing stays put while the hero changes. */}
          <LinearGradient
            colors={[withAlpha(colors.background, 0), backingTop]}
            style={styles.backingRise}
            pointerEvents="none"
          />
          <View style={styles.heroFrame} {...titleFocus.chrome}>
            <LinearGradient
              colors={[backingTop, colors.background]}
              style={styles.backingNumber}
              pointerEvents="none"
            />
            <View style={styles.backingChips} pointerEvents="none" />
            <Animated.View
              key={session.currentIndex}
              entering={heroEntering}
              exiting={heroExiting}
              style={styles.hero}
            >
              <View ref={heroRef} collapsable={false} style={styles.heroContent}>
                <View style={styles.numberWrap}>
                  <Text
                    style={styles.number}
                    maxFontSizeMultiplier={fontScaleCap.display}
                    accessibilityLabel={t.round.shirtNumber(question.memberNo)}
                  >
                    {question.memberNo}
                  </Text>
                  <EscuadraCorner
                    ref={cornerRef}
                    question={session.currentIndex}
                    live={live}
                    clock={clock}
                  />
                </View>
                <View ref={slotsRef} collapsable={false} style={styles.slots}>
                  {slots.map((slot) => (
                    <SlotChip key={slot.key} slot={slot} />
                  ))}
                </View>
              </View>
            </Animated.View>
          </View>

          <View style={styles.ground}>
            <View style={styles.promptRow}>
              <Text
                ref={promptRef}
                style={[
                  compact ? typography.promptCompact : typography.prompt,
                  { color: promptColor },
                ]}
                maxFontSizeMultiplier={fontScaleCap.display}
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                // In its own case: Android hands TalkBack the capitals the style
                // draws, and a voice spells "WHO" out (#187).
                accessibilityLabel={prompt}
              >
                {prompt}
              </Text>
              {counter ? (
                <Text style={styles.counter} accessibilityLabel={counter.spoken}>
                  {counter.label}
                </Text>
              ) : null}
            </View>

            <View
              ref={answersRef}
              collapsable={false}
              style={styles.answers}
              {...titleFocus.chrome}
            >
              <AnswerGrid
                part={part}
                gridKey={`${session.currentIndex}:${session.currentPartIndex}`}
                answeredIndex={answeredIndex}
                layout={answerLayout(part, compact)}
                stagger={
                  session.currentPartIndex === 0 ? durations.tileStagger : durations.partStagger
                }
                onAnswer={(pickedIndex, tap) => {
                  const right = pickedIndex === part.correctIndex;
                  const lastPart = session.currentPartIndex === question.parts.length - 1;
                  // `answerPart` scores the part and moves to the next in one
                  // update, so this grid unmounts before any tile sees its
                  // verdict. A right part that is not the last gets its haptic
                  // here, and hands VoiceOver off its tile; the last part's
                  // tile plays its own.
                  const movesOn = right && !lastPart;
                  if (movesOn) feedback('correct');
                  // The shot only when the question is decided: the last part
                  // right (a goal), or any part wrong (a miss).
                  if (!movesOn) fire(right ? 'goal' : 'miss', tap);
                  handOff(() => session.answerPart(pickedIndex), movesOn);
                }}
              />
            </View>

            <View {...titleFocus.chrome}>
              <QuestionFooter
                mode={footerMode(verdict, screenReader)}
                compact={compact}
                last={session.currentIndex === session.questions.length - 1}
                onNext={next}
                credit={photo}
              />
            </View>
          </View>
        </ScrollView>
      </View>
      {/* Over everything, and never in the way of a tap. */}
      <ShotOverlay ref={overlayRef} question={session.currentIndex} live={live} clock={clock} />
      {tips.open && (
        <TipsLayer
          // Each ring takes the corners of what it rings, the chips' and the tiles'
          // `radii.lg`, so it clears them by the same gap all round (#187).
          tips={
            level === 1
              ? [
                  {
                    target: heroRef,
                    radius: radii.lg,
                    heading: t.tips.question.clues.heading,
                    body:
                      squad.kind === 'club'
                        ? t.tips.question.clues.bodyClub
                        : t.tips.question.clues.body,
                  },
                  { target: answersRef, radius: radii.lg, ...t.tips.question.answer },
                ]
              : [
                  {
                    target: slotsRef,
                    radius: radii.lg,
                    ...(level === 2 ? t.tips.question.level2 : t.tips.question.level3),
                  },
                ]
          }
          kicker={level === 1 ? undefined : t.tips.kickerLevel(level)}
          spoken={level === 1 ? undefined : t.tips.spokenLevel(level)}
          onClose={tips.close}
          onSkip={tips.skip}
          onShown={tips.onShown}
          scrollBy={(dy) =>
            scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + dy), animated: false })
          }
        />
      )}
    </View>
  );
}
