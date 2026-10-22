import { useLocales } from 'expo-localization';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { languageRows } from '@/i18n/languageOptions';
import { LANGUAGE_NAMES } from '@/i18n/names';
import { SUPPORTED_LANGUAGES } from '@/i18n/resolveLanguage';
import { useT } from '@/i18n/useT';
import { useProgress } from '@/stores/progress';
import { borderWidths, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface LanguageSheetProps {
  visible: boolean;
  onClose: () => void;
}

// The language picker (#143): "Match phone", then each supported language in
// its own name. A tap stores the preference and closes the sheet; every screen
// reads its text through `useT()`, so the switch shows at once, with no restart.
export function LanguageSheet({ visible, onClose }: LanguageSheetProps) {
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t.languageSheet.title} testID="language">
      <LanguageRows onClose={onClose} />
    </Sheet>
  );
}

function LanguageRows({ onClose }: { onClose: () => void }) {
  const colors = useThemeColors();
  const t = useT();
  const locales = useLocales();
  const preference = useProgress((s) => s.languagePreference);
  const setLanguagePreference = useProgress((s) => s.setLanguagePreference);
  const rows = languageRows(
    SUPPORTED_LANGUAGES,
    locales.map((locale) => locale.languageTag),
  );
  const chip = sizes.languageSheet;

  const styles = StyleSheet.create({
    list: { gap: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: sizes.minTapTarget,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceRaised,
    },
    label: { ...typography.rowTitle, flex: 1, minWidth: 0, color: colors.textPrimary },
    radio: {
      width: chip.radio,
      height: chip.radio,
      borderRadius: chip.radio / 2,
      borderWidth: borderWidths.emphasis,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: colors.accent },
    dot: {
      width: chip.radioDot,
      height: chip.radioDot,
      borderRadius: chip.radioDot / 2,
      backgroundColor: colors.accent,
    },
  });

  return (
    <View style={styles.list}>
      {rows.map((row) => {
        const name = LANGUAGE_NAMES[row.language];
        const selected = row.preference === preference;
        const label = row.preference === 'system' ? t.languageSheet.matchPhone(name) : name;
        return (
          <Pressable
            key={row.preference}
            testID={`language-${row.preference}`}
            onPress={() => {
              setLanguagePreference(row.preference);
              onClose();
            }}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.row, pressed && { opacity: opacity.settled }]}
          >
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.radio, selected && styles.radioOn]}>
              {selected ? <View style={styles.dot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
