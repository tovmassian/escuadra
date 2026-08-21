import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Flag } from '@/types/squad';
import { colors, radii, sizes } from '@/theme/tokens';

interface TeamIdentityDotProps {
  kind: 'club' | 'nation';
  primaryColor: string;
  secondaryColor: string;
  flag?: Flag;
}

// A team's only visual identity marker, per the "no crests, ever" constraint.
// Clubs are colour: one flat dot, or a split dot where the club genuinely has
// two colours (Barcelona, Inter, PSG). Nations are their flag, drawn from
// band geometry — never an emoji, which depends on an OS font Windows lacks.
export function TeamIdentityDot({
  kind,
  primaryColor,
  secondaryColor,
  flag,
}: TeamIdentityDotProps) {
  if (kind === 'nation' && flag) return <FlagMarker flag={flag} />;

  const primary = primaryColor || colors.textMuted;
  const secondary = secondaryColor || primary;
  const isTwoTone = secondary.toLowerCase() !== primary.toLowerCase();

  if (!isTwoTone) return <View style={[styles.dot, { backgroundColor: primary }]} />;

  return (
    <View style={styles.dot}>
      <View style={[styles.dotHalf, { backgroundColor: primary }]} />
      <View style={[styles.dotHalf, { backgroundColor: secondary }]} />
    </View>
  );
}

function FlagMarker({ flag }: { flag: Flag }) {
  const weights = flag.weights ?? flag.bands.map(() => 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const overlaySize = sizes.teamFlag.height * sizes.teamFlagOverlayScale;

  return (
    <View
      style={[styles.flag, { flexDirection: flag.orientation === 'horizontal' ? 'column' : 'row' }]}
    >
      {flag.bands.map((band, i) => (
        <View
          key={`${band}-${i}`}
          style={{ flex: (weights[i] ?? 1) / total, backgroundColor: band }}
        />
      ))}
      {flag.overlay && (
        <View style={styles.overlayWrap} pointerEvents="none">
          <View
            style={{
              width: overlaySize,
              height: overlaySize,
              backgroundColor: flag.overlay.color,
              borderRadius: flag.overlay.shape === 'disc' ? overlaySize / 2 : 0,
              transform: flag.overlay.shape === 'diamond' ? [{ rotate: '45deg' }] : undefined,
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: sizes.teamDot,
    height: sizes.teamDot,
    borderRadius: radii.pill,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  dotHalf: { flex: 1 },
  flag: {
    width: sizes.teamFlag.width,
    height: sizes.teamFlag.height,
    borderRadius: sizes.teamFlagRadius,
    overflow: 'hidden',
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
