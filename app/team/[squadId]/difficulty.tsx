import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { DifficultyCard } from '@/components/DifficultyCard';
import { DifficultyRow } from '@/components/DifficultyRow';
import { LadderConnector } from '@/components/LadderConnector';
import type { Level } from '@/lib/questionEngine';
import { focusedLevel, formatLastUpdated, ladderRows } from '@/lib/ladderView';
import { getSquad } from '@/lib/squads';
import { useProgress } from '@/stores/progress';
import { spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

const LEVEL_COPY: Record<Level, { title: string; description: string }> = {
  1: {
    title: 'Name from Number',
    description: 'Given a shirt number, pick the player from 4 options.',
  },
  2: {
    title: 'Name + Position',
    description: 'Pick the name, then the position — GK, DF, MF, or FW.',
  },
  3: {
    title: 'Full Profile',
    description: 'Name from 6 options, then position, then club or nationality.',
  },
};

export default function Difficulty() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { squadId } = useLocalSearchParams<{ squadId: string }>();
  const bestScores = useProgress((s) => s.bestScores);

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
    spacer: { flex: 1 },
    studyButton: { marginTop: spacing.lg },
    studyLink: { marginTop: spacing.lg, marginBottom: spacing.md, alignItems: 'center' },
    updated: {
      ...typography.descriptionSmall,
      color: colors.textMuted,
      alignSelf: 'flex-end',
      marginTop: spacing.sm,
    },
  });

  const squad = getSquad(squadId);
  if (!squad) return null;

  const rows = ladderRows(squad.id, bestScores);
  const focused = focusedLevel(rows);
  const studyProminent = focused === 1;
  const play = (level: Level) =>
    router.push({
      pathname: '/play/[squadId]/[level]',
      params: { squadId: squad.id, level: String(level) },
    });

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>‹ Exit</Text>
      </Pressable>
      <Text style={styles.eyebrow}>{squad.name.toUpperCase()}</Text>
      <Text style={styles.title}>Choose Difficulty</Text>

      <View>
        {rows.map((row, i) => {
          const copy = LEVEL_COPY[row.level];
          return (
            <React.Fragment key={row.level}>
              {row.level === focused ? (
                <DifficultyCard
                  row={row}
                  title={copy.title}
                  description={copy.description}
                  onPlay={() => play(row.level)}
                />
              ) : (
                <DifficultyRow
                  row={row}
                  title={copy.title}
                  onPress={row.status === 'locked' ? undefined : () => play(row.level)}
                />
              )}
              {i < rows.length - 1 && <LadderConnector active={row.status !== 'locked'} />}
            </React.Fragment>
          );
        })}
      </View>
      <View style={styles.spacer} />

      {/* Before the first level is cleared, studying the squad is a real
          alternative to playing, so it keeps a full outline button; past it,
          Play is the way forward and Study steps down to a link. */}
      <View style={studyProminent ? styles.studyButton : styles.studyLink}>
        <Button
          label="Study This Squad"
          variant={studyProminent ? 'outline' : 'text'}
          large={studyProminent}
          onPress={() =>
            router.push({ pathname: '/team/[squadId]/study', params: { squadId: squad.id } })
          }
        />
      </View>

      <Text style={styles.updated}>Updated {formatLastUpdated(squad.lastUpdated)} · Wikipedia</Text>
    </View>
  );
}
