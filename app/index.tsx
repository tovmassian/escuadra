import * as Font from 'expo-font';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnswerOption, type OptionVerdict } from '@/components/AnswerOption';
import { scoreKey, useProgress, useProgressHydrated } from '@/stores/progress';
import { fontAssets, type FontFamily } from '@/theme/fonts';
import { colors, radii, spacing, teamAccents, typography } from '@/theme/tokens';

const FONT_NAMES = Object.keys(fontAssets) as FontFamily[];

const DEMO_KEY = scoreKey('setup', 0);
const DEMO_OPTIONS = ['Lamine Yamal', 'Nico Williams', 'Pedri', 'Rodri'];
const DEMO_CORRECT = 2;

export default function SetupCheck() {
  const insets = useSafeAreaInsets();
  const hydrated = useProgressHydrated();
  const best = useProgress((s) => s.bestScores[DEMO_KEY] ?? 0);
  const recordScore = useProgress((s) => s.recordScore);
  const resetProgress = useProgress((s) => s.reset);

  const [picked, setPicked] = useState<number | null>(null);

  const missingFonts = FONT_NAMES.filter((n) => !Font.isLoaded(n));

  const verdictFor = useCallback(
    (i: number): OptionVerdict => {
      if (picked === null) return 'unanswered';
      if (i === DEMO_CORRECT) return 'correct';
      if (i === picked) return 'incorrect-picked';
      return 'incorrect-other';
    },
    [picked],
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxxl },
      ]}
    >
      <View>
        <Text style={styles.eyebrow}>Escuadra · v0</Text>
        <Text style={styles.title}>Setup check</Text>
        <Text style={styles.subtitle}>
          Each block exercises one part of the stack. If they all look right on the phone, the
          foundation is sound and we can start building the game.
        </Text>
      </View>

      <Section title="Fonts">
        <Row label="All families loaded" ok={missingFonts.length === 0} />
        {missingFonts.length > 0 && (
          <Text style={styles.warn}>Missing: {missingFonts.join(', ')}</Text>
        )}
        <Text style={styles.heroNumber}>23</Text>
        <Text style={styles.caption}>heroNumber · IBM Plex Mono Bold 96</Text>
        <Text style={[typography.screenTitle, styles.sample]}>Screen title</Text>
        <Text style={[typography.sectionHead, styles.sample]}>Section head</Text>
        <Text style={[typography.body, styles.sample]}>Body — the quick brown fox</Text>
        <Text style={[typography.secondary, styles.sample]}>Secondary — the quick brown fox</Text>
        <Text style={[typography.statMono, styles.sample]}>statMono 0123456789</Text>
        <Text style={[typography.eyebrow, styles.sample]}>Eyebrow label</Text>
      </Section>

      <Section title="Colour tokens">
        <View style={styles.swatchRow}>
          {SWATCHES.map(([name, value]) => (
            <View key={name} style={styles.swatchCell}>
              <View style={[styles.swatch, { backgroundColor: value }]} />
              <Text style={styles.swatchLabel}>{name}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.caption}>Team accents</Text>
        <View style={styles.accentRow}>
          {Object.entries(teamAccents).map(([id, hex]) => (
            <View key={id} style={[styles.accentDot, { backgroundColor: hex }]} />
          ))}
        </View>
      </Section>

      <Section title="Safe area">
        <Text style={styles.mono}>
          top {insets.top} · bottom {insets.bottom} · left {insets.left} · right {insets.right}
        </Text>
        <Text style={styles.caption}>
          On an iPhone 15 Pro expect top ≈ 59 and bottom ≈ 34. All zeroes means the provider is
          missing.
        </Text>
      </Section>

      <Section title="Haptics">
        <View style={styles.buttonRow}>
          <SmallButton
            label="Light"
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
          <SmallButton
            label="Success"
            onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
          />
          <SmallButton
            label="Error"
            onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)}
          />
        </View>
        <Text style={styles.caption}>
          Three distinct taps. Silent mode does not suppress haptics on iOS.
        </Text>
      </Section>

      <Section title="Reanimated + design system">
        <Text style={styles.caption}>
          Tap an option. Colour, border, scale pop and haptics all come from AnswerOption.
        </Text>
        <View style={styles.options}>
          {DEMO_OPTIONS.map((label, i) => (
            <AnswerOption
              key={label}
              label={label}
              verdict={verdictFor(i)}
              disabled={picked !== null}
              onPress={() => setPicked(i)}
            />
          ))}
        </View>
        <View style={styles.buttonRow}>
          <SmallButton label="Reset options" onPress={() => setPicked(null)} />
        </View>
      </Section>

      <Section title="Persistence">
        <Row label="Rehydrated from AsyncStorage" ok={hydrated} />
        <Text style={styles.mono}>
          bestScores[{DEMO_KEY}] = {best}
        </Text>
        <View style={styles.buttonRow}>
          <SmallButton label="Record higher" onPress={() => recordScore('setup', 0, best + 1)} />
          <SmallButton label="Clear" onPress={resetProgress} />
        </View>
        <Text style={styles.caption}>
          Bump it, fully quit Expo Go, reopen. The value must come back.
        </Text>
      </Section>

      <Section title="Navigation">
        <Link href="/motion" asChild>
          <Pressable style={styles.linkButton} accessibilityRole="button">
            <Text style={styles.linkButtonText}>Open motion check →</Text>
          </Pressable>
        </Link>
      </Section>
    </ScrollView>
  );
}

const SWATCHES: [string, string][] = [
  ['surface', colors.surface],
  ['raised', colors.surfaceRaised],
  ['accent', colors.accent],
  ['success', colors.success],
  ['error', colors.error],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkMark, { color: ok ? colors.success : colors.error }]}>
        {ok ? '✓' : '✕'}
      </Text>
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.smallButton, pressed && styles.smallButtonPressed]}
    >
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.xxs },
  subtitle: { ...typography.secondary, color: colors.textSecondary, marginTop: spacing.xs },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  sectionTitle: { ...typography.sectionHead, color: colors.textPrimary },
  sectionBody: { marginTop: spacing.sm, gap: spacing.xs },
  sample: { color: colors.textPrimary },
  caption: { ...typography.secondary, fontSize: 13, color: colors.textMuted },
  warn: { ...typography.secondary, fontSize: 13, color: colors.error },
  mono: { ...typography.statMono, color: colors.textSecondary },
  heroNumber: { ...typography.heroNumber, color: colors.textPrimary, lineHeight: 104 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  checkMark: { fontSize: 16, fontWeight: '700' },
  checkLabel: { ...typography.secondary, color: colors.textSecondary },
  swatchRow: { flexDirection: 'row', gap: spacing.xs },
  swatchCell: { alignItems: 'center', gap: spacing.xxs, flex: 1 },
  swatch: {
    width: '100%',
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchLabel: { ...typography.eyebrow, fontSize: 9, color: colors.textMuted, letterSpacing: 0.6 },
  accentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
  accentDot: { width: 18, height: 18, borderRadius: radii.pill },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  options: { gap: spacing.xs, marginTop: spacing.xxs },
  smallButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  smallButtonPressed: { opacity: 0.6 },
  smallButtonText: { ...typography.secondary, color: colors.textPrimary },
  linkButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  linkButtonText: { ...typography.body, color: colors.accentOn },
});
