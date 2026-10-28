import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useRef } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
  type TextInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTitleFocus } from '@/hooks/useTitleFocus';
import { translationNotice } from '@/i18n/translationNotice';
import { useLanguage, useT } from '@/i18n/useT';
import { fontScaleCap, radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export default function About() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const notice = translationNotice(useLanguage());
  const last = (i: number, list: readonly unknown[]) => i === list.length - 1;
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrolledTo = useRef(false);
  // Opened at Privacy, a screen reader starts there, where the screen is scrolled
  // to: below the title and the intro, so it is moved there on iOS too.
  const titleRef = useRef<TextInstance>(null);
  const privacyRef = useRef<TextInstance>(null);
  const atPrivacy = sectionParam === 'privacy';
  const titleFocus = useTitleFocus(atPrivacy ? privacyRef : titleRef, true, atPrivacy);
  // Settings' Privacy row opens About at its Privacy card (#175).
  const onPrivacyLayout = (e: LayoutChangeEvent) => {
    if (!atPrivacy || scrolledTo.current) return;
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
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={12}
          {...titleFocus.chrome}
        >
          <Text style={styles.back}>‹ {t.common.back}</Text>
        </Pressable>
        <Text
          ref={titleRef}
          style={styles.title}
          accessibilityRole="header"
          maxFontSizeMultiplier={fontScaleCap.display}
        >
          {t.about.title}
        </Text>

        <View style={styles.section}>
          {t.about.intro.map((p, i, all) => (
            <Text key={i} style={[styles.paragraph, last(i, all) && { marginBottom: 0 }]}>
              {p}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading} accessibilityRole="header">
            {t.about.credits.heading}
          </Text>
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
            onPress={() => router.push('/licences')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.subHeading, { marginBottom: 0 }]}>{t.about.licences.label} ›</Text>
          </Pressable>
        </View>

        {/* Must stay a direct child of the ScrollView's content: onLayout's y is the scroll offset. */}
        <View style={styles.section} onLayout={onPrivacyLayout}>
          <Text ref={privacyRef} style={styles.sectionHeading} accessibilityRole="header">
            {t.about.privacy.heading}
          </Text>

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
    </View>
  );
}
