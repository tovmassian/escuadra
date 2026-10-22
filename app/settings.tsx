import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppearanceControl } from '@/components/AppearanceControl';
import { BrandGradient } from '@/components/BrandGradient';
import { EscuadraMark } from '@/components/EscuadraMark';
import { LanguageSheet } from '@/components/LanguageSheet';
import { RoundBackButton } from '@/components/RoundBackButton';
import {
  BookGlyph,
  ChartGlyph,
  ChevronGlyph,
  ClockGlyph,
  DocumentGlyph,
  GlobeGlyph,
  InfoGlyph,
  MoonGlyph,
  VibrationGlyph,
} from '@/components/SettingsGlyphs';
import { SettingsRow, SettingsSection } from '@/components/SettingsSection';
import { LANGUAGE_NAMES } from '@/i18n/names';
import { useLanguage, useT } from '@/i18n/useT';
import { versionLabel } from '@/lib/settingsView';
import { openStorePage } from '@/lib/storeReview';
import { useProgress } from '@/stores/progress';
import { borderWidths, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Settings (#175; spec docs/superpowers/specs/2026-10-22-settings-screen-design.md):
// the preferences that were on Home and About, Rate, Coming next, the About links and
// the version line.
export default function Settings() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const haptics = useProgress((s) => s.haptics);
  const setHaptics = useProgress((s) => s.setHaptics);
  const telemetryEnabled = useProgress((s) => s.telemetryEnabled);
  const setTelemetryEnabled = useProgress((s) => s.setTelemetryEnabled);
  const [languageOpen, setLanguageOpen] = useState(false);
  const version = Constants.expoConfig?.version ?? '—';
  const glyph = colors.textSecondary;
  const g = sizes.settings;

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.lg, gap: spacing.lg + 2 },
    header: { gap: spacing.md + 2 },
    title: { ...typography.displayTitle, color: colors.textPrimary },
    value: { ...typography.secondary, color: colors.textSecondary },
    appearance: {
      gap: spacing.sm,
      padding: spacing.md,
      borderBottomWidth: borderWidths.hairline,
      borderBottomColor: colors.hairline,
    },
    appearanceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
    appearanceLabel: { ...typography.settingsLabel, color: colors.textPrimary },
    plate: {
      width: g.plate,
      height: g.plate,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rate: {
      height: g.rateButton,
      paddingHorizontal: spacing.md + 2,
      borderRadius: radii.pill,
      backgroundColor: colors.ctaBg,
      justifyContent: 'center',
    },
    rateLabel: { ...typography.settingsAction, color: colors.ctaText },
    soon: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs - 1,
      borderRadius: radii.pill,
      backgroundColor: colors.soonBg,
    },
    soonLabel: { ...typography.soonChip, color: colors.textSecondary },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingTop: spacing.xxs,
    },
    version: { ...typography.statMonoTiny, color: colors.textMuted },
  });

  const switchProps = {
    trackColor: { false: colors.surfaceRaised, true: colors.brandBright },
    thumbColor: colors.switchThumb,
    // react-native-web uses thumbColor for the off state only; native ignores this.
    activeThumbColor: colors.switchThumb,
    ios_backgroundColor: colors.surfaceRaised,
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl },
        ]}
      >
        <View style={styles.header}>
          <RoundBackButton
            testID="settings-back"
            label={t.common.back}
            onPress={() => router.back()}
          />
          <Text style={styles.title} accessibilityRole="header">
            {t.settings.title}
          </Text>
        </View>

        <SettingsSection label={t.settings.sections.play}>
          <SettingsRow
            testID="settings-language"
            icon={<GlobeGlyph color={glyph} />}
            label={t.settings.language}
            accessibilityLabel={t.settings.languageSpoken(LANGUAGE_NAMES[language])}
            onPress={() => setLanguageOpen(true)}
            accessory={
              <>
                <Text testID="settings-language-value" style={styles.value}>
                  {LANGUAGE_NAMES[language]}
                </Text>
                <ChevronGlyph color={colors.textMuted} />
              </>
            }
          />
          <View style={styles.appearance}>
            <View style={styles.appearanceHead}>
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <MoonGlyph color={glyph} ground={colors.surface} />
              </View>
              <Text style={styles.appearanceLabel}>{t.settings.appearance}</Text>
            </View>
            <AppearanceControl />
          </View>
          <SettingsRow
            last
            icon={<VibrationGlyph color={glyph} />}
            label={t.settings.vibration}
            textHidden
            accessory={
              <Switch
                testID="haptics-toggle"
                accessibilityLabel={t.settings.vibration}
                value={haptics}
                onValueChange={setHaptics}
                {...switchProps}
              />
            }
          />
        </SettingsSection>

        <SettingsSection label={t.settings.sections.privacy}>
          <SettingsRow
            last
            icon={<ChartGlyph color={glyph} />}
            label={t.settings.usageStatistics}
            note={t.settings.usageNote}
            textHidden
            accessory={
              <Switch
                testID="telemetry-toggle"
                accessibilityLabel={t.settings.usageStatistics}
                accessibilityHint={t.settings.usageNote}
                value={telemetryEnabled}
                onValueChange={setTelemetryEnabled}
                {...switchProps}
              />
            }
          />
        </SettingsSection>

        <SettingsSection label={t.settings.sections.support}>
          <SettingsRow
            last
            icon={
              <BrandGradient gradient="plate" style={styles.plate}>
                <EscuadraMark size={g.plateMark} color={colors.plateMark} />
              </BrandGradient>
            }
            label={t.settings.rate.title}
            note={t.settings.rate.line}
            accessory={
              <Pressable
                testID="settings-rate"
                onPress={openStorePage}
                accessibilityRole="button"
                accessibilityLabel={t.settings.rate.title}
                hitSlop={(sizes.minTapTarget - g.rateButton) / 2}
                style={({ pressed }) => [styles.rate, pressed && { opacity: opacity.settled }]}
              >
                <Text style={styles.rateLabel}>{t.settings.rate.button}</Text>
              </Pressable>
            }
          />
        </SettingsSection>

        <SettingsSection label={t.settings.sections.comingNext} dashed>
          <View accessible>
            <SettingsRow
              last
              muted
              icon={<ClockGlyph color={colors.textMuted} />}
              label={t.examMode.title}
              note={t.examMode.line}
              accessory={
                <View style={styles.soon}>
                  <Text style={styles.soonLabel}>{t.examMode.soon}</Text>
                </View>
              }
            />
          </View>
        </SettingsSection>

        <SettingsSection label={t.settings.sections.about}>
          <SettingsRow
            testID="settings-about"
            minHeight={g.linkRow}
            icon={<InfoGlyph color={glyph} />}
            label={t.settings.aboutEscuadra}
            onPress={() => router.push('/about')}
            accessory={<ChevronGlyph color={colors.textMuted} />}
          />
          <SettingsRow
            testID="settings-privacy"
            minHeight={g.linkRow}
            icon={<DocumentGlyph color={glyph} />}
            label={t.settings.privacy}
            onPress={() => router.push({ pathname: '/about', params: { section: 'privacy' } })}
            accessory={<ChevronGlyph color={colors.textMuted} />}
          />
          <SettingsRow
            last
            testID="settings-licences"
            minHeight={g.linkRow}
            icon={<BookGlyph color={glyph} />}
            label={t.settings.licences}
            onPress={() => router.push('/licences')}
            accessory={<ChevronGlyph color={colors.textMuted} />}
          />
        </SettingsSection>

        <View style={styles.footer}>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <EscuadraMark size={g.footerMark} color={colors.mark} />
          </View>
          <Text style={styles.version}>
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
        </View>
      </ScrollView>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </View>
  );
}
