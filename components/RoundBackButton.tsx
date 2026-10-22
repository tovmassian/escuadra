import { Pressable, StyleSheet } from 'react-native';
import { BackGlyph } from '@/components/ActionGlyphs';
import { borderWidths, opacity, sizes } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The 2.0 back button (Settings, the team picker): a 44 pt circle in `surface`
// with a hairline `border`, the chevron in `textPrimary`.
export function RoundBackButton({
  onPress,
  label,
  testID,
}: {
  onPress: () => void;
  /** Spoken: `t.common.back`. */
  label: string;
  testID?: string;
}) {
  const colors = useThemeColors();
  const size = sizes.roundButton;
  const styles = StyleSheet.create({
    round: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
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
      <BackGlyph color={colors.textPrimary} />
    </Pressable>
  );
}
