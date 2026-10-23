import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { EscuadraMark } from './EscuadraMark';
import { measureInWindow, useLaunchReveal } from './LaunchReveal';
import { ESCUADRA, ESCUADRA_WORDMARK } from '@/i18n/names';
import { sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The top bar's lockup on Home (#181): the mark, then the name set lowercase.
// Lowercase is deliberate and comes from the design source — the old uppercase
// ESCUADRA eyebrow predates the logo iteration. The launch intro (#182) docks
// its own lockup onto this one: it reports where its mark and word are, and
// stays hidden until the dock ends, when the intro's lockup is exactly on top
// of it and unmounts (spec, Hand-off to Home).
export function Wordmark() {
  const colors = useThemeColors();
  const launch = useLaunchReveal();
  const markRef = useRef<View>(null);
  const wordRef = useRef<View>(null);
  const styles = StyleSheet.create({
    root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    word: { ...typography.wordmark, color: colors.textPrimary },
  });

  const reveal = launch?.reveal;
  const shownStyle = useAnimatedStyle(() => ({
    opacity: !reveal || reveal.value >= 1 ? 1 : 0,
  }));

  const report = () => {
    if (!launch) return;
    void Promise.all([measureInWindow(markRef.current), measureInWindow(wordRef.current)]).then(
      ([mark, word]) => {
        if (mark && word) launch.reportTarget({ mark, word });
      },
    );
  };

  return (
    <Animated.View
      style={[styles.root, shownStyle]}
      onLayout={report}
      accessibilityRole="header"
      accessibilityLabel={ESCUADRA}
    >
      <View ref={markRef}>
        <EscuadraMark size={sizes.wordmarkMark} color={colors.mark} />
      </View>
      <View ref={wordRef}>
        <Text style={styles.word}>{ESCUADRA_WORDMARK}</Text>
      </View>
    </Animated.View>
  );
}
