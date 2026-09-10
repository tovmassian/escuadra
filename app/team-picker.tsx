import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterPill } from '@/components/FilterPill';
import { SearchField } from '@/components/SearchField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TeamRow } from '@/components/TeamRow';
import type { LeagueFilter } from '@/lib/pickerView';
import { flagFor } from '@/lib/flags';
import { LEAGUE_LABELS, leagueFilters, teamProgress, visibleSquads } from '@/lib/pickerView';
import { listSquads } from '@/lib/squads';
import { useProgress, useProgressHydrated } from '@/stores/progress';
import { spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

const SEGMENTS = [
  { key: 'club', label: 'Clubs' },
  { key: 'nation', label: 'National Teams' },
] as const;

export default function TeamPicker() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const hydrated = useProgressHydrated();
  const bestScores = useProgress((s) => s.bestScores);
  const [filter, setFilter] = useState<'club' | 'nation'>('club');
  const [league, setLeague] = useState<LeagueFilter>('ALL');
  const [query, setQuery] = useState('');

  const squads = listSquads();
  const leagues = useMemo(() => leagueFilters(squads), [squads]);
  const filtered = useMemo(
    () => visibleSquads(squads, filter, league, query),
    [squads, filter, league, query],
  );

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
    title: { ...typography.screenTitle, color: colors.textPrimary, marginBottom: spacing.xxs },
    subtitle: { ...typography.secondarySmall, color: colors.textMuted, marginBottom: spacing.md },
    // `flexGrow: 0` keeps the horizontal scroller from claiming leftover
    // vertical space in this column; `flexShrink: 0` stops the list below from
    // taking it back. Without the latter the track collapses on native once the
    // list is long enough to scroll (RN shrinks flex children by default where
    // RN-Web does not, so this never reproduces in the web build).
    leagueTrack: { flexGrow: 0, flexShrink: 0, marginTop: spacing.sm },
    // `alignItems: 'center'` keeps each pill at its own intrinsic height. A row
    // stretches its children by default, so a squeezed track would otherwise
    // flatten the pills and clip their labels rather than overflow.
    leagueRow: { alignItems: 'center', gap: spacing.xs - 2, paddingRight: spacing.lg },
    list: { paddingTop: spacing.xs },
    search: { marginBottom: spacing.sm },
    empty: { paddingTop: spacing.xxl, alignItems: 'center' },
    emptyTitle: { ...typography.secondary, color: colors.textSecondary, marginBottom: spacing.xxs },
    emptySubtitle: { ...typography.secondarySmall, color: colors.textMuted },
  });

  // Switching tabs drops the league back to ALL, so tapping "Clubs" always
  // shows every club rather than silently re-applying a league picked before
  // a detour through the nations tab, while its pill row was hidden. The
  // search query deliberately survives the switch instead — a name typed on
  // one tab may be worth checking on the other.
  const changeKind = (key: string) => {
    setFilter(key as 'club' | 'nation');
    setLeague('ALL');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <Text style={styles.title}>Choose a Team</Text>
      <Text style={styles.subtitle}>
        {filtered.length} {filtered.length === 1 ? 'team' : 'teams'} · tap to start
      </Text>
      <View style={styles.search}>
        <SearchField value={query} onChange={setQuery} onClear={() => setQuery('')} />
      </View>
      <SegmentedControl segments={SEGMENTS} value={filter} onChange={changeKind} />

      {filter === 'club' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.leagueTrack}
          contentContainerStyle={styles.leagueRow}
        >
          {leagues.map((l) => (
            <FilterPill
              key={l}
              label={LEAGUE_LABELS[l]}
              active={league === l}
              onPress={() => setLeague(l)}
            />
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No teams found</Text>
            {query.trim().length > 0 && (
              <Text style={styles.emptySubtitle}>No results for &quot;{query.trim()}&quot;</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TeamRow
            name={item.name}
            marker={item.marker}
            season={item.season}
            flag={item.kind === 'nation' ? flagFor(item.name) : undefined}
            progress={hydrated ? teamProgress(item.id, bestScores) : undefined}
            onPress={() =>
              router.push({ pathname: '/team/[squadId]/difficulty', params: { squadId: item.id } })
            }
          />
        )}
      />
    </View>
  );
}
