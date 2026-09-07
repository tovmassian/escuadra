import { View } from 'react-native';
import { colors } from '@/theme/tokens';

// Geometric padlock for the locked-difficulty badge, replacing the OS emoji
// 🔒 previously inlined in DifficultyRow. Built from plain Views, coloured
// from tokens, so it has no dependency on the OS emoji font (the same reason
// TeamMarker draws flags as geometry rather than Unicode regional-indicator
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
// The keyhole cuts through to whatever sits behind the lock body — the
// locked badge's own fill — so it's drawn in that colour rather than a token
// meant for foreground content.
const keyholeHole = { cx: 8, cy: 9.9, r: 1 };
const keyholeSlot = { x: 7.5, y: 9.9, w: 1, h: 2.3, radius: 0.5 };

interface LockGlyphProps {
  /** Rendered edge length in dp. The glyph is square. */
  size: number;
}

export function LockGlyph({ size }: LockGlyphProps) {
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
          borderColor: colors.textMuted,
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
          backgroundColor: colors.textMuted,
        }}
      />
      {/* Keyhole: a round hole with a tapered slot beneath it, cut into the
          body via the badge's own fill colour. */}
      <View
        style={{
          position: 'absolute',
          left: (keyholeHole.cx - keyholeHole.r) * u,
          top: (keyholeHole.cy - keyholeHole.r) * u,
          width: keyholeHole.r * 2 * u,
          height: keyholeHole.r * 2 * u,
          borderRadius: keyholeHole.r * u,
          backgroundColor: colors.surface,
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
          backgroundColor: colors.surface,
        }}
      />
    </View>
  );
}
