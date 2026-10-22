import { View } from 'react-native';

// Geometric padlock for the locked-difficulty badge, replacing the OS emoji
// 🔒 previously inlined in DifficultyRow. Built from plain Views, coloured
// from tokens, so it has no dependency on the OS emoji font (the same reason
// nation flags are committed PNGs rather than Unicode regional-indicator
// emoji — see types/squad.ts).
//
// Drawn in a 16x16 box and scaled the same way EscuadraMark scales from
// MARK_VIEWBOX: every dimension below is derived from the box size, never a
// hardcoded pixel value. `size` is the caller's responsibility — DifficultyRow
// derives it from the badge it sits inside via `iconSize.lockGlyphRatio`, so
// the glyph reads at both locked ring sizes instead of sitting fixed
// regardless of the badge around it.
const GLYPH_BOX = 16;

const body = { x: 4, y: 7, w: 8, h: 6, radius: 1.5 };
const shackle = { x: 6.4, y: 3, w: 3.2, h: 5, radius: 1.6, strokeWidth: 1.4 };
// The keyhole cuts through to whatever sits behind the lock body, so it's
// drawn in the colour of whatever the glyph sits on (`ground`) rather than a
// token meant for foreground content.
const keyholeHole = { cx: 8, cy: 9.9, r: 1 };
const keyholeSlot = { x: 7.5, y: 9.9, w: 1, h: 2.3, radius: 0.5 };

interface LockGlyphProps {
  /** Rendered edge length in dp. The glyph is square. */
  size: number;
  /** The shackle and the body. */
  color: string;
  /** The keyhole: the fill the glyph sits on. */
  ground: string;
}

export function LockGlyph({ size, color, ground }: LockGlyphProps) {
  const u = size / GLYPH_BOX;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Shackle: an arch, not a closed loop — bottom border removed and
          only the top corners rounded, so it reads as the loop of a lock
          rather than a ring. */}
      <View
        style={{
          position: 'absolute',
          left: shackle.x * u,
          top: shackle.y * u,
          width: shackle.w * u,
          height: shackle.h * u,
          borderWidth: shackle.strokeWidth * u,
          borderColor: color,
          borderBottomWidth: 0,
          borderTopLeftRadius: shackle.radius * u,
          borderTopRightRadius: shackle.radius * u,
        }}
      />
      {/* Body: a filled rounded rect. */}
      <View
        style={{
          position: 'absolute',
          left: body.x * u,
          top: body.y * u,
          width: body.w * u,
          height: body.h * u,
          borderRadius: body.radius * u,
          backgroundColor: color,
        }}
      />
      {/* Keyhole: a round hole with a tapered slot beneath it, cut into the
          body in the colour of the ground beneath the glyph. */}
      <View
        style={{
          position: 'absolute',
          left: (keyholeHole.cx - keyholeHole.r) * u,
          top: (keyholeHole.cy - keyholeHole.r) * u,
          width: keyholeHole.r * 2 * u,
          height: keyholeHole.r * 2 * u,
          borderRadius: keyholeHole.r * u,
          backgroundColor: ground,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: keyholeSlot.x * u,
          top: keyholeSlot.y * u,
          width: keyholeSlot.w * u,
          height: keyholeSlot.h * u,
          borderRadius: keyholeSlot.radius * u,
          backgroundColor: ground,
        }}
      />
    </View>
  );
}
