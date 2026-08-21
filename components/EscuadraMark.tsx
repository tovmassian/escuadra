import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MARK_VIEWBOX, markGeometry } from '@/theme/brand';

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
  const { crossbar, post, ball, trail } = markGeometry;

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
          left: (ball.cx - ball.r) * u,
          top: (ball.cy - ball.r) * u,
          width: ball.r * 2 * u,
          height: ball.r * 2 * u,
          borderRadius: ball.r * u,
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
