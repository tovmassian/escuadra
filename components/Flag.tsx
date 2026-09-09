import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { FLAG_SOURCES, type FlagCode } from '@/assets/flags/generated';
import { colors, sizes } from '@/theme/tokens';

export type FlagSize = 'marker' | 'inline' | 'row';

interface FlagProps {
  /** Null when the nationality isn't in `lib/flags.ts`'s table. Renders
   *  nothing, so the call site degrades to its text-only layout rather than
   *  leaving a gap. */
  code: FlagCode | null;
  size: FlagSize;
  /** Announced by a screen reader in place of the image, e.g. "Spain". */
  label: string;
}

const DIMENSIONS: Record<FlagSize, { width: number; height: number }> = {
  marker: sizes.flagMarker,
  inline: sizes.flagInline,
  row: sizes.flagRow,
};

// A nation's identity element. Clubs never render one — CLAUDE.md hard
// constraint #2 bans crests, badges, logos and shield shapes permanently, and
// national flags are its only carve-out. Mid-round the team identity is still
// TeamMarker's geometric banner, not this: at 100x3 pt there is no image to
// show.
//
// The hairline border is not decoration. The theme is dark-only, and Japan's
// and Poland's white would otherwise bleed into the surface behind it.
export function Flag({ code, size, label }: FlagProps) {
  if (code === null) return null;
  const dimensions = DIMENSIONS[size];
  return (
    <Image
      source={FLAG_SOURCES[code]}
      style={[styles.flag, dimensions]}
      contentFit="cover"
      accessibilityRole="image"
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  flag: {
    borderRadius: sizes.teamMarkerRadius,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
