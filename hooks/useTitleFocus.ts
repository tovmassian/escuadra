import { durations } from '@/theme/tokens';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Platform, type TextInstance, type ViewInstance } from 'react-native';
import { useScreenAppearance } from './useScreenAppearance';
import { useScreenReader } from './useScreenReader';

const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export interface TitleFocus {
  /** For when what held the focus is gone: a sheet's confirm that removes the
   *  button that opened it. */
  refocus: () => void;
  /** Spread on the controls above the title, its back button or top bar. */
  chrome: Partial<typeof HIDDEN>;
}

/**
 * Starts VoiceOver or TalkBack on `title`, the screen's own header, each time
 * the screen has appeared: opened, returned to, or reached by a reset. Left
 * alone, a screen reader starts on the screen's first control, its back button
 * or Home's gear (#187).
 *
 * The platforms differ. TalkBack stays where it was when a screen appears, so the
 * focus is moved to the title. VoiceOver moves to the screen's first element
 * itself, once the transition has ended; a move before that is undone, one after
 * it is heard after the back button. So on iOS the controls above the title
 * (`chrome`) stay out of the order while the screen settles, and the title is
 * the first element.
 *
 * `enabled` false holds it while How to play's tips are up, whose kicker takes
 * the focus; the title takes it once they close.
 */
export function useTitleFocus(
  title: RefObject<ViewInstance | TextInstance | null>,
  enabled = true,
): TitleFocus {
  const screenReader = useScreenReader();
  const { appeared, settling } = useScreenAppearance();
  const moved = Platform.OS === 'android' ? appeared : 0;
  const [refocused, setRefocused] = useState(0);

  // On an appearance (Android), a refocus, or the tips closing, which leaves the
  // focus nowhere on either platform.
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    const tipsClosed = enabled && !wasEnabled.current;
    wasEnabled.current = enabled;
    if (!enabled || !screenReader || Platform.OS === 'web') return;
    if (moved === 0 && refocused === 0 && !tipsClosed) return;
    const node = title.current;
    if (node) AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
  }, [moved, refocused, enabled, screenReader, title]);

  // A closing sheet hands the focus back to the screen as it goes, so the title
  // takes it a sheet's slide later, once that is done.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const refocus = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setRefocused((n) => n + 1), durations.sheet);
  }, []);

  return { refocus, chrome: Platform.OS === 'ios' && settling ? HIDDEN : {} };
}
