import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExamModeRow } from '@/components/ExamModeRow';
import { LadderCard } from '@/components/LadderCard';
import { LadderHero } from '@/components/LadderHero';
import { LadderRung } from '@/components/LadderRung';
import { BookGlyph } from '@/components/SettingsGlyphs';
import { useT } from '@/i18n/useT';
import { focusedLevel, formatLastUpdated, ladderRows, levelDescription } from '@/lib/ladderView';
import type { Level } from '@/lib/questionEngine';
import { getSquad, squadLeague } from '@/lib/squads';
import { useProgress } from '@/stores/progress';
import { borderWidths, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Difficulty (#178): the team's bands under a veil, then the ladder: cleared
// levels compact with their best, the focused level a Play card, locked
// levels with what opens them; Exam mode, as a placeholder; Study; and when
// the squad was last updated. The corner star keeps the team in Your squads
// (#179). OUTDATED (#180) is a later step.
export default function Difficulty() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { squadId } = useLocalSearchParams<{ squadId: string }>();
  const bestScores = useProgress((s) => s.bestScores);
  const starred = useProgress((s) => s.starredSquads.includes(squadId));
  const toggleStar = useProgress((s) => s.toggleStar);

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingTop: spacing.sm - 2,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    heading: {
      ...typography.monoCaption,
      color: colors.textMuted,
      paddingBottom: spacing.xxs / 2,
    },
    exam: { marginTop: spacing.xxs + 2 },
    study: {
      marginTop: spacing.xs,
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
  });

  const squad = getSquad(squadId);
  if (!squad) return null;

  const rows = ladderRows(squad.id, bestScores);
  const focused = focusedLevel(rows);
  const play = (level: Level) =>
    router.push({
      pathname: '/play/[squadId]/[level]',
      params: { squadId: squad.id, level: String(level) },
    });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
    >
      <LadderHero
        squad={squad}
        league={squadLeague(squad.id)}
        onBack={() => router.back()}
        starred={starred}
        onToggleStar={() => toggleStar(squad.id)}
      />
      <View style={styles.content}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.ladder.heading}
        </Text>
        {rows.map((row) => {
          const title = t.ladder.levels[row.level].title;
          return row.level === focused ? (
            <LadderCard
              key={row.level}
              row={row}
              title={title}
              description={levelDescription(row.level, squad.kind, t)}
              onPlay={() => play(row.level)}
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
        <Pressable
          testID="study"
          onPress={() =>
            router.push({ pathname: '/team/[squadId]/study', params: { squadId: squad.id } })
          }
          accessibilityRole="button"
          style={({ pressed }) => [styles.study, pressed && { opacity: opacity.settled }]}
        >
          <BookGlyph color={colors.textPrimary} />
          <Text style={styles.studyLabel}>{t.ladder.studySquad}</Text>
        </Pressable>
        <Text style={styles.updated}>
          {t.ladder.updated(formatLastUpdated(squad.lastUpdated, t))}
        </Text>
      </View>
    </ScrollView>
  );
}
