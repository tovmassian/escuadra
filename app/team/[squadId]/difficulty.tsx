import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { DifficultyCard } from '@/components/DifficultyCard';
import { DifficultyRow } from '@/components/DifficultyRow';
import { LadderConnector } from '@/components/LadderConnector';
import { squadDisplayName } from '@/i18n/displayNames';
import { useLanguage, useT } from '@/i18n/useT';
import type { Level } from '@/lib/questionEngine';
import { focusedLevel, formatLastUpdated, ladderRows } from '@/lib/ladderView';
import { getSquad } from '@/lib/squads';
import { useProgress } from '@/stores/progress';
import { spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export default function Difficulty() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
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
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>‹ {t.common.back}</Text>
      </Pressable>
      <Text style={styles.eyebrow}>{squadDisplayName(squad, language).toUpperCase()}</Text>
      <Text style={styles.title}>{t.ladder.title}</Text>

      <View>
        {rows.map((row, i) => {
          const copy = t.ladder.levels[row.level];
          return (
            <React.Fragment key={row.level}>
              {row.level === focused ? (
                <DifficultyCard
                  row={row}
                  title={copy.title}
                  description={
                    'description' in copy
                      ? copy.description
                      : squad.kind === 'club'
                        ? copy.descriptionClub
                        : copy.descriptionNation
                  }
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
          label={t.ladder.studySquad}
          variant={studyProminent ? 'outline' : 'text'}
          large={studyProminent}
          onPress={() =>
            router.push({ pathname: '/team/[squadId]/study', params: { squadId: squad.id } })
          }
        />
      </View>

      <Text style={styles.updated}>
        {t.ladder.updated(formatLastUpdated(squad.lastUpdated, t))}
      </Text>
    </View>
  );
}
