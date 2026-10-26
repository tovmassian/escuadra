import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * True while the system's Reduce Motion setting is on, and live: Reanimated's
 * own hook reads the setting once, at module load, so it only seeds this one.
 * On web, react-native-web's AccessibilityInfo follows `prefers-reduced-motion`.
 * The wall's drift stops with it (#181).
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(useReducedMotion());
  useEffect(() => {
    let current = true;
    // A change that arrives first is newer than the one-off read below.
    let heard = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (current && !heard) setReduced(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      heard = true;
      setReduced(enabled);
    });
    return () => {
      current = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
