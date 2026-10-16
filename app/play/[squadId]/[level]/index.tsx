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
import { useScreenReader } from '@/components/useScreenReader';
import { useShot } from '@/components/useShot';
import { feedback } from '@/lib/haptics';
import { photoFor, roundPhotoUrls } from '@/lib/photos';
import type { Level } from '@/lib/questionEngine';
import { isFlawless } from '@/lib/resultsView';
import {
  answerLayout,
  footerMode,
  isCompact,
  partCounter,
  progressOutcomes,
  promptText,
  slotStates,
  streak,
  streakMilestone,
} from '@/lib/roundView';
import { getPlayer, getRoster, getSquad } from '@/lib/squads';
import { withAlpha } from '@/lib/stageView';
import { track } from '@/lib/telemetry';
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
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const themeName = useThemeName();
  const reduced = useReducedMotion();
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

  useEffect(() => {
    if (!squad) return;
    if (session.squadId !== squadId || session.level !== level || session.phase === 'idle') {
      session.startRound(
        squad,
        getRoster(squadId),
        level,
        Number.isFinite(seed) ? seed : undefined,
      );
      track('round.started', { kind: squad.kind, level });
    }
    setLastPlayed(squadId, level);
    // Only when the route target changes: starting a round mutates `session`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId, level, seedParam]);

  useEffect(() => {
    if (session.phase === 'complete' && session.squadId === squadId && session.level === level) {
      const score = selectScore(session.results);
      recordScore(squadId, level, score.correct);
      if (squad) {
        track('round.completed', {
          kind: squad.kind,
          level,
          score: score.correct,
          aLaEscuadra: isFlawless(score.correct, score.attempted),
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
    hero: { paddingHorizontal: spacing.lg, gap: spacing.sm },
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
  });

  if (
    !squad ||
    session.phase !== 'playing' ||
    session.squadId !== squadId ||
    session.level !== level
  )
    return null;

  const question = session.questions[session.currentIndex];
  const result = session.results[session.currentIndex];
  if (!question || !result) return null;
  const part = question.parts[session.currentPartIndex];
  if (!part) return null;

  const score = selectScore(session.results);
  const photo = photoFor(getPlayer(question.playerId));
  const slots = slotStates(question, result, session.currentPartIndex, squad.kind, level);
  const answeredIndex = result.parts[session.currentPartIndex]?.pickedIndex ?? null;
  const counter = partCounter(question, session.currentPartIndex);
  const promptColor =
    verdict === true ? colors.success : verdict === false ? colors.error : colors.onStage;

  const exit = () => {
    session.reset();
    router.back();
  };
  const next = () => session.advanceQuestion();
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
      <View style={styles.column}>
        <RoundProgress
          outcomes={progressOutcomes(session.results, session.currentIndex)}
          currentIndex={session.currentIndex}
        />
        <View style={styles.topBar}>
          <GlassCloseButton label="Leave the round" onPress={exit} />
          <View style={styles.team}>
            <Text style={styles.teamName} numberOfLines={1}>
              {squad.name}
            </Text>
            <View style={styles.teamSub}>
              <TeamMarker marker={squad.marker} variant="banner" />
              <Text style={styles.level}>Level {level}</Text>
            </View>
          </View>
          {currentStreak >= 2 ? <StreakChip count={currentStreak} /> : null}
          <View
            style={styles.scorePill}
            accessible
            accessibilityLabel={`Score: ${score.correct} of ${score.attempted}`}
          >
            <Text style={styles.score}>
              {score.correct}/{score.attempted}
            </Text>
          </View>
        </View>

        <ScrollView
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
          <View style={styles.heroFrame}>
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
              <View style={styles.numberWrap}>
                <Text
                  style={styles.number}
                  maxFontSizeMultiplier={fontScaleCap.display}
                  accessibilityLabel={`Shirt number ${question.memberNo}`}
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
              <View style={styles.slots}>
                {slots.map((slot) => (
                  <SlotChip key={slot.key} slot={slot} />
                ))}
              </View>
            </Animated.View>
          </View>

          <View style={styles.ground}>
            <View style={styles.promptRow}>
              <Text
                style={[
                  compact ? typography.promptCompact : typography.prompt,
                  { color: promptColor },
                ]}
                maxFontSizeMultiplier={fontScaleCap.display}
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
              >
                {promptText(part, question.memberNo, verdict)}
              </Text>
              {counter ? <Text style={styles.counter}>{counter}</Text> : null}
            </View>

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
                // here; the last part's tile plays its own.
                if (right && !lastPart) feedback('correct');
                // The shot only when the question is decided: the last part
                // right (a goal), or any part wrong (a miss).
                if (!right || lastPart) fire(right ? 'goal' : 'miss', tap);
                session.answerPart(pickedIndex);
              }}
            />

            <QuestionFooter
              mode={footerMode(verdict, screenReader)}
              compact={compact}
              onNext={next}
              credit={photo}
            />
          </View>
        </ScrollView>
      </View>
      {/* Over everything, and never in the way of a tap. */}
      <ShotOverlay ref={overlayRef} question={session.currentIndex} live={live} clock={clock} />
    </View>
  );
}
