import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ConnectorLine } from '@/components/ConnectorLine';
import { DifficultyRow, type DifficultyStatus } from '@/components/DifficultyRow';
import type { Level } from '@/lib/questionEngine';
import { getSquad } from '@/lib/squads';
import { scoreKey, useProgress } from '@/stores/progress';
import { colors, sizes, spacing, typography } from '@/theme/tokens';

const LEVELS: { level: Level; title: string; description: string }[] = [
  {
    level: 1,
    title: 'Name from Number',
    description: 'Given a shirt number, pick the player from 4 options.',
  },
  {
    level: 2,
    title: 'Name + Position',
    description: 'Pick the name, then the position — GK, DF, MF, or FW.',
  },
  {
    level: 3,
    title: 'Full Profile',
    description: 'Name from 6 options, then position, then club or nationality.',
  },
];

export default function Difficulty() {
  const insets = useSafeAreaInsets();
  const { squadId } = useLocalSearchParams<{ squadId: string }>();
  const bestScores = useProgress((s) => s.bestScores);
  const completedLevels = useProgress((s) => s.completedLevels);

  const squad = getSquad(squadId);
  if (!squad) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>‹ Exit</Text>
      </Pressable>
      <Text style={styles.eyebrow}>{squad.name.toUpperCase()}</Text>
      <Text style={styles.title}>Choose Difficulty</Text>

      <View style={styles.ladder}>
        <View style={styles.connector}>
          <ConnectorLine />
        </View>
        <View style={styles.rows}>
          {LEVELS.map(({ level, title, description }) => {
            const key = scoreKey(squad.id, level);
            const best = bestScores[key];
            const prevCompleted =
              level === 1 || completedLevels[scoreKey(squad.id, level - 1)] === true;
            const status: DifficultyStatus =
              best !== undefined ? 'best' : prevCompleted ? 'unlocked' : 'locked';
            return (
              <DifficultyRow
                key={level}
                level={level}
                title={title}
                description={description}
                status={status}
                bestScore={best !== undefined ? { correct: best, total: 10 } : undefined}
                onPress={
                  status === 'locked'
                    ? undefined
                    : () =>
                        router.push({
                          pathname: '/play/[squadId]/[level]',
                          params: { squadId: squad.id, level: String(level) },
                        })
                }
              />
            );
          })}
        </View>
      </View>

      <Button
        label="Study This Squad"
        variant="text"
        onPress={() =>
          router.push({ pathname: '/team/[squadId]/study', params: { squadId: squad.id } })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  back: { ...typography.secondary, color: colors.textSecondary },
  eyebrow: { ...typography.captionEyebrow, color: colors.textMuted, marginTop: spacing.md },
  title: { ...typography.screenTitle, color: colors.textPrimary, marginBottom: spacing.xxl },
  ladder: { flex: 1, position: 'relative' },
  connector: {
    position: 'absolute',
    left: sizes.difficultyConnectorOffset,
    top: spacing.xl,
    bottom: spacing.xxxl,
  },
  rows: { flex: 1, gap: spacing.lg },
});
