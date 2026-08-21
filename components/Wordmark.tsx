import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EscuadraMark } from './EscuadraMark';
import { colors, sizes, spacing, typography } from '@/theme/tokens';

interface WordmarkProps {
  /** Mark edge length in dp. Defaults to the token-defined lockup size. */
  size?: number;
}

// The horizontal lockup: mark, then the name set lowercase in Inter 800.
// Lowercase is deliberate and comes from the design source — the old
// uppercase ESCUADRA eyebrow predates the logo iteration.
export function Wordmark({ size = sizes.wordmarkMark }: WordmarkProps) {
  return (
    <View style={styles.root} accessibilityRole="header" accessibilityLabel="Escuadra">
      <EscuadraMark size={size} color={colors.brandSoft} />
      <Text style={styles.word}>escuadra</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  word: { ...typography.wordmark, color: colors.textPrimary },
});
