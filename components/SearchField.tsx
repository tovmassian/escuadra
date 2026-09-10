import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { iconSize, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Magnifying-glass geometry, in a square box `iconSize.searchGlyph` wide.
// Built from plain Views rather than a 🔍/Unicode glyph, matching LockGlyph
// and VerdictGlyph — icons here never depend on a font carrying the symbol.
const LENS = { size: 11, borderWidth: 1.5 };
const HANDLE = { width: 6, height: 1.5, radius: 1 };

function SearchGlyph() {
  const colors = useThemeColors();
  const box = iconSize.searchGlyph;
  const styles = StyleSheet.create({
    root: { width: box, height: box },
    lens: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: LENS.size,
      height: LENS.size,
      borderRadius: LENS.size / 2,
      borderWidth: LENS.borderWidth,
      borderColor: colors.textMuted,
    },
    handle: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: HANDLE.width,
      height: HANDLE.height,
      borderRadius: HANDLE.radius,
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
  const styles = StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      height: sizes.controlHeight,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
    },
    input: { flex: 1, padding: 0, ...typography.secondary, color: colors.textPrimary },
  });

  return (
    <View style={styles.root}>
      <SearchGlyph />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search teams"
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search teams"
        style={styles.input}
      />
      {value.length > 0 && (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={spacing.xs}
        >
          <ClearGlyph />
        </Pressable>
      )}
    </View>
  );
}
