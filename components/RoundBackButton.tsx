import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { BackGlyph } from '@/components/ActionGlyphs';
import { borderWidths, opacity, sizes } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The 2.0 round button: a 44 pt circle with a hairline ring. On the ground
// (Settings, the team picker) it is `surface` with a `border` ring and the
// glyph in `textPrimary`; over the Difficulty hero in dark theme, glass, as
// over a photo. The back button and Difficulty's star (#179) are both one.
export function RoundButton({
  glass = false,
  children,
  ...pressable
}: Omit<PressableProps, 'style' | 'children'> & {
  /** Over a team's bands: `glass` fill, `glassLine` ring, `onPhoto` glyph,
   *  the glass roles are shared by both themes, but
   *  the hero uses this in dark theme only (LadderHero). */
  glass?: boolean;
  children: ReactNode;
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
      {...pressable}
      style={({ pressed }) => [styles.round, pressed && { opacity: opacity.settled }]}
    >
      {children}
    </Pressable>
  );
}

/** The glyph's colour on a `RoundButton`. */
export function useRoundGlyphColor(glass: boolean): string {
  const colors = useThemeColors();
  return glass ? colors.onPhoto : colors.textPrimary;
}

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
  glass?: boolean;
}) {
  return (
    <RoundButton
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      glass={glass}
    >
      <BackGlyph color={useRoundGlyphColor(glass)} />
    </RoundButton>
  );
}
