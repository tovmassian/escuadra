import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { sizes } from '@/theme/tokens';

interface TeamMarkerProps {
  marker: TeamMarkerData;
}

// A team's only visual identity marker, per the "no crests, ever" constraint.
// One shape for both kinds: a banded rectangle. For a nation the bands are
// its national flag; for a club they're its own colours — a single-entry
// array for a single-colour club (Arsenal, Real Madrid) renders as one solid
// field, not a split shape.
export function TeamMarker({ marker }: TeamMarkerProps) {
  const weights = marker.weights ?? marker.bands.map(() => 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const overlaySize = sizes.teamMarker.height * sizes.teamMarkerOverlayScale;

  return (
    <View
      style={[
        styles.marker,
        { flexDirection: marker.orientation === 'horizontal' ? 'column' : 'row' },
      ]}
    >
      {marker.bands.map((band, i) => (
        <View
          key={`${band}-${i}`}
          style={{ flex: (weights[i] ?? 1) / total, backgroundColor: band }}
        />
      ))}
      {marker.overlay && (
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
    width: sizes.teamMarker.width,
    height: sizes.teamMarker.height,
    borderRadius: sizes.teamMarkerRadius,
    overflow: 'hidden',
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
