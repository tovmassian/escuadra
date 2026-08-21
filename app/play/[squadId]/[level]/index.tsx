import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnswerOption } from '@/components/AnswerOption';
import { Button } from '@/components/Button';
import { ChipOption } from '@/components/ChipOption';
import { CompletedPartPill } from '@/components/CompletedPartPill';
import { HeroCard } from '@/components/HeroCard';
import { ProgressDots } from '@/components/ProgressDots';
import { ScorePill } from '@/components/ScorePill';
import { StatChip } from '@/components/StatChip';
import type { Level, QuestionPart } from '@/lib/questionEngine';
import { getRoster, getSquad } from '@/lib/squads';
import { useProgress } from '@/stores/progress';
import { selectScore, useSession } from '@/stores/session';
import { colors, durations, sizes, spacing, typography } from '@/theme/tokens';

export default function Question() {
  const insets = useSafeAreaInsets();
  const { squadId, level: levelParam } = useLocalSearchParams<{ squadId: string; level: string }>();
  const level = Number(levelParam) as Level;

  const session = useSession();
  const setLastPlayed = useProgress((s) => s.setLastPlayed);
  const recordScore = useProgress((s) => s.recordScore);

  const squad = getSquad(squadId);

  useEffect(() => {
    if (!squad) return;
    if (session.squadId !== squadId || session.level !== level || session.phase === 'idle') {
      const roster = getRoster(squadId);
      session.startRound(squad, roster, level);
    }
    setLastPlayed(squadId, level);
    // Only re-run when the route target changes — starting a round mutates
    // `session`, so including it here would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId, level]);

  useEffect(() => {
    if (session.phase === 'complete' && session.squadId === squadId && session.level === level) {
      const score = selectScore(session.results);
      recordScore(squadId, level, score.correct);
      router.replace({
        pathname: '/play/[squadId]/[level]/results',
        params: { squadId, level: levelParam },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase]);

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

  const score = selectScore(session.results);
  const questionComplete = result.correct !== null;
  const accent = squad.primaryColor ?? colors.accent;

  const statChips: { label: string; value: string }[] =
    level === 1
      ? [
          { label: 'POS', value: question.position },
          { label: 'AGE', value: String(question.age) },
          { label: 'APPS', value: String(question.apps) },
        ]
      : level === 2
        ? [
            { label: 'AGE', value: String(question.age) },
            { label: 'APPS', value: String(question.apps) },
          ]
        : [];

  const exit = () => {
    session.reset();
    router.back();
  };

  const continuePressed = () => {
    session.advanceQuestion();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={exit} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.exit}>‹ Exit</Text>
        </Pressable>
        <View style={styles.teamLabel}>
          <Text style={styles.teamName}>{squad.name}</Text>
          <View style={[styles.underline, { backgroundColor: accent }]} />
        </View>
        <ScorePill correct={score.correct} total={score.attempted} variant="header" />
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressRow}>
          <Text style={styles.questionLabel}>
            Question {session.currentIndex + 1} of {session.questions.length}
          </Text>
          <Text style={styles.difficultyLabel}>DIFFICULTY {level}</Text>
        </View>
        <ProgressDots total={session.questions.length} current={session.currentIndex} />
      </View>

      <Animated.View
        key={session.currentIndex}
        entering={FadeIn.duration(durations.transition)}
        exiting={FadeOut.duration(durations.transition)}
        style={styles.heroBlock}
      >
        <HeroCard level={level} shirtNumber={question.memberNo} />
        {statChips.length > 0 && (
          <View style={styles.chipRow}>
            {statChips.map((c) => (
              <StatChip key={c.label} label={c.label} value={c.value} />
            ))}
          </View>
        )}
      </Animated.View>

      <View style={styles.partsBlock}>
        {question.parts.map((part, i) => (
          <QuestionPartView
            key={i}
            part={part}
            index={i}
            level={level}
            currentPartIndex={session.currentPartIndex}
            answeredIndex={result.parts[i]?.pickedIndex ?? null}
            onAnswer={(pickedIndex) => session.answerPart(pickedIndex)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          label={questionComplete ? 'Continue' : 'Select an answer'}
          variant={questionComplete ? 'filled' : 'inert'}
          disabled={!questionComplete}
          onPress={continuePressed}
        />
      </View>
    </View>
  );
}

function partLabel(part: QuestionPart): string {
  switch (part.kind) {
    case 'name':
      return '1 · NAME';
    case 'position':
      return '2 · POSITION';
    case 'nationality':
      return '3 · NATIONALITY';
    case 'club':
      return '3 · CLUB';
  }
}

function QuestionPartView({
  part,
  index,
  level,
  currentPartIndex,
  answeredIndex,
  onAnswer,
}: {
  part: QuestionPart;
  index: number;
  level: Level;
  currentPartIndex: number;
  answeredIndex: number | null;
  onAnswer: (pickedIndex: number) => void;
}) {
  const isMultiPart = level > 1;
  const isAnswered = answeredIndex !== null;
  const isActive = index === currentPartIndex;

  if (!isActive && !isAnswered) return null; // future part, not revealed yet

  // Level 1 has a single part: it stays expanded and shows the full
  // idle/correct/incorrect reveal, per the interaction-state spec. Levels
  // 2-3 collapse each answered part to a pill immediately, always showing
  // the correct answer — misses are what the Results screen is for.
  if (isMultiPart) {
    return (
      <View style={styles.part}>
        <Text style={styles.partLabel}>{partLabel(part)}</Text>
        {isAnswered ? (
          <CompletedPartPill label={part.options[part.correctIndex] ?? ''} />
        ) : part.kind === 'position' ? (
          <View style={styles.chipOptionsRow}>
            {part.options.map((label, i) => (
              <ChipOption key={label} label={label} verdict="idle" onPress={() => onAnswer(i)} />
            ))}
          </View>
        ) : (
          <View style={styles.optionsColumn}>
            {part.options.map((label, i) => (
              <AnswerOption key={label} label={label} verdict="idle" onPress={() => onAnswer(i)} />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.optionsColumn}>
      {part.options.map((label, i) => {
        let verdict:
          'idle' | 'correct-picked' | 'correct-unpicked' | 'incorrect-picked' | 'incorrect-other' =
          'idle';
        if (isAnswered) {
          if (i === part.correctIndex)
            verdict = i === answeredIndex ? 'correct-picked' : 'correct-unpicked';
          else verdict = i === answeredIndex ? 'incorrect-picked' : 'incorrect-other';
        }
        return (
          <AnswerOption
            key={label}
            label={label}
            verdict={verdict}
            disabled={isAnswered}
            onPress={() => onAnswer(i)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  exit: { ...typography.secondary, color: colors.textSecondary },
  teamLabel: { alignItems: 'center', gap: spacing.xxs },
  teamName: { ...typography.rowTitle, color: colors.textPrimary },
  underline: {
    width: sizes.teamUnderline.width,
    height: sizes.teamUnderline.height,
    borderRadius: sizes.teamUnderline.height,
  },
  progressBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.sm - 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  questionLabel: { ...typography.secondarySmall, color: colors.textSecondary },
  difficultyLabel: { ...typography.statMonoTiny, color: colors.textMuted, letterSpacing: 0.7 },
  heroBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  chipRow: { flexDirection: 'row', gap: spacing.xs },
  partsBlock: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.md - 2 },
  part: { gap: spacing.xs },
  partLabel: { ...typography.captionEyebrow, color: colors.textSecondary },
  optionsColumn: { gap: spacing.xs + 2 },
  chipOptionsRow: { flexDirection: 'row', gap: spacing.xs },
  footer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
});
