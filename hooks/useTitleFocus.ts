import { durations } from '@/theme/tokens';
import { useNavigation, type NativeStackNavigationProp } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Platform, type TextInstance, type ViewInstance } from 'react-native';
import { useScreenReader } from './useScreenReader';

/**
 * Moves VoiceOver or TalkBack to `title`, the screen's own header, each time the
 * screen has appeared: opened, returned to, or reached by a reset. Left alone, a
 * screen reader starts on the screen's first element, its back button or Home's
 * gear (#187). `enabled` false holds it while the How to play tips are up, whose
 * kicker takes the focus; it lands on the title once they close.
 *
 * Returns `refocus`, for when what held the focus is gone: a sheet's confirm
 * that removes the button that opened it.
 */
export function useTitleFocus(
  title: RefObject<ViewInstance | TextInstance | null>,
  enabled = true,
): () => void {
  const screenReader = useScreenReader();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  // Counts the screen's appearances, so a return focuses the title again. The
  // stack reports one once the screen's transition has ended, after the screen
  // reader has moved to the screen's first element itself.
  const [appeared, setAppeared] = useState(0);
  useEffect(
    () =>
      navigation.addListener('transitionEnd', (event) => {
        if (!event.data.closing) setAppeared((n) => n + 1);
      }),
    [navigation],
  );

  useEffect(() => {
    if (appeared === 0 || !enabled || !screenReader || Platform.OS === 'web') return;
    const node = title.current;
    if (node) AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
  }, [appeared, enabled, screenReader, title]);

  // A closing sheet hands the focus back to the screen as it goes, so the title
  // takes it a sheet's slide later, once that is done.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAppeared((n) => n + 1), durations.sheet);
  }, []);
}
