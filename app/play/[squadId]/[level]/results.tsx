import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { EscuadraMark } from '@/components/EscuadraMark';
import type { Level } from '@/lib/questionEngine';
import { actionOrder, isFlawless, type ActionId } from '@/lib/resultsView';
import { PASS_RATIO } from '@/lib/scoring';
import { getRoster, getSquad } from '@/lib/squads';
import {
  firstWrongPart,
  selectMissed,
  selectScore,
  useSession,
  type QuestionResult,
} from '@/stores/session';
import { colors, durations, radii, sizes, spacing, typography } from '@/theme/tokens';

const MAX_LEVEL: Level = 3;

// Only called from the `!flawless` branch below, where `ratio === 1` is
// unreachable (a flawless round with `attempted > 0` already took the other
// branch, and `attempted === 0` computes `ratio = 0`) — so there is no
// separate "flawless" sentence here; that copy lives in exactly one place.
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
  const flawless = isFlawless(score.correct, score.attempted);

  const passed = score.attempted > 0 && score.correct / score.attempted >= PASS_RATIO;
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

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      {flawless ? (
        <Animated.View
          entering={FadeIn.duration(durations.pop + durations.popSettle)}
          style={styles.flawless}
        >
          <EscuadraMark size={sizes.celebrationMark} color={colors.success} showTrail />
          <Text style={styles.flawlessScore}>
            {score.correct}/{score.attempted}
          </Text>
          <Text style={styles.flawlessTitle}>a la escuadra</Text>
          <Text style={styles.verdict}>
            {squad.name}, level {level}. Nothing missed.
          </Text>
        </Animated.View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.eyebrow}>
              {squad.name.toUpperCase()} · LEVEL {level} · ROUND COMPLETE
            </Text>
            <Text style={styles.score}>
              {score.correct}/{score.attempted}
            </Text>
            <Text style={styles.verdict}>{verdictSentence(score.correct, score.attempted)}</Text>
          </View>

          {missed.length > 0 && (
            <>
              <Text style={styles.missedLabel}>MISSED · {missed.length} PLAYERS</Text>
              <FlatList
                data={missed}
                keyExtractor={(r) => r.question.playerId}
                contentContainerStyle={styles.missedList}
                renderItem={({ item }) => <MissedCard result={item} />}
              />
            </>
          )}
        </>
      )}

      <View style={styles.actions}>
        {actions.map((id, index) => (
          <Button
            key={id}
            label={actionLabels[id]}
            variant={index === 0 ? 'filled' : index === 1 ? 'outline' : 'text'}
            onPress={actionHandlers[id]}
          />
        ))}
      </View>
    </View>
  );
}

function MissedCard({ result }: { result: QuestionResult }) {
  const wrong = firstWrongPart(result);
  const namePart = result.question.parts[0];
  const correctName =
    namePart?.kind === 'name'
      ? namePart.options[namePart.correctIndex]
      : result.question.playerName;

  return (
    <View style={styles.missedCard}>
      <Text style={styles.missedNumber}>{result.question.memberNo}</Text>
      <View style={styles.missedText}>
        <Text style={styles.missedName}>{correctName}</Text>
        {wrong && (
          <Text style={styles.missedPicked}>
            You picked <Text style={styles.missedPickedValue}>{wrong.pickedLabel}</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  summary: { alignItems: 'center', marginBottom: spacing.xl },
  flawless: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  flawlessScore: { ...typography.scoreHero, color: colors.success, marginTop: spacing.lg },
  flawlessTitle: { ...typography.screenTitle, color: colors.textPrimary, fontStyle: 'italic' },
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
