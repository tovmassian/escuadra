import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { sizes } from '@/theme/tokens';

interface TeamMarkerProps {
  marker: TeamMarkerData;
  /** `default` matches the picker: the squad's own `marker.orientation`, at
   *  picker size. `banner` is the in-round treatment (the question screen's
   *  header): thinner and longer, and *always* rendered as vertical bands —
   *  the squad's real orientation is ignored. This is a deliberate rule, not
   *  a simplification: see CLAUDE.md's "in-round team marker" rule. */
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

  // A shape overlay (disc/diamond) reads fine at the picker's marker height
  // but disappears at the banner's — there's no diameter left to draw. Every
  // overlay marker is a single solid band plus one centred device (Japan:
  // white + red disc; Brazil: green + yellow diamond — see TeamMarker's
  // data-model docs), so the banner instead splits that band into
  // edge/middle/edge, using the overlay's own colour for the middle third.
  // Driven by the marker's shape, not any per-team case.
  const soleBand = marker.bands.length === 1 ? marker.bands[0] : undefined;
  const bannerOverlayEdge = isBanner && marker.overlay && soleBand !== undefined ? soleBand : null;
  const bands =
    bannerOverlayEdge !== null && marker.overlay
      ? [bannerOverlayEdge, marker.overlay.color, bannerOverlayEdge]
      : marker.bands;
  const weights =
    bannerOverlayEdge !== null ? [1, 1, 1] : (marker.weights ?? marker.bands.map(() => 1));
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
