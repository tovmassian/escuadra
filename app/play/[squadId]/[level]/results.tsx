import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { EscuadraStrike } from '@/components/EscuadraStrike';
import type { Level } from '@/lib/questionEngine';
import { actionOrder, resultTier, type ActionId } from '@/lib/resultsView';
import { PASS_RATIO } from '@/lib/scoring';
import { getRoster, getSquad } from '@/lib/squads';
import {
  firstWrongPart,
  selectMissed,
  selectScore,
  useSession,
  type QuestionResult,
} from '@/stores/session';
import {
  celebrationCascade,
  celebrationEasingCurves,
  celebrationRiseDuration,
  colors,
  MOTION_DISTANCE_SCALE,
  radii,
  sizes,
  spacing,
  strikeTiming,
  typography,
  type CelebrationCascade,
} from '@/theme/tokens';

const riseEasing = Easing.bezier(...celebrationEasingCurves.rise);
// Exaggerates the score's pop-in bounce by the same knob EscuadraStrike
// uses for the mark — 1 in the shipped build, a no-op until that's turned up.
const POP_START_SCALE = 1 - 0.18 * MOTION_DISTANCE_SCALE;
const POP_OVERSHOOT_SCALE = 1 + 0.05 * MOTION_DISTANCE_SCALE;

