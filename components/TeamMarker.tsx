import { StyleSheet, View } from 'react-native';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { bannerBands } from '@/lib/stageView';
import { sizes } from '@/theme/tokens';

interface TeamMarkerProps {
  marker: TeamMarkerData;
  /** `default` matches the picker: the squad's own `marker.orientation`, at
   *  picker size. `banner` is the in-round treatment (the question screen's
   *  header): thinner and longer, and *always* rendered as vertical bands —
   *  the squad's real orientation is ignored. This is a deliberate rule, not
   *  a simplification: see the in-round banner in
   *  .claude/rules/team-identity.md. */
  variant?: 'default' | 'banner';
}

// A team's only visual identity marker, per the "no crests, ever" constraint.
// One shape for both kinds: a banded rectangle. For a nation the bands are
// its national flag; for a club they're its own colours — a single-entry
// array for a single-colour club (Arsenal, Real Madrid) renders as one solid
// field, not a split shape.
export function TeamMarker({ marker, variant = 'default' }: TeamMarkerProps) {
  const isBanner = variant === 'banner';
  const dimensions = isBanner ? sizes.teamMarkerBanner : sizes.teamMarker;
  const isColumn = !isBanner && marker.orientation === 'horizontal';

  // The banner always draws vertical bands, and a shape overlay becomes a
  // middle band, since a disc or diamond has no room at the banner's height.
  // `bannerBands` (lib/stageView.ts) owns that rule; the spotlight stage's
  // team-colour fallback (spec §2.6) draws the same bands.
  const banded = isBanner
    ? bannerBands(marker)
    : marker.bands.map((color, i) => ({ color, weight: marker.weights?.[i] ?? 1 }));
  const bands = banded.map((b) => b.color);
  const weights = banded.map((b) => b.weight);
  const total = weights.reduce((sum, w) => sum + w, 0);

  const showShapeOverlay = !isBanner && marker.overlay;
  const overlaySize = dimensions.height * sizes.teamMarkerOverlayScale;

  return (
    <View
      style={[
        styles.marker,
        { width: dimensions.width, height: dimensions.height },
        { flexDirection: isColumn ? 'column' : 'row' },
      ]}
    >
      {bands.map((band, i) => (
        <View
          key={`${band}-${i}`}
          style={{ flex: (weights[i] ?? 1) / total, backgroundColor: band }}
        />
      ))}
      {showShapeOverlay && marker.overlay && (
        <View style={styles.overlayWrap} pointerEvents="none">
          <View
            style={{
              width: overlaySize,
              height: overlaySize,
              backgroundColor: marker.overlay.color,
              borderRadius: marker.overlay.shape === 'disc' ? overlaySize / 2 : 0,
              transform: marker.overlay.shape === 'diamond' ? [{ rotate: '45deg' }] : undefined,
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    borderRadius: sizes.teamMarkerRadius,
    overflow: 'hidden',
  },
  overlayWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
