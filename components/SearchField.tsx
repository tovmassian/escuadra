import { useT } from '@/i18n/useT';
import { borderWidths, iconSize, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

// Magnifying-glass geometry, as fractions of the square box
// `iconSize.searchGlyph`, so the glyph scales with the box. Built from plain
// Views rather than a 🔍/Unicode glyph, matching LockGlyph — icons here
// never depend on a font carrying the symbol.
const LENS_RATIO = 0.7; // the lens ring's outer diameter
const HANDLE_RATIO = 0.3; // the handle's length

function SearchGlyph() {
  const colors = useThemeColors();
  const box = iconSize.searchGlyph;
  const stroke = borderWidths.emphasis;
  const lens = box * LENS_RATIO;
  const handle = box * HANDLE_RATIO;
  // The handle leaves the ring's stroke at 45°, down and to the right. Its far
  // end, round cap included, is how far the glyph reaches; the inset centres
  // the whole glyph in the box.
  const ring = (lens - stroke) / 2;
  const reach = lens / 2 + (ring + handle + stroke / 2) * Math.SQRT1_2;
  const inset = (box - reach) / 2;
  const handleCentre = inset + lens / 2 + (ring + handle / 2) * Math.SQRT1_2;
  const styles = StyleSheet.create({
    root: { width: box, height: box },
    lens: {
      position: 'absolute',
      top: inset,
      left: inset,
      width: lens,
      height: lens,
      borderRadius: lens / 2,
      borderWidth: stroke,
      borderColor: colors.textMuted,
    },
    handle: {
      position: 'absolute',
      top: handleCentre - stroke / 2,
      left: handleCentre - handle / 2,
      width: handle,
      height: stroke,
      borderRadius: stroke / 2,
      backgroundColor: colors.textMuted,
      transform: [{ rotate: '45deg' }],
    },
  });

  return (
    <View
      style={styles.root}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.lens} />
      <View style={styles.handle} />
    </View>
  );
}

// The clear button's "×", drawn as two crossed bars rather than the U+2715
// dingbat — same reasoning as SearchGlyph above.
function ClearGlyph() {
  const colors = useThemeColors();
  const box = iconSize.clearGlyph;
  const styles = StyleSheet.create({
    root: { width: box, height: box },
    bar: {
      position: 'absolute',
      top: box / 2 - 0.75,
      left: 0,
      width: box,
      height: 1.5,
      borderRadius: 1,
      backgroundColor: colors.textMuted,
    },
    barA: { transform: [{ rotate: '45deg' }] },
    barB: { transform: [{ rotate: '-45deg' }] },
  });

  return (
    <View style={styles.root}>
      <View style={[styles.bar, styles.barA]} />
      <View style={[styles.bar, styles.barB]} />
    </View>
  );
}

interface SearchFieldProps {
  value: string;
  onChange: (text: string) => void;
  onClear: () => void;
}

export function SearchField({ value, onChange, onClear }: SearchFieldProps) {
  const colors = useThemeColors();
  const t = useT();
  const styles = StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm - spacing.nudge,
      height: sizes.searchField,
      paddingHorizontal: spacing.md + spacing.nudge,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      borderRadius: radii.pill,
    },
    input: { flex: 1, padding: 0, ...typography.searchInput, color: colors.textPrimary },
  });
  // The × is drawn small and reaches the 44 pt tap target through hitSlop (#187).
  const clearSlop = (sizes.minTapTarget - iconSize.clearGlyph) / 2;

  return (
    <View style={styles.root}>
      <SearchGlyph />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t.picker.search}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={t.picker.search}
        style={styles.input}
      />
      {value.length > 0 && (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={t.picker.clearSearch}
          hitSlop={clearSlop}
        >
          <ClearGlyph />
        </Pressable>
      )}
    </View>
  );
}
