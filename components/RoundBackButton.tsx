import { Pressable, StyleSheet } from 'react-native';
import { BackGlyph } from '@/components/ActionGlyphs';
import { borderWidths, opacity, sizes } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The 2.0 back button: a 44 pt circle with a hairline ring. On the ground
// (Settings, the team picker) it is `surface` with a `border` ring and the
// chevron in `textPrimary`; over the Difficulty hero, glass, as over a photo.
export function RoundBackButton({
  onPress,
  label,
  testID,
  glass = false,
}: {
  onPress: () => void;
  /** Spoken: `t.common.back`. */
  label: string;
  testID?: string;
  /** Over a team's bands: `glass` fill, `glassLine` ring, `onPhoto` chevron,
   *  the same in both themes. */
  glass?: boolean;
}) {
  const colors = useThemeColors();
  const size = sizes.roundButton;
  const styles = StyleSheet.create({
    round: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: glass ? colors.glass : colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: glass ? colors.glassLine : colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, pressed && { opacity: opacity.settled }]}
    >
      <BackGlyph color={glass ? colors.onPhoto : colors.textPrimary} />
    </Pressable>
  );
}
