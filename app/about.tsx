import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export default function About() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';
  const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? '—';

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
    versionLine: {
      ...typography.statMonoTiny,
      color: colors.textMuted,
      marginTop: spacing.xl,
      marginBottom: spacing.xl,
      textAlign: 'center',
    },
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
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
            Escuadra is an independent, unofficial app. It is not affiliated with,
            endorsed by, or associated with FIFA, UEFA, any league, any national
            football association, or any club. Club and national team names are
            used for identification only and remain the property of their
            respective owners.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Squad data is compiled from Wikipedia and reflects the season shown
            on each team. Wikipedia content is available under CC BY-SA.
          </Text>
          <Text style={[styles.paragraph, { marginBottom: 0 }]}>
            Flag images are from flagpedia.net and are in the public domain.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Privacy</Text>

          <Text style={styles.paragraphEmphasis}>
            Escuadra does not collect any data about you.
          </Text>

          <Text style={styles.paragraph}>
            The app works entirely offline. It makes no network requests of any
            kind. There is no account, no sign-in, and no analytics or tracking
            software. Nothing you do in the app is transmitted anywhere, because
            the app has no way to transmit anything.
          </Text>

          <Text style={styles.subHeading}>What is stored on your device</Text>
          <Text style={styles.paragraph}>
            Escuadra saves four things locally, on your device only: your best
            score for each team and difficulty level; which levels you have
            completed; the last team and level you played; and your light or
            dark appearance preference.
          </Text>
          <Text style={styles.paragraph}>
            This lives in the app&apos;s own private storage and never leaves
            your phone. Deleting the app deletes it. There is no backup and no
            sync, and no way for anyone — including the developer — to read it.
          </Text>

          <Text style={styles.subHeading}>Crash reports</Text>
          <Text style={styles.paragraph}>
            If you have chosen to share analytics and diagnostics with Apple in
            your iOS settings, Apple may pass on anonymised crash reports about
            this app. That is handled entirely by Apple and controlled by your
            iOS settings. Escuadra itself sends nothing.
          </Text>

          <Text style={styles.subHeading}>Children</Text>
          <Text style={[styles.paragraph, { marginBottom: 0 }]}>
            Escuadra collects no data from anyone, including children.
          </Text>
        </View>

        <Text style={styles.versionLine}>
          Version {version} ({build})
        </Text>
      </ScrollView>
    </View>
  );
}
