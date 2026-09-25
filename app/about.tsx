import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { versionLabel } from '@/lib/aboutView';
import { useProgress } from '@/stores/progress';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export default function About() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const telemetryEnabled = useProgress((s) => s.telemetryEnabled);
  const setTelemetryEnabled = useProgress((s) => s.setTelemetryEnabled);

  const version = Constants.expoConfig?.version ?? '—';

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: spacing.lg },
    back: { ...typography.secondary, color: colors.textSecondary },
    title: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.md },
    section: {
      marginTop: spacing.xl,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
    },
    sectionHeading: {
      ...typography.sectionHead,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    subHeading: {
      ...typography.body,
      color: colors.textPrimary,
      marginTop: spacing.md,
      marginBottom: spacing.xxs,
    },
    paragraph: {
      ...typography.secondary,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    paragraphEmphasis: {
      ...typography.bodyEmphasis,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    settingLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
    versionLine: {
      ...typography.statMonoTiny,
      color: colors.textMuted,
      marginTop: spacing.xl,
      marginBottom: spacing.xl,
      textAlign: 'center',
    },
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>About</Text>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Escuadra is an independent, unofficial app. It is not affiliated with, endorsed by, or
            associated with FIFA, UEFA, any league, any national football association, or any club.
            Club and national team names are used for identification only and remain the property of
            their respective owners.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Squad data is compiled from Wikipedia and reflects the season shown on each team.
            Wikipedia content is available under CC BY-SA.
          </Text>
          <Text style={[styles.paragraph, { marginBottom: 0 }]}>
            Flag images are from flagpedia.net and are in the public domain.
          </Text>
        </View>

        <View style={[styles.section, styles.settingRow]}>
          <Text style={styles.settingLabel} nativeID="telemetry-label">
            Share anonymous usage statistics
          </Text>
          <Switch
            testID="telemetry-toggle"
            accessibilityLabelledBy="telemetry-label"
            accessibilityLabel="Share anonymous usage statistics"
            value={telemetryEnabled}
            onValueChange={setTelemetryEnabled}
            trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
            thumbColor={colors.thumbBg}
            ios_backgroundColor={colors.surfaceRaised}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Privacy</Text>

          <Text style={styles.paragraphEmphasis}>
            Escuadra does not collect any personal data about you.
          </Text>

          <Text style={styles.paragraph}>
            There is no account, no sign-in, and no advertising, analytics or tracking software.
            Your scores and settings never leave your device.
          </Text>

          <Text style={styles.subHeading}>App updates</Text>
          <Text style={styles.paragraph}>
            When Escuadra starts, it checks whether a newer version of the app is available from
            Expo, the service that delivers its updates. The check sends only what is needed to
            deliver the right update: your device&apos;s operating system, the app&apos;s version,
            and a random identifier created for this installation. The identifier is not linked to
            you or to anything you do in the app. Without a connection, the app works fully offline
            and skips the check.
          </Text>

          <Text style={styles.subHeading}>What is stored on your device</Text>
          <Text style={styles.paragraph}>
            Escuadra saves four things locally, on your device only: your best score for each team
            and difficulty level; which levels you have completed; the last team and level you
            played; and your light or dark appearance preference.
          </Text>
          <Text style={styles.paragraph}>
            This lives in the app&apos;s own private storage and never leaves your phone. Deleting
            the app deletes it. There is no backup and no sync, and no way for anyone — including
            the developer — to read it.
          </Text>

          <Text style={styles.subHeading}>Crash reports</Text>
          <Text style={styles.paragraph}>
            If you allow your device to share diagnostics, Apple (on iOS) or Google (on Android) may
            share anonymised crash reports with the developer. That is handled by Apple or Google
            and controlled in your device settings. Escuadra itself sends no crash reports.
          </Text>

          <Text style={styles.subHeading}>Children</Text>
          <Text style={[styles.paragraph, { marginBottom: 0 }]}>
            Escuadra collects no personal data from anyone, including children.
          </Text>
        </View>

        <Text style={styles.versionLine}>
          {versionLabel(version, {
            isEnabled: Updates.isEnabled,
            isEmbeddedLaunch: Updates.isEmbeddedLaunch,
            updateId: Updates.updateId,
            channel: Updates.channel,
            manifest: Updates.manifest,
          })}
        </Text>
      </ScrollView>
    </View>
  );
}
