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
  /** True as a finger lands on the rail, false as it leaves. */
  onTouch?: (touching: boolean) => void;
}

// The nations tab's A–Z index (#176). The whole column is the touch target: a
// tap or a drag maps its y position to a letter. Hidden from screen readers
// (spec decision 4): the list itself is what they read.
export function LetterRail({ letters, current, onJump, onTouch }: LetterRailProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    rail: { width: sizes.rail.width, alignItems: 'center' },
    letter: { ...typography.railLetter, height: sizes.rail.letter, textAlign: 'center' },
    // The letters take no touches: see `top` below.
    letters: { alignItems: 'center', pointerEvents: 'none' },
  });
  // The rail's top edge in page coordinates, fixed as a touch starts. The
  // letters take no touches, so the rail itself is always the target and
  // `locationY` is the finger's distance from the rail's top: `pageY -
  // locationY` places the rail synchronously, with no measure to wait for
  // and no transform to account for. Moves map against it for the whole
  // gesture, even if the rail moves under the finger.
  const top = useRef<number | null>(null);
  const last = useRef<string | null>(null);

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
    const { pageY, locationY } = e.nativeEvent;
    top.current = pageY - locationY;
    last.current = null;
    onTouch?.(true);
    jumpTo(pageY);
  };
  const onEnd = () => onTouch?.(false);

  return (
    <View
      testID="letter-rail"
      style={styles.rail}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // A drag down the rail stays the rail's: the list behind it must not
      // take the gesture over as a scroll.
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={(e) => jumpTo(e.nativeEvent.pageY)}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}
    >
      <View style={styles.letters}>
        {letters.map((letter) => (
          <Text
            key={letter}
            testID={`rail-${letter}`}
            selectable={false}
            // Each letter keeps its fixed `sizes.rail.letter` pitch, which the
            // touch mapping above relies on, so its text may grow only so far.
            maxFontSizeMultiplier={fontScaleCap.rail}
            style={[
              styles.letter,
              { color: letter === current ? colors.accentLine : colors.textMuted },
            ]}
          >
            {letter}
          </Text>
        ))}
      </View>
    </View>
  );
}
