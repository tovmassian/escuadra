import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Wordmark } from '@/components/Wordmark';
import { getRoster, getSquad } from '@/lib/squads';
import { scoreKey, useProgress, useProgressHydrated } from '@/stores/progress';
import { useSession } from '@/stores/session';
import { colors, iconSize, radii, sizes, spacing, typography } from '@/theme/tokens';

export default function Home() {
  const insets = useSafeAreaInsets();
  const hydrated = useProgressHydrated();
  const lastPlayed = useProgress((s) => s.lastPlayed);
  const bestScores = useProgress((s) => s.bestScores);
  const setLastPlayed = useProgress((s) => s.setLastPlayed);
  const startRound = useSession((s) => s.startRound);

  const continueSquad = hydrated && lastPlayed ? getSquad(lastPlayed.squadId) : undefined;
  const continueBest = lastPlayed
    ? bestScores[scoreKey(lastPlayed.squadId, lastPlayed.level)]
    : undefined;

  const startTraining = () => {
    if (continueSquad && lastPlayed) {
      const roster = getRoster(continueSquad.id);
      startRound(continueSquad, roster, lastPlayed.level as 1 | 2 | 3);
      setLastPlayed(continueSquad.id, lastPlayed.level);
      router.push({
        pathname: '/play/[squadId]/[level]',
        params: { squadId: continueSquad.id, level: String(lastPlayed.level) },
      });
      return;
    }
    router.push('/team-picker');
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <Wordmark />
      <View style={styles.spacer} />
      <Text style={styles.title}>Ready to train?</Text>
      <Text style={styles.subtitle}>Pick up where you left off, or jump into a new team.</Text>

      {continueSquad && lastPlayed && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/team/[squadId]/difficulty',
              params: { squadId: continueSquad.id },
            })
          }
          style={styles.continueCard}
          accessibilityRole="button"
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: continueSquad.primaryColor ?? colors.textMuted },
            ]}
          />
          <View style={styles.continueText}>
            <Text style={styles.continueName}>{continueSquad.name}</Text>
            <Text style={styles.continueMeta}>
              LEVEL {lastPlayed.level}
              {continueBest !== undefined ? ` · BEST ${continueBest}/10` : ''}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}

      <View style={styles.actions}>
        <Button label="Start Training" variant="filled" large onPress={startTraining} />
        <Button
          label="Browse All Teams"
          variant="text"
          onPress={() => router.push('/team-picker')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  spacer: { flex: 1 },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: { ...typography.secondary, color: colors.textSecondary, marginBottom: spacing.xxl },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    marginBottom: spacing.xxl,
  },
  dot: { width: sizes.teamDot, height: sizes.teamDot, borderRadius: sizes.teamDot, flexShrink: 0 },
  continueText: { flex: 1, minWidth: 0 },
  continueName: { ...typography.rowTitle, color: colors.textPrimary },
  continueMeta: { ...typography.statMonoTiny, color: colors.textMuted, marginTop: spacing.xxs - 2 },
  chevron: { fontSize: iconSize.chevronLarge, color: colors.textMuted },
  actions: { gap: spacing.md },
});
