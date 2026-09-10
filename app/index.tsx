import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Wordmark } from '@/components/Wordmark';
import { getRoster, getSquad } from '@/lib/squads';
import { scoreKey, useProgress, useProgressHydrated } from '@/stores/progress';
import { useSession } from '@/stores/session';
import {
  celebrationEasingCurves,
  celebrationRiseDuration,
  homeCascade,
  iconSize,
  radii,
  sizes,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

const riseEasing = Easing.bezier(...celebrationEasingCurves.rise);

export default function Home() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
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

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    aboutLink: { ...typography.secondarySmall, color: colors.textMuted },
    brandBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    dot: {
      width: sizes.teamDot,
      height: sizes.teamDot,
      borderRadius: sizes.teamDot,
      flexShrink: 0,
    },
    continueText: { flex: 1, minWidth: 0 },
    continueName: { ...typography.rowTitle, color: colors.textPrimary },
    continueMeta: {
      ...typography.statMonoTiny,
      color: colors.textMuted,
      marginTop: spacing.xxs - 2,
    },
    chevron: { fontSize: iconSize.chevronLarge, color: colors.textMuted },
    actions: { gap: spacing.md },
  });

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.toggleRow}>
        <Pressable onPress={() => router.push('/about')} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.aboutLink}>About</Text>
        </Pressable>
        <ThemeToggle />
      </View>

      <View style={styles.brandBlock}>
        <Wordmark size={sizes.wordmarkMarkHero} stacked animate />
      </View>

      {continueSquad && lastPlayed && (
        <Animated.View
          entering={FadeInUp.duration(celebrationRiseDuration)
            .delay(homeCascade.continueCardDelay)
            .easing(riseEasing)}
        >
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
        </Animated.View>
      )}

      <View style={styles.actions}>
        <Animated.View
          entering={FadeInUp.duration(celebrationRiseDuration)
            .delay(homeCascade.actionsBase)
            .easing(riseEasing)}
        >
          <Button label="Start Training" variant="filled" large onPress={startTraining} />
        </Animated.View>
        <Animated.View
          entering={FadeInUp.duration(celebrationRiseDuration)
            .delay(homeCascade.actionsBase + homeCascade.actionsStep)
            .easing(riseEasing)}
        >
          <Button
            label="Browse All Teams"
            variant="text"
            onPress={() => router.push('/team-picker')}
          />
        </Animated.View>
      </View>
    </View>
  );
}
