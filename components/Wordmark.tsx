import { StyleSheet, Text, View } from 'react-native';
import { EscuadraMark } from './EscuadraMark';
import { ESCUADRA, ESCUADRA_WORDMARK } from '@/i18n/names';
import { sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The top bar's lockup on Home (#181): the mark, then the name set lowercase.
// Lowercase is deliberate and comes from the design source — the old uppercase
// ESCUADRA eyebrow predates the logo iteration. Static: the launch intro (#182)
// brings its own timeline.
export function Wordmark() {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    word: { ...typography.wordmark, color: colors.textPrimary },
  });

  return (
    <View style={styles.root} accessibilityRole="header" accessibilityLabel={ESCUADRA}>
      <EscuadraMark size={sizes.wordmarkMark} color={colors.mark} />
      <Text style={styles.word}>{ESCUADRA_WORDMARK}</Text>
    </View>
  );
}
