import { screenReaderSettle } from '@/theme/tokens';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { AccessibilityInfo, Platform, type TextInstance, type ViewInstance } from 'react-native';
import { useScreenReader } from './useScreenReader';

/**
 * Runs a press that takes the pressed control away, with VoiceOver moved off
 * it first (#226): to `via`, which the press leaves as it is, and the change a
 * beat later. Left on a control that goes, VoiceOver ignores a move sent after
 * it and, once the screen is still, starts on whatever took the control's
 * place: a slot chip, or the next part's tile. A move made while the control is
 * still there is honoured, as How to play's tips show.
 *
 * Once `shown`, a key for what the screen shows, has changed after a hand-off,
 * `target` takes the focus and VoiceOver reads its new words: a beat later,
 * once what came in has risen in, as How to play's tips wait for theirs. A
 * move made while it still rises is dropped, or lands next to the target, on
 * a slot chip or the first tile. Never `target` for both moves: VoiceOver
 * doesn't read an element it is already on again when its words change, and
 * reads a Text through elements rebuilt with its words, so the change would
 * take a Text from under it.
 *
 * Only on iOS with VoiceOver on: TalkBack reads the prompt's live region, and
 * sighted play never waits. `removes` false runs a press at once everywhere,
 * for a control that stays. A press during a hand-off is dropped, so a second
 * one can't skip a question.
 */
export function useFocusHandOff(
  target: RefObject<ViewInstance | TextInstance | null>,
  via: RefObject<ViewInstance | null>,
  shown: string,
): (change: () => void, removes?: boolean) => void {
  const screenReader = useScreenReader();
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handedOff = useRef(false);
  useEffect(() => () => clearTimeout(pending.current), []);

  useEffect(() => {
    if (!handedOff.current) return;
    handedOff.current = false;
    pending.current = setTimeout(() => {
      pending.current = undefined;
      const node = target.current;
      if (node) AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
    }, screenReaderSettle.handOff);
  }, [shown, target]);

  return useCallback(
    (change: () => void, removes = true) => {
      if (pending.current !== undefined) return;
      if (!removes || !screenReader || Platform.OS !== 'ios') {
        change();
        return;
      }
      const node = via.current;
      if (node) AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
      pending.current = setTimeout(() => {
        pending.current = undefined;
        handedOff.current = true;
        change();
      }, screenReaderSettle.handOff);
    },
    [screenReader, via],
  );
}
