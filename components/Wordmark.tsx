import { StyleSheet, Text, View } from 'react-native';
import { EscuadraMark } from './EscuadraMark';
import { colors, sizes, spacing, typography } from '@/theme/tokens';

interface WordmarkProps {
  /** Mark edge length in dp. Defaults to the token-defined lockup size. */
  size?: number;
  /** The two trailing squares. Home's centred lockup only. */
  showTrail?: boolean;
  /** Mark above the word rather than beside it. */
  stacked?: boolean;
}

// The lockup: mark, then the name set lowercase in Inter 800. Lowercase is
// deliberate and comes from the design source — the old uppercase ESCUADRA
// eyebrow predates the logo iteration.
export function Wordmark({
  size = sizes.wordmarkMark,
  showTrail = false,
  stacked = false,
}: WordmarkProps) {
  return (
    <View
      style={[styles.root, stacked && styles.stacked]}
      accessibilityRole="header"
      accessibilityLabel="Escuadra"
    >
      <EscuadraMark size={size} color={colors.brandSoft} showTrail={showTrail} />
      <Text style={[styles.word, stacked && styles.wordStacked]}>escuadra</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stacked: { flexDirection: 'column', gap: spacing.md },
  word: { ...typography.wordmark, color: colors.textPrimary },
  wordStacked: typography.wordmarkHero,
});
