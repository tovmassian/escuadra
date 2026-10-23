import { createContext, useContext, useRef, useState } from 'react';
import type { View } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { DockRect } from '@/lib/launchIntro';

// What the launch intro (#182) and Home share for the hand-off: the intro's
// lockup docks into Home's (spec, Hand-off to Home). The root layout owns it.
// - `reveal` runs 0 → 1 over the dock; Home's lockup and content read it. It
//   is 1 whenever the intro is not showing, so Home never waits on it.
// - Home's `Wordmark` reports where its mark and word are; the intro reads the
//   latest report when it ends, and docks into it, or fades if there is none.

/** Home's lockup, in window coordinates. */
export interface DockTarget {
  mark: DockRect;
  word: DockRect;
}

export interface LaunchReveal {
  reveal: SharedValue<number>;
  reportTarget: (target: DockTarget) => void;
  target: () => DockTarget | null;
}

const LaunchRevealContext = createContext<LaunchReveal | null>(null);

export const LaunchRevealProvider = LaunchRevealContext.Provider;

/** The root layout's state for the provider. `revealed` is whether Home
 *  starts at rest: true when the intro will not show this launch. */
export function useLaunchRevealState(revealed: boolean): LaunchReveal {
  const reveal = useSharedValue(revealed ? 1 : 0);
  const targetRef = useRef<DockTarget | null>(null);
  // Stable across renders, so a reporter's effect never reruns for it.
  const [value] = useState<LaunchReveal>(() => ({
    reveal,
    reportTarget: (target) => {
      targetRef.current = target;
    },
    target: () => targetRef.current,
  }));
  return value;
}

/** Null outside the provider: everything then shows at rest. */
export function useLaunchReveal(): LaunchReveal | null {
  return useContext(LaunchRevealContext);
}

/** Where a view is in the window, or null when it is not mounted. Both ends of
 *  the dock are measured this way, so they share one coordinate space. */
export function measureInWindow(view: View | null): Promise<DockRect | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}
