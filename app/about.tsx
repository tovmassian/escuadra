import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LicencesSheet } from '@/components/LicencesSheet';
import { translationNotice } from '@/i18n/translationNotice';
import { useLanguage, useT } from '@/i18n/useT';
import { versionLabel } from '@/lib/settingsView';
import { useProgress } from '@/stores/progress';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export default function About() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const notice = translationNotice(useLanguage());
  const last = (i: number, list: readonly unknown[]) => i === list.length - 1;
  const telemetryEnabled = useProgress((s) => s.telemetryEnabled);
  const setTelemetryEnabled = useProgress((s) => s.setTelemetryEnabled);
  const [licencesOpen, setLicencesOpen] = useState(false);
  const haptics = useProgress((s) => s.haptics);
  const setHaptics = useProgress((s) => s.setHaptics);

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
          <Text style={styles.back}>‹ {t.common.back}</Text>
        </Pressable>
        <Text style={styles.title}>{t.about.title}</Text>

        <View style={styles.section}>
          {t.about.intro.map((p, i, all) => (
            <Text key={i} style={[styles.paragraph, last(i, all) && { marginBottom: 0 }]}>
              {p}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t.about.credits.heading}</Text>
          {t.about.credits.sections.map((section) => (
            <Fragment key={section.heading}>
              <Text style={styles.subHeading}>{section.heading}</Text>
              {section.paragraphs.map((p, i) => (
                <Text key={i} style={styles.paragraph}>
                  {p}
                </Text>
              ))}
            </Fragment>
          ))}
          <Pressable
            testID="about-licences"
            onPress={() => setLicencesOpen(true)}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.subHeading, { marginBottom: 0 }]}>{t.about.licences.label} ›</Text>
          </Pressable>
        </View>

        <View style={[styles.section, styles.settingRow]}>
          <Text style={styles.settingLabel} nativeID="haptics-label">
            {t.about.vibration}
          </Text>
          <Switch
            testID="haptics-toggle"
            accessibilityLabelledBy="haptics-label"
            accessibilityLabel={t.about.vibration}
            value={haptics}
            onValueChange={setHaptics}
            trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
            thumbColor={colors.thumbBg}
            ios_backgroundColor={colors.surfaceRaised}
          />
        </View>

        <View style={[styles.section, styles.settingRow]}>
          <Text style={styles.settingLabel} nativeID="telemetry-label">
            {t.about.usageStatistics}
          </Text>
          <Switch
            testID="telemetry-toggle"
            accessibilityLabelledBy="telemetry-label"
            accessibilityLabel={t.about.usageStatistics}
            value={telemetryEnabled}
            onValueChange={setTelemetryEnabled}
            trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
            thumbColor={colors.thumbBg}
            ios_backgroundColor={colors.surfaceRaised}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t.about.privacy.heading}</Text>

          <Text style={styles.paragraphEmphasis}>{t.about.privacy.lead}</Text>

          {t.about.privacy.paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))}

          {t.about.privacy.sections.map((section, s, sections) => (
            <Fragment key={section.heading}>
              <Text style={styles.subHeading}>{section.heading}</Text>
              {section.paragraphs.map((p, i, all) => (
                <Text
                  key={i}
                  style={[
                    styles.paragraph,
                    // Only the card's last paragraph drops its bottom margin;
                    // with a translation notice, the notice is the last one.
                    last(s, sections) && last(i, all) && !notice && { marginBottom: 0 },
                  ]}
                >
                  {p}
                </Text>
              ))}
            </Fragment>
          ))}
          {notice && <Text style={[styles.paragraph, { marginBottom: 0 }]}>{notice}</Text>}
        </View>

        <Text style={styles.versionLine}>
          {versionLabel(
            version,
            {
              isEnabled: Updates.isEnabled,
              isEmbeddedLaunch: Updates.isEmbeddedLaunch,
              updateId: Updates.updateId,
              channel: Updates.channel,
              manifest: Updates.manifest,
            },
            t,
          )}
        </Text>
      </ScrollView>
      <LicencesSheet visible={licencesOpen} onClose={() => setLicencesOpen(false)} />
    </View>
  );
}
