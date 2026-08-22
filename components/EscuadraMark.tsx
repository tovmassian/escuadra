import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MARK_SMALL_BALL_THRESHOLD, MARK_VIEWBOX, markGeometry } from '@/theme/brand';

interface EscuadraMarkProps {
  /** Rendered edge length in dp. The mark is square. */
  size: number;
  /** Fill for every element. Single-colour by design. */
  color: string;
  /** The two trailing squares. Off by default — icon plates drop them. */
  showTrail?: boolean;
}

// Renders the 2a mark from `theme/brand.ts` geometry using plain Views. Every
// value is derived by scaling the 64-unit grid, so nothing here is a
// hardcoded size and the mark stays crisp at any dimension.
export function EscuadraMark({ size, color, showTrail = false }: EscuadraMarkProps) {
  const u = size / MARK_VIEWBOX;
  const { crossbar, post, ball, ballSmall, trail } = markGeometry;
  // Below the threshold the large ball's gaps to the crossbar/post go
  // sub-pixel and the shapes fuse into a blob — swap to the size-aware
  // small-ball geometry instead. See `theme/brand.ts`.
  const activeBall = size < MARK_SMALL_BALL_THRESHOLD ? ballSmall : ball;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          left: crossbar.x * u,
          top: crossbar.y * u,
          width: crossbar.w * u,
          height: crossbar.h * u,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: post.x * u,
          top: post.y * u,
          width: post.w * u,
          height: post.h * u,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (activeBall.cx - activeBall.r) * u,
          top: (activeBall.cy - activeBall.r) * u,
          width: activeBall.r * 2 * u,
          height: activeBall.r * 2 * u,
          borderRadius: activeBall.r * u,
          backgroundColor: color,
        }}
      />
      {showTrail &&
        trail.map((t) => (
          <View
            key={`${t.x}-${t.y}`}
            style={{
              position: 'absolute',
              left: t.x * u,
              top: t.y * u,
              width: t.size * u,
              height: t.size * u,
              backgroundColor: color,
              opacity: t.opacity,
            }}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
});
