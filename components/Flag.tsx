import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { FLAG_SOURCES, type FlagCode } from '@/assets/flags/generated';
import { borderWidths, sizes } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export type FlagSize = 'marker' | 'inline' | 'row' | 'picker' | 'continue' | 'squad';

interface FlagProps {
  /** Null when the nationality isn't in `lib/flags.ts`'s table. Renders
   *  nothing, so the call site degrades to its text-only layout rather than
   *  leaving a gap. */
  code: FlagCode | null;
  size: FlagSize;
  /** Announced by a screen reader in place of the image, e.g. "Spain". */
  label: string;
  /** The hairline's colour. Defaults to `border`; a flag on a dark photo card
   *  passes `glassLine`, since `border` is pale in the light theme. */
  lineColor?: string;
}

const DIMENSIONS: Record<FlagSize, { width: number; height: number }> = {
  marker: sizes.flagMarker,
  inline: sizes.flagInline,
  row: sizes.flagRow,
  picker: sizes.pickerMarker,
  continue: sizes.home.continueMarker,
  squad: sizes.home.squadMarker,
};

// The corner radius of each size; `Image` ignores a `radius` inside a style
// object's dimensions, so only width and height are passed on.
const RADII: Partial<Record<FlagSize, number>> = {
  picker: sizes.pickerMarker.radius,
  continue: sizes.home.continueMarker.radius,
  squad: sizes.home.squadMarker.radius,
};

// The sizes drawn with the marker's ring, as the picker's row does.
const RINGED: readonly FlagSize[] = ['picker', 'continue', 'squad'];

// A nation's identity element. Clubs never render one — CLAUDE.md
// guardrail 2 bans crests, badges, logos and shield shapes permanently, and
// national flags are its only carve-out. Mid-round the team identity is still
// TeamMarker's geometric banner, not this: at 100x3 pt there is no image to
// show.
//
// The hairline border is not decoration: Japan's and Poland's white would
// otherwise bleed into the surface behind it. It matters in both themes —
// white-on-light is the worse case of the two.
export function Flag({ code, size, label, lineColor }: FlagProps) {
  const colors = useThemeColors();
  const ringed = RINGED.includes(size);
  const styles = StyleSheet.create({
    flag: {
      borderRadius: RADII[size] ?? sizes.teamMarkerRadius,
      borderWidth: borderWidths.hairline,
      borderColor: lineColor ?? (ringed ? colors.markerRing : colors.border),
    },
  });

  if (code === null) return null;
  const { width, height } = DIMENSIONS[size];
  return (
    <Image
      source={FLAG_SOURCES[code]}
      style={[styles.flag, { width, height }]}
      contentFit="cover"
      accessibilityRole="image"
      accessibilityLabel={label}
    />
  );
}
