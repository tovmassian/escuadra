import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { EscuadraMark } from './EscuadraMark';
import { EscuadraStrike } from './EscuadraStrike';
import {
  celebrationEasingCurves,
  homeCascade,
  sizes,
  spacing,
  strikeTiming,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

const WORD = 'escuadra';

interface WordmarkProps {
  /** Mark edge length in dp. Defaults to the token-defined lockup size. */
  size?: number;
  /** The two trailing squares. Home's centred lockup only. Ignored when
   *  `animate` is set — the animated mark shows its own trail. */
  showTrail?: boolean;
  /** Mark above the word rather than beside it. */
  stacked?: boolean;
  /** Plays the mark-strike and letter-by-letter rise once, on mount. Home's
   *  hero lockup only — see CLAUDE.md's "once-per-launch home lockup". */
  animate?: boolean;
}

// The lockup: mark, then the name set lowercase in Inter 800. Lowercase is
// deliberate and comes from the design source — the old uppercase ESCUADRA
// eyebrow predates the logo iteration.
export function Wordmark({
  size = sizes.wordmarkMark,
  showTrail = false,
  stacked = false,
  animate = false,
}: WordmarkProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    stacked: { flexDirection: 'column', gap: spacing.md },
    wordRow: { flexDirection: 'row', overflow: 'hidden' },
    word: { ...typography.wordmark, color: colors.textPrimary },
    wordStacked: typography.wordmarkHero,
  });
  const wordStyle = [styles.word, stacked && styles.wordStacked];

  return (
    <View
      style={[styles.root, stacked && styles.stacked]}
      accessibilityRole="header"
      accessibilityLabel="Escuadra"
    >
      {animate ? (
        <EscuadraStrike size={size} color={colors.mark} timing={strikeTiming.home} />
      ) : (
        <EscuadraMark size={size} color={colors.mark} showTrail={showTrail} />
      )}
      {animate ? (
        <View style={styles.wordRow}>
          {WORD.split('').map((letter, i) => (
            <Animated.Text
              key={i}
              entering={FadeInUp.duration(homeCascade.letterDuration)
                .delay(homeCascade.letterBase + i * homeCascade.letterStep)
                .easing(Easing.bezier(...celebrationEasingCurves.rise))}
              style={wordStyle}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>
      ) : (
        <Text style={wordStyle}>{WORD}</Text>
      )}
    </View>
  );
}
