import React from 'react';
import { StyleSheet, View } from 'react-native';
import { EscuadraMark } from './EscuadraMark';
import { colors, iconSize, opacity } from '@/theme/tokens';

interface VerdictGlyphProps {
  correct: boolean;
  /** Edge length in dp. Defaults to the token-defined verdict size. */
  size?: number;
  /**
   * Overrides the default success/errorTextDim colour. Needed when the mark
   * sits on a same-hue fill (e.g. DifficultyRow's success-coloured "best"
   * badge, where a success-coloured mark on a success-coloured background
   * would be invisible).
   */
  color?: string;
}

// The app's own mark, used as the correct/incorrect glyph. Replaces the
// U+2713 / U+2715 dingbats, which depend on a glyph Inter may not carry and
// so fall back silently to another font.
export function VerdictGlyph({ correct, size = iconSize.markLarge, color }: VerdictGlyphProps) {
  return (
    <View style={[styles.root, !correct && styles.incorrect]}>
      <EscuadraMark size={size} color={color ?? (correct ? colors.success : colors.errorTextDim)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  // A wrong verdict reads quieter than a right one, so the correct answer
  // stays the loudest thing on screen.
  incorrect: { opacity: opacity.dimmed },
});
