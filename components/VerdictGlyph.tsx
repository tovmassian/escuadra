import React from 'react';
import { StyleSheet, View } from 'react-native';
import { EscuadraMark } from './EscuadraMark';
import { colors, iconSize, opacity } from '@/theme/tokens';

interface VerdictGlyphProps {
  correct: boolean;
  /** Edge length in dp. Defaults to the token-defined verdict size. */
  size?: number;
}

// The app's own mark, used as the correct/incorrect glyph. Replaces the
// U+2713 / U+2715 dingbats, which depend on a glyph Inter may not carry and
// so fall back silently to another font.
export function VerdictGlyph({ correct, size = iconSize.markLarge }: VerdictGlyphProps) {
  return (
    <View style={[styles.root, !correct && styles.incorrect]}>
      <EscuadraMark size={size} color={correct ? colors.success : colors.errorTextDim} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  // A wrong verdict reads quieter than a right one, so the correct answer
  // stays the loudest thing on screen.
  incorrect: { opacity: opacity.dimmed },
});