// Bridges a Reanimated shared value's count-up to React state so a plain
// <Text> can render it — no react-native-redash on this project, so this is
// the pragmatic stand-in for the design source's `ReText`/AnimatedProps
// approach: cheap here since it only fires once per integer step (0..10).
function AnimatedScore({
  correct,
  total,
  cascade,
  style,
}: {
  correct: number;
  total: number;
  cascade: CelebrationCascade['score'];
  style: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState(0);
  const n = useSharedValue(0);
  const scale = useSharedValue(cascade.pop ? POP_START_SCALE : 1);
  const opacity = useSharedValue(cascade.pop ? 0 : 1);

  useEffect(() => {
    n.value = withDelay(
      cascade.delay,
      withTiming(correct, { duration: cascade.duration, easing: Easing.out(Easing.cubic) }),
    );
    if (cascade.pop) {
      const popDuration = celebrationRiseDuration + 40; // matches the design's esc-pop, ~260ms
      opacity.value = withDelay(
        cascade.delay,
        withTiming(1, { duration: Math.round(popDuration * 0.4) }),
      );
      scale.value = withDelay(
        cascade.delay,
        withSequence(
          withTiming(POP_OVERSHOOT_SCALE, { duration: Math.round(popDuration * 0.62) }),
          withTiming(1, { duration: Math.round(popDuration * 0.38) }),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAnimatedReaction(
    () => Math.round(n.value),
    (value, previous) => {
      if (value !== previous) runOnJS(setDisplay)(value);
    },
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {display}/{total}
    </Animated.Text>
  );
}

const MAX_LEVEL: Level = 3;

// Only called for the `passed` and `fail` tiers, where `ratio === 1` is
// unreachable (a flawless round is the `excellent` tier, handled separately,
// and `attempted === 0` computes `ratio = 0`) — so there is no separate
// "flawless" sentence here; that copy lives in exactly one place.
function verdictSentence(correct: number, total: number): string {
  const ratio = total === 0 ? 0 : correct / total;
  if (ratio >= PASS_RATIO) return 'You knew most of the starting XI.';
  if (ratio >= 0.5) return 'Solid — a few names to brush up on.';
  return 'These are the ones to learn.';
}

export default function Results() {
  const insets = useSafeAreaInsets();
  const { squadId, level: levelParam } = useLocalSearchParams<{ squadId: string; level: string }>();
  const level = Number(levelParam) as Level;
  const session = useSession();

  const squad = getSquad(squadId);
  if (!squad || session.squadId !== squadId || session.level !== level) return null;

  const score = selectScore(session.results);
  const missed = selectMissed(session.results);
  const tier = resultTier(score.correct, score.attempted);

  const passed = tier !== 'fail';
  const hasNextLevel = level < MAX_LEVEL;
  const actions = actionOrder({ passed, hasNextLevel, missedCount: missed.length });

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
    router.replace('/team-picker');
  };

  const studySquad = () => {
    router.push({ pathname: '/team/[squadId]/study', params: { squadId } });
  };

  const studyMissed = () => {
    router.push({
      pathname: '/team/[squadId]/study',
      params: { squadId, players: missed.map((r) => r.question.playerId).join(',') },
    });
  };

  const actionHandlers: Record<ActionId, () => void> = {
    nextLevel: () => retry((level + 1) as Level),
    retry: () => retry(level),
    studyMissed,
    study: studySquad,
    chooseTeam: chooseDifferentTeam,
  };

  const actionLabels: Record<ActionId, string> = {
    nextLevel: `Play Level ${level + 1}`,
    retry: 'Retry This Round',
    studyMissed: `Study These ${missed.length}`,
    study: 'Study This Squad',
    chooseTeam: 'Choose Different Team',
  };

  const cascade = celebrationCascade[tier];
  const riseIn = (delay: number) =>
    FadeInUp.duration(celebrationRiseDuration).delay(delay).easing(riseEasing);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      {tier !== 'fail' ? (
        <View style={[styles.success, tier === 'excellent' && styles.successExcellent]}>
          <EscuadraStrike
            size={sizes.celebrationMark}
            color={tier === 'excellent' ? colors.success : colors.accent}
            ballColor={colors.success}
            timing={tier === 'excellent' ? strikeTiming.excellent : strikeTiming.passed}
          />
          <AnimatedScore
            correct={score.correct}
            total={score.attempted}
            cascade={cascade.score}
            style={[styles.successScore, tier === 'excellent' && styles.successScoreExcellent]}
          />
          <Animated.Text
            entering={riseIn(cascade.title)}
            style={[styles.successTitle, tier === 'excellent' && styles.successTitleExcellent]}
          >
            {tier === 'excellent' ? 'a la escuadra' : `Level ${level} cleared`}
          </Animated.Text>
          <Animated.Text entering={riseIn(cascade.subtitle)} style={styles.verdict}>
            {tier === 'excellent'
              ? `${squad.name}, level ${level}. Nothing missed.`
              : verdictSentence(score.correct, score.attempted)}
          </Animated.Text>
        </View>
      ) : (
        <View style={styles.summary}>
          <Animated.Text entering={riseIn(cascade.title)} style={styles.eyebrow}>
            {squad.name.toUpperCase()} · LEVEL {level} · ROUND COMPLETE
          </Animated.Text>
          <AnimatedScore
            correct={score.correct}
            total={score.attempted}
            cascade={cascade.score}
            style={styles.score}
          />
          <Animated.Text entering={riseIn(cascade.subtitle)} style={styles.verdict}>
            {verdictSentence(score.correct, score.attempted)}
          </Animated.Text>
        </View>
      )}

      {missed.length > 0 && (
        <>
          <Animated.Text entering={riseIn(cascade.missedLabel ?? 0)} style={styles.missedLabel}>
            MISSED · {missed.length} PLAYERS
          </Animated.Text>
          <FlatList
            data={missed}
            keyExtractor={(r) => r.question.playerId}
            contentContainerStyle={styles.missedList}
            renderItem={({ item, index }) => (
              <MissedCard
                result={item}
                delay={(cascade.missedBase ?? 0) + index * (cascade.missedStep ?? 0)}
              />
            )}
          />
        </>
      )}

      <View style={styles.actions}>
        {actions.map((id, index) => (
          <Animated.View
            key={id}
            entering={riseIn(cascade.actionsBase + index * cascade.actionsStep)}
          >
            <Button
              label={actionLabels[id]}
              variant={index === 0 ? 'filled' : index === 1 ? 'outline' : 'text'}
              onPress={actionHandlers[id]}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function MissedCard({ result, delay }: { result: QuestionResult; delay: number }) {
  const wrong = firstWrongPart(result);
  const namePart = result.question.parts[0];
  const correctName =
    namePart?.kind === 'name'
      ? namePart.options[namePart.correctIndex]
      : result.question.playerName;

  return (
    <Animated.View
      entering={FadeInUp.duration(celebrationRiseDuration).delay(delay).easing(riseEasing)}
      style={styles.missedCard}
    >
      <Text style={styles.missedNumber}>{result.question.memberNo}</Text>
      <View style={styles.missedText}>
        <Text style={styles.missedName}>{correctName}</Text>
        {wrong && (
          <Text style={styles.missedPicked}>
            You picked <Text style={styles.missedPickedValue}>{wrong.pickedLabel}</Text>
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  summary: { alignItems: 'center', marginBottom: spacing.xl },
  // Shared by both success tiers ('passed' and 'excellent'). 'excellent' has
  // no missed list beneath it (a flawless round misses nothing), so it alone
  // gets the full-screen centred treatment; 'passed' sits above its missed
  // list like `summary` does.
  success: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.sm },
  successExcellent: { flex: 1, justifyContent: 'center', marginBottom: 0 },
  successScore: { ...typography.scoreHero, color: colors.textPrimary, marginTop: spacing.lg },
  successScoreExcellent: { color: colors.success },
  successTitle: { ...typography.screenTitle, color: colors.textPrimary },
  successTitleExcellent: { fontStyle: 'italic' },
  eyebrow: { ...typography.captionEyebrow, color: colors.textMuted, marginBottom: spacing.xs },
  score: { ...typography.scoreHero, color: colors.textPrimary },
  verdict: { ...typography.secondarySmall, color: colors.textSecondary, marginTop: spacing.xs },
  missedLabel: { ...typography.captionEyebrow, color: colors.error, marginBottom: spacing.sm },
  missedList: { gap: spacing.sm },
  missedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md - 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 2,
    borderLeftColor: colors.error,
    borderRadius: radii.lg,
  },
  missedNumber: { ...typography.rowTitle, width: sizes.missedNumberWidth, color: colors.textMuted },
  missedText: { flex: 1, minWidth: 0 },
  missedName: { ...typography.rowTitle, color: colors.textPrimary },
  missedPicked: {
    ...typography.secondarySmall,
    color: colors.textMuted,
    marginTop: spacing.xxs - 2,
  },
  missedPickedValue: { color: colors.error },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
