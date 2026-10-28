import { screenReaderSettle } from '@/theme/tokens';
import { useNavigation, type NativeStackNavigationProp } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * The screen's appearances as the stack reports them (#187). `appeared` counts
 * each time it has appeared, opened or returned to, once its transition has
 * ended. `settling` is true while it appears and a moment after: iOS moves
 * VoiceOver to the screen's first element then, so whatever sits above the
 * title stays out of the order meanwhile (`useTitleFocus`'s `chrome`).
 */
export function useScreenAppearance(): { appeared: number; settling: boolean } {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [appeared, setAppeared] = useState(0);
  const [settling, setSettling] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settleIn = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => setSettling(false), ms);
    };
    // However the transition ends: a back swipe let go of, or none reported.
    settleIn(screenReaderSettle.max);
    const offStart = navigation.addListener('transitionStart', (event) => {
      if (event.data.closing) return;
      setSettling(true);
      settleIn(screenReaderSettle.max);
    });
    const offEnd = navigation.addListener('transitionEnd', (event) => {
      if (event.data.closing) return;
      setAppeared((n) => n + 1);
      settleIn(screenReaderSettle.settle);
    });
    return () => {
      clearTimeout(timer);
      offStart();
      offEnd();
    };
  }, [navigation]);

  return { appeared, settling };
}
