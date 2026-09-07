import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterPill } from '@/components/FilterPill';
import { StudyHeaderRow, StudyRow } from '@/components/StudyRow';
import { getRoster, getSquad } from '@/lib/squads';
import { parsePlayerIds, studyRows } from '@/lib/studyView';
import type { Position } from '@/types/squad';
import { colors, spacing, typography } from '@/theme/tokens';

const FILTERS: ('ALL' | Position)[] = ['ALL', 'GK', 'DF', 'MF', 'FW'];

export default function Study() {
  const insets = useSafeAreaInsets();
  const { squadId, players } = useLocalSearchParams<{ squadId: string; players?: string }>();
  const [filter, setFilter] = useState<'ALL' | Position>('ALL');

  const squad = getSquad(squadId);
  const roster = useMemo(() => getRoster(squadId), [squadId]);
  if (!squad) return null;

  const playerIds = parsePlayerIds(players);
  const rows = studyRows(roster, filter, playerIds);

  const affiliationLabel = squad.kind === 'club' ? 'NAT' : 'CLUB';

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>‹ Exit</Text>
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
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  back: { ...typography.secondary, color: colors.textSecondary },
  eyebrow: { ...typography.captionEyebrow, color: colors.textMuted, marginTop: spacing.md },
  title: { ...typography.sectionHead, color: colors.textPrimary, marginBottom: spacing.md },
  filters: { flexDirection: 'row', gap: spacing.xs - 2, marginBottom: spacing.sm },
});
