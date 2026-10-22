import { StyleSheet, View } from 'react-native';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { bannerBands } from '@/lib/stageView';
import { borderWidths, sizes } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface TeamMarkerProps {
  marker: TeamMarkerData;
  /** `banner` is the in-round treatment (the question screen's header): thin
   *  and long, and *always* rendered as vertical bands — the squad's real
   *  orientation is ignored. This is a deliberate rule, not a simplification:
   *  see the in-round banner in .claude/rules/team-identity.md. `picker` is the
   *  team picker's row marker (#176): 40 × 27 with a hairline ring, in the
   *  squad's own `marker.orientation`. */
  variant: 'banner' | 'picker';
}

// A team's only visual identity marker, per the "no crests, ever" constraint.
// One shape for both kinds: a banded rectangle. For a nation the bands are
// its national flag; for a club they're its own colours — a single-entry
// array for a single-colour club (Arsenal, Real Madrid) renders as one solid
// field, not a split shape.
export function TeamMarker({ marker, variant }: TeamMarkerProps) {
  const colors = useThemeColors();
  const isBanner = variant === 'banner';
  const dimensions = isBanner ? sizes.teamMarkerBanner : sizes.pickerMarker;
  const radius = isBanner ? sizes.teamMarkerRadius : sizes.pickerMarker.radius;
  const isColumn = !isBanner && marker.orientation === 'horizontal';

  // The banner always draws vertical bands. `bannerBands` (lib/stageView.ts)
  // owns that rule; the spotlight stage's team-colour fallback (spec §2.6)
  // draws the same bands.
  const banded = isBanner
    ? bannerBands(marker)
    : marker.bands.map((color, i) => ({ color, weight: marker.weights?.[i] ?? 1 }));
  const bands = banded.map((b) => b.color);
  const weights = banded.map((b) => b.weight);
  const total = weights.reduce((sum, w) => sum + w, 0);

  return (
    <View
      style={[
        styles.marker,
        { width: dimensions.width, height: dimensions.height, borderRadius: radius },
        { flexDirection: isColumn ? 'column' : 'row' },
      ]}
    >
      {bands.map((band, i) => (
        <View
          key={`${band}-${i}`}
          style={{ flex: (weights[i] ?? 1) / total, backgroundColor: band }}
        />
      ))}
      {/* The picker's ring is drawn over the bands, not as the box's border, so
          the bands fill the whole 40 × 27, as a flag image does. */}
      {!isBanner && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              pointerEvents: 'none',
              borderRadius: radius,
              borderWidth: borderWidths.hairline,
              borderColor: colors.markerRing,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: { overflow: 'hidden' },
});
