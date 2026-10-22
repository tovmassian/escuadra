import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LicencesSheet } from '@/components/LicencesSheet';
import { translationNotice } from '@/i18n/translationNotice';
import { useLanguage, useT } from '@/i18n/useT';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export default function About() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const notice = translationNotice(useLanguage());
  const last = (i: number, list: readonly unknown[]) => i === list.length - 1;
  const [licencesOpen, setLicencesOpen] = useState(false);
  const { section } = useLocalSearchParams<{ section?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const scrolledTo = useRef(false);
  // Settings' Privacy row opens About at its Privacy card (#175).
  const onPrivacyLayout = (e: LayoutChangeEvent) => {
    if (section !== 'privacy' || scrolledTo.current) return;
    scrolledTo.current = true;
    scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: false });
  };

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
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <ScrollView
        ref={scrollRef}
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

        <View style={styles.section} onLayout={onPrivacyLayout}>
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
      </ScrollView>
      <LicencesSheet visible={licencesOpen} onClose={() => setLicencesOpen(false)} />
    </View>
  );
}
