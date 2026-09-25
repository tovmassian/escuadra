import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { FilterPill } from '@/components/FilterPill';
import { StudyHeaderRow, StudyRow } from '@/components/StudyRow';
import { flagFor } from '@/lib/flags';
import type { Level } from '@/lib/questionEngine';
import { getRoster, getSquad } from '@/lib/squads';
import { parseLevel, parsePlayerIds, studyRows } from '@/lib/studyView';
import { track } from '@/lib/telemetry';
import { useSession } from '@/stores/session';
import type { Position } from '@/types/squad';
import { spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

const FILTERS: ('ALL' | Position)[] = ['ALL', 'GK', 'DF', 'MF', 'FW'];

export default function Study() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const {
    squadId,
    players,
    level: levelParam,
  } = useLocalSearchParams<{
    squadId: string;
    players?: string;
    level?: string;
  }>();
  const [filter, setFilter] = useState<'ALL' | Position>('ALL');
  const startRound = useSession((s) => s.startRound);

  const styles = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingBottom: insets.bottom + spacing.lg,
    },
    back: { ...typography.secondary, color: colors.textSecondary },
    eyebrow: { ...typography.captionEyebrow, color: colors.textMuted, marginTop: spacing.md },
    title: { ...typography.sectionHead, color: colors.textPrimary, marginBottom: spacing.md },
    filters: { flexDirection: 'row', gap: spacing.xs - 2, marginBottom: spacing.sm },
    list: { flex: 1 },
    retryButton: { marginTop: spacing.md },
  });

  const squad = getSquad(squadId);
  const roster = useMemo(() => getRoster(squadId), [squadId]);
  const kind = squad?.kind;
  useEffect(() => {
    if (kind) track('study.opened', { kind });
  }, [squadId, kind]);
  if (!squad) return null;

  const playerIds = parsePlayerIds(players);
  const level: Level | null = parseLevel(levelParam);
  const rows = studyRows(roster, filter, playerIds);
  const canRetry = playerIds !== null && level !== null;

  const affiliationLabel = squad.kind === 'club' ? 'NAT' : 'CLUB';

  const retryRound = () => {
    if (level === null) return;
    const fullRoster = getRoster(squad.id);
    startRound(squad, fullRoster, level);
    // This screen is only reached (with a level) by pushing from Results,
    // which itself replaced Play — so a plain replace here would leave
    // Results underneath, and Exit's session.reset() + router.back() would
    // land on a Results screen whose session guard no longer matches,
    // rendering blank. Dismissing to Difficulty first — always an ancestor
    // of this flow — then pushing Play restores the same
    // Difficulty-then-Play shape every other entry into a round has, so
    // Exit's back() always lands somewhere valid.
    router.dismissTo({
      pathname: '/team/[squadId]/difficulty',
      params: { squadId: squad.id },
    });
    router.push({
      pathname: '/play/[squadId]/[level]',
      params: { squadId: squad.id, level: String(level) },
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.eyebrow}>{squad.name.toUpperCase()}</Text>
      <Text style={styles.title}>{playerIds === null ? 'Full Squad' : 'Missed Players'}</Text>

      {playerIds === null && (
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <FilterPill key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
      )}

      <StudyHeaderRow affiliationLabel={affiliationLabel} />
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(r) => r.player.id}
        renderItem={({ item }) => (
          <StudyRow
            number={item.member.no}
            name={item.player.name}
            position={item.player.position}
            affiliation={
              squad.kind === 'club' ? item.player.nationality : (item.player.club ?? '—')
            }
            flag={squad.kind === 'club' ? flagFor(item.player.nationality) : undefined}
          />
        )}
      />
      {canRetry && (
        <View style={styles.retryButton}>
          <Button label="Retry This Round" variant="outline" onPress={retryRound} />
        </View>
      )}
    </View>
  );
}
