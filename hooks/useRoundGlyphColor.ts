import { useThemeColors } from '@/theme/useTheme';

/** The glyph's colour on a `RoundButton` (`components/RoundBackButton.tsx`). */
export function useRoundGlyphColor(glass: boolean): string {
  const colors = useThemeColors();
  return glass ? colors.onPhoto : colors.textPrimary;
}
