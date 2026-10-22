import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '@/i18n/useT';
import { useProgress } from '@/stores/progress';
import {
  borderWidths,
  radii,
  sizes,
  spacing,
  typography,
  type ThemePreference,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

const OPTIONS: readonly ThemePreference[] = ['system', 'dark', 'light'];
const segmentSlop = (sizes.minTapTarget - sizes.settings.segment) / 2;

// Settings' Appearance (#175): Match phone, Dark or Light, written straight to
// `themePreference`. A radio group, so a screen reader says which is chosen.
// aria-checked is for react-native-web, which does not read accessibilityState.
export function AppearanceControl() {
  const colors = useThemeColors();
  const t = useT();
  const preference = useProgress((s) => s.themePreference);
  const setThemePreference = useProgress((s) => s.setThemePreference);
  const styles = StyleSheet.create({
    track: {
      flexDirection: 'row',
      gap: spacing.xxs,
      padding: spacing.xxs,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
      borderWidth: borderWidths.hairline,
      borderColor: colors.hairline,
    },
    option: {
      flex: 1,
      minHeight: sizes.settings.segment,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxs,
    },
    label: { ...typography.switchLabel },
  });
  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={t.settings.appearance}
    >
      {OPTIONS.map((option) => {
        const checked = option === preference;
        return (
          <Pressable
            key={option}
            testID={`appearance-${option}`}
            onPress={() => setThemePreference(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            aria-checked={checked}
            // Vertical only: the segments touch, so side slop would steal taps.
            hitSlop={{ top: segmentSlop, bottom: segmentSlop }}
            style={[styles.option, checked && { backgroundColor: colors.ctaBg }]}
          >
            <Text
              style={[styles.label, { color: checked ? colors.ctaText : colors.textSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {t.settings.appearanceOptions[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
