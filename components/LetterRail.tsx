import { useRef } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { fontScaleCap, sizes, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface LetterRailProps {
  /** The letters to show, already in order (the screen builds the list). */
  letters: readonly string[];
  /** The letter whose section is in view, or null. */
  current: string | null;
  onJump: (letter: string) => void;
}

// The nations tab's A–Z index (#176). The whole column is the touch target: a
// tap or a drag maps its y position to a letter. Hidden from screen readers
// (spec decision 4): the list itself is what they read.
export function LetterRail({ letters, current, onJump }: LetterRailProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    rail: { width: sizes.rail.width, alignItems: 'center' },
    letter: { ...typography.railLetter, height: sizes.rail.letter, textAlign: 'center' },
  });
  const rail = useRef<View>(null);
  // The rail's top edge in the window: `locationY` is relative to whichever
  // letter was hit, so it can't place the finger. Measured on layout and again
  // as a touch starts. Null until the first measure lands: on
  // react-native-web `measureInWindow` is async, and a move mapped against a
  // zero top would clamp to the last letter.
  const top = useRef<number | null>(null);
  const last = useRef<string | null>(null);

  const measure = (then?: () => void) =>
    rail.current?.measureInWindow((_x, y) => {
      top.current = y;
      then?.();
    });

  const jumpTo = (pageY: number) => {
    if (top.current === null) return;
    const index = Math.floor((pageY - top.current) / sizes.rail.letter);
    const letter = letters[Math.min(letters.length - 1, Math.max(0, index))];
    if (letter !== undefined && letter !== last.current) {
      last.current = letter;
      onJump(letter);
    }
  };

  const onGrant = (e: GestureResponderEvent) => {
    const { pageY } = e.nativeEvent;
    last.current = null;
    measure(() => jumpTo(pageY));
  };

  return (
    <View
      ref={rail}
      testID="letter-rail"
      style={styles.rail}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={() => measure()}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // A drag down the rail stays the rail's: the list behind it must not
      // take the gesture over as a scroll.
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={(e) => jumpTo(e.nativeEvent.pageY)}
    >
      {letters.map((letter) => (
        <Text
          key={letter}
          testID={`rail-${letter}`}
          selectable={false}
          // Each letter keeps its fixed `sizes.rail.letter` pitch, which the
          // touch mapping above relies on, so its text may grow only so far.
          maxFontSizeMultiplier={fontScaleCap.display}
          style={[
            styles.letter,
            { color: letter === current ? colors.accentLine : colors.textMuted },
          ]}
        >
          {letter}
        </Text>
      ))}
    </View>
  );
}
