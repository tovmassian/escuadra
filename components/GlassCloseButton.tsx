import { Pressable, StyleSheet, View } from 'react-native';
import { borderWidths, iconSize, opacity, sizes } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The round glass button over the photo that leaves the round (spec §2.1).
// Drawn at 36 pt; hitSlop brings the tap target to the 44 pt minimum. The ×
// is two crossed bars, as SearchField draws its glyphs.
export function GlassCloseButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemeColors();
  const size = sizes.glassButton;
  const glyph = iconSize.closeGlyph;
  const slop = (sizes.minTapTarget - size) / 2;
  const styles = StyleSheet.create({
    button: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: borderWidths.hairline,
      borderColor: colors.glassLine,
      backgroundColor: colors.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glyph: { width: glyph, height: glyph },
    bar: {
      position: 'absolute',
      top: glyph / 2 - borderWidths.thick,
      left: 0,
      width: glyph,
      height: borderWidths.thick * 2,
      borderRadius: borderWidths.thick,
      backgroundColor: colors.onPhoto,
    },
  });
  return (
    <Pressable
      testID="question-close"
      onPress={onPress}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && { opacity: opacity.settled }]}
    >
      <View style={styles.glyph}>
        <View style={[styles.bar, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.bar, { transform: [{ rotate: '-45deg' }] }]} />
      </View>
    </Pressable>
  );
}
