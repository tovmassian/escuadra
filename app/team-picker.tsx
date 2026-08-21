import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TeamRow } from '@/components/TeamRow';
import { listSquads } from '@/lib/squads';
import { useProgress, useProgressHydrated } from '@/stores/progress';
import { colors, spacing, typography } from '@/theme/tokens';

const SEGMENTS = [
  { key: 'club', label: 'Clubs' },
  { key: 'nation', label: 'National Teams' },
] as const;

export default function TeamPicker() {
  const insets = useSafeAreaInsets();
  const hydrated = useProgressHydrated();
  const bestScores = useProgress((s) => s.bestScores);
  const [filter, setFilter] = useState<'club' | 'nation'>('club');

  const squads = listSquads();
  const filtered = useMemo(() => squads.filter((s) => s.kind === filter), [squads, filter]);

  const bestFor = (squadId: string) => {
    if (!hydrated) return null;
    let best: number | null = null;
    for (const level of [1, 2, 3]) {
      const key = `${squadId}:${level}`;
      const score = bestScores[key];
      if (score !== undefined && (best === null || score > best)) best = score;
    }
    return best === null ? null : { correct: best, total: 10 };
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <Text style={styles.title}>Choose a Team</Text>
      <Text style={styles.subtitle}>{squads.length} teams · tap to start</Text>
      <SegmentedControl
        segments={SEGMENTS}
        value={filter}
        onChange={(k) => setFilter(k as 'club' | 'nation')}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TeamRow
            name={item.name}
            kind={item.kind}
            primaryColor={item.primaryColor}
            secondaryColor={item.secondaryColor}
            flag={item.flag}
            best={bestFor(item.id)}
            onPress={() =>
              router.push({ pathname: '/team/[squadId]/difficulty', params: { squadId: item.id } })
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  title: { ...typography.screenTitle, color: colors.textPrimary, marginBottom: spacing.xxs },
  subtitle: { ...typography.secondarySmall, color: colors.textMuted, marginBottom: spacing.md },
  list: { paddingTop: spacing.xs },
});
