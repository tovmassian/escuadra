import { screenReaderSettle } from '@/theme/tokens';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { AccessibilityInfo, Platform, type TextInstance, type ViewInstance } from 'react-native';
import { useScreenReader } from './useScreenReader';

/**
 * Runs a press that takes the pressed control away, with VoiceOver moved off
 * it first (#226): to `target`, which stays on screen, and the change a beat
 * later. Left on a control that goes, VoiceOver ignores a move sent after it
 * and, once the screen is still, starts on whatever took the control's place: a
 * slot chip, or the next part's tile. A move made while the control is still
 * there is honoured, as How to play's tips show.
 *
 * Once `shown`, what `target` says, has changed after a hand-off, the target
 * takes the focus again, so VoiceOver reads its new words.
 *
 * Only on iOS with VoiceOver on: TalkBack reads the prompt's live region, and
 * sighted play never waits. `removes` false runs a press at once everywhere,
 * for a control that stays. A press during a hand-off is dropped, so a second
 * one can't skip a question.
 */
export function useFocusHandOff(
  target: RefObject<ViewInstance | TextInstance | null>,
  shown: string,
): (change: () => void, removes?: boolean) => void {
  const screenReader = useScreenReader();
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handedOff = useRef(false);
  useEffect(() => () => clearTimeout(pending.current), []);

  useEffect(() => {
    if (!handedOff.current) return;
    handedOff.current = false;
    const node = target.current;
    if (node) AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
  }, [shown, target]);

  return useCallback(
    (change: () => void, removes = true) => {
      if (pending.current !== undefined) return;
      if (!removes || !screenReader || Platform.OS !== 'ios') {
        change();
        return;
      }
      const node = target.current;
      if (node) AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
      pending.current = setTimeout(() => {
        pending.current = undefined;
        handedOff.current = true;
        change();
      }, screenReaderSettle.handOff);
    },
    [screenReader, target],
  );
}
