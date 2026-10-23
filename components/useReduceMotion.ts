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
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (current) setReduced(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      current = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
