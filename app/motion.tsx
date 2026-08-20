import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/theme/tokens';

const TOTAL = 5;
const CHIPS = ['GK', 'DF', 'MF', 'FW'];

export default function MotionCheck() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [index, setIndex] = useState(0);
  const [visibleChips, setVisibleChips] = useState(CHIPS);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const advance = () => {
    const next = (index + 1) % TOTAL;
    setIndex(next);
    progress.value = withTiming(next / (TOTAL - 1), {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  };

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  const toggleChips = () =>
    setVisibleChips((c) => (c.length === CHIPS.length ? CHIPS.slice(0, 2) : CHIPS));

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Motion check</Text>
      <Text style={styles.caption}>
        Everything here runs on the Reanimated UI thread. Stutter or no movement at all means the
        worklets plugin is not active — restart Metro with a cleared cache.
      </Text>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, progressStyle]} />
      </View>
      <Text style={styles.mono}>
        question {index + 1} / {TOTAL}
      </Text>

      <Animated.View
        key={index}
        entering={SlideInRight.duration(220)}
        exiting={SlideOutLeft.duration(180)}
        style={styles.card}
      >
        <Text style={styles.cardEyebrow}>Shirt number</Text>
        <Text style={styles.cardNumber}>{(index + 1) * 3}</Text>
      </Animated.View>

      <Animated.View style={shakeStyle}>
        <Button label="Shake (wrong answer)" onPress={shake} />
      </Animated.View>
      <Button label="Next question" onPress={advance} />
      <Button label="Toggle chips (layout)" onPress={toggleChips} />

      <View style={styles.chipRow}>
        {visibleChips.map((c) => (
          <Animated.View
            key={c}
            layout={LinearTransition.springify()}
            entering={FadeIn.duration(180)}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{c}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  back: { ...typography.secondary, color: colors.accent },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  caption: { ...typography.secondary, fontSize: 13, color: colors.textMuted },
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.accent },
  mono: { ...typography.statMono, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  cardEyebrow: { ...typography.eyebrow, color: colors.textMuted },
  cardNumber: { ...typography.heroNumber, color: colors.textPrimary, lineHeight: 104 },
  button: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.6 },
  buttonText: { ...typography.body, color: colors.textPrimary },
  chipRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  chipText: { ...typography.statMono, color: colors.textSecondary },
});
