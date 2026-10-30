import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type TextInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTitleFocus } from '@/hooks/useTitleFocus';
import { useT } from '@/i18n/useT';
import {
  LICENCE_TEXTS,
  NATIVE_LIBRARIES,
  PACKAGES,
  UNICODE_LICENSE,
} from '@/lib/licences.generated';
import { BUNDLED_FONTS, UNICODE_CREDIT, licenceParagraphs, softwareRows } from '@/lib/licencesView';
import { fontScaleCap, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

const UNICODE_KEY = 'unicode';

// Licences (#156; a page of its own since #175, opened from Settings and from
// About, as About and Privacy are): the notices other people's data and code
// ask to travel with the app. The Unicode notice for the country names opens
// expanded, because it is the one this page exists for; the fonts are named,
// since each font file carries its own notice; every bundled or autolinked package
// and every native library the builds link (#160) follow, in one alphabetical list,
// its full text a tap away. Notices are shown in English, as written, and
// everything is in the bundle, so the page works offline and sends nothing.
// What is expanded resets each time the page opens.
export default function Licences() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set([UNICODE_KEY]));
  const titleRef = useRef<TextInstance>(null);
  const titleFocus = useTitleFocus(titleRef);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: spacing.lg },
    listContent: { gap: spacing.md },
    back: { ...typography.secondary, color: colors.textSecondary },
    title: { ...typography.screenTitle, color: colors.textPrimary },
    note: { ...typography.secondarySmall, color: colors.textMuted },
    section: { gap: spacing.sm },
    sectionName: { ...typography.captionEyebrow, color: colors.textMuted },
    row: { gap: spacing.xxs },
    rowTitle: { ...typography.rowTitle, color: colors.textPrimary },
    meta: { ...typography.secondarySmall, color: colors.textMuted },
    text: { ...typography.descriptionSmall, color: colors.textSecondary, marginTop: spacing.xs },
  });

  const software = softwareRows(PACKAGES, NATIVE_LIBRARIES);

  const body = (texts: readonly string[]) =>
    texts.flatMap((text, n) =>
      licenceParagraphs(text).map((p, i) => (
        <Text key={`${n}-${i}`} style={styles.text}>
          {p}
        </Text>
      )),
    );

  const row = (key: string, title: string, meta: string, texts: readonly string[]) => {
    const expanded = open.has(key);
    return (
      <View key={key} style={styles.row}>
        <Pressable
          testID={`licence-${key}`}
          onPress={() => toggle(key)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={styles.rowTitle}>
            {title}{' '}
            <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {expanded ? '▾' : '▸'}
            </Text>
          </Text>
          <Text style={styles.meta}>{meta}</Text>
        </Pressable>
        {expanded && body(texts)}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={spacing.sm}
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
          {t.about.licences.label}
        </Text>

        <Text style={styles.note}>{t.about.licences.originalLanguage}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionName} accessibilityRole="header">
            {t.about.licences.countryNames}
          </Text>
          {row(UNICODE_KEY, UNICODE_CREDIT.source, UNICODE_CREDIT.licence, [UNICODE_LICENSE])}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionName} accessibilityRole="header">
            {t.about.licences.fonts}
          </Text>
          {BUNDLED_FONTS.map((font) => (
            <View key={font.families.join()} style={styles.row}>
              <Text style={styles.rowTitle}>{font.families.join(' · ')}</Text>
              <Text style={styles.meta}>{font.licence}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionName} accessibilityRole="header">
            {t.about.licences.software} · {software.length}
          </Text>
          {software.map((r) =>
            row(
              r.key,
              r.title,
              r.meta,
              r.texts.flatMap((i) => LICENCE_TEXTS[i] ?? []),
            ),
          )}
        </View>
      </ScrollView>
    </View>
  );
}
