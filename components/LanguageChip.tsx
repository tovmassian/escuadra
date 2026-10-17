import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LanguageSheet } from '@/components/LanguageSheet';
import { languageChipCode } from '@/i18n/languageOptions';
import { LANGUAGE_NAMES } from '@/i18n/names';
import { useLanguage, useT } from '@/i18n/useT';
import { borderWidths, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The language chip (#143): the resolved language as a two-letter code, beside
// the theme toggle on Home, opening the language sheet. It is drawn at the
// toggle's height and reaches the 44 pt tap target through hitSlop. It has no
// fixed width or height, so it grows with the OS text size.
export function LanguageChip() {
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const slop = (sizes.minTapTarget - sizes.languageChip.minHeight) / 2;

  const styles = StyleSheet.create({
    chip: {
      minHeight: sizes.languageChip.minHeight,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    code: { ...typography.statMonoTiny, color: colors.textPrimary },
  });

  return (
    <>
      <Pressable
        testID="language-chip"
        onPress={() => setOpen(true)}
        hitSlop={slop}
        accessibilityRole="button"
        accessibilityLabel={t.home.languageLabel(LANGUAGE_NAMES[language])}
        style={styles.chip}
      >
        <Text style={styles.code}>{languageChipCode(language)}</Text>
      </Pressable>
      <LanguageSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
