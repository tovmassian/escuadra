import React from 'react';
import { View } from 'react-native';
import { colors, iconSize } from '@/theme/tokens';

// Geometric padlock for the locked-difficulty badge, replacing the OS emoji
// 🔒 previously inlined in DifficultyRow. Built from plain Views, coloured
// from tokens, so it has no dependency on the OS emoji font (the same reason
// TeamMarker draws flags as geometry rather than Unicode regional-indicator
// emoji — see types/squad.ts).
//
// Drawn in a 16x16 box, matching `iconSize.lockGlyph`, and scaled the same
// way EscuadraMark scales from MARK_VIEWBOX: every dimension below is
// derived from the box size, never a hardcoded pixel value.
const GLYPH_BOX = 16;

const body = { x: 4, y: 7, w: 8, h: 6, radius: 1.5 };
const shackle = { x: 6.4, y: 3, w: 3.2, h: 5, radius: 1.6, strokeWidth: 1.4 };

export function LockGlyph() {
  const u = iconSize.lockGlyph / GLYPH_BOX;

  return (
    <View
      style={{ width: iconSize.lockGlyph, height: iconSize.lockGlyph }}
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
    </View>
  );
}
