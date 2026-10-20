import { Sheet } from '@/components/Sheet';
import { useT } from '@/i18n/useT';
import { LICENCE_TEXTS, PACKAGES, UNICODE_LICENSE } from '@/lib/licences.generated';
import { BUNDLED_FONTS, UNICODE_CREDIT, licenceParagraphs, packageKey } from '@/lib/licencesView';
import { spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const UNICODE_KEY = 'unicode';

// About → Licences (#156): the notices other people's data and code ask to
// travel with the app. The Unicode notice for the country names opens
// expanded, because it is the one this sheet exists for; the fonts are named,
// since each font file carries its own notice; every bundled package follows,
// its full text a tap away. Notices are shown in English, as written, and
// everything is in the bundle, so the sheet works offline and sends nothing.
//
// The body is its own component because Sheet mounts its children only while
// it is open: what is expanded resets at every opening, and the 77 rows are
// built only while the sheet is shown, not on every About render.
export function LicencesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t.about.licences.label} testID="licences">
      <LicencesBody />
    </Sheet>
  );
}

function LicencesBody() {
  const colors = useThemeColors();
  const t = useT();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set([UNICODE_KEY]));
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const styles = StyleSheet.create({
    // Shrinks, and scrolls, when the sheet is capped.
    list: { flexShrink: 1 },
    listContent: { gap: spacing.md, paddingBottom: spacing.md },
    note: { ...typography.secondarySmall, color: colors.textMuted },
    section: { gap: spacing.sm },
    sectionName: { ...typography.captionEyebrow, color: colors.textMuted },
    row: { gap: spacing.xxs },
    rowTitle: { ...typography.rowTitle, color: colors.textPrimary },
    meta: { ...typography.secondarySmall, color: colors.textMuted },
    text: { ...typography.descriptionSmall, color: colors.textSecondary, marginTop: spacing.xs },
  });

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
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.listContent}
      alwaysBounceVertical={false}
    >
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
          {t.about.licences.software} · {PACKAGES.length}
        </Text>
        {PACKAGES.map((p) =>
          row(
            packageKey(p),
            `${p.name} ${p.version}`,
            `${p.licence} · ${p.copyright.replace(/\n/g, ' ')}`,
            p.texts.flatMap((i) => LICENCE_TEXTS[i] ?? []),
          ),
        )}
      </View>
    </ScrollView>
  );
}
