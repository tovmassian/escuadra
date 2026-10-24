import { createContext, useContext, useRef, useState, type RefObject } from 'react';
import type { ViewInstance } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { DockRect } from '@/lib/launchIntro';

// What the launch intro (#182) and Home share for the hand-off: the intro's
// lockup docks into Home's (spec, Hand-off to Home). The root layout owns it.
// - `reveal` runs 0 → 1 over the dock; Home's lockup and content read it. It
//   is 1 whenever the intro is not showing, so Home never waits on it.
// - Home's `Wordmark` registers its mark and word while it is mounted. The
//   intro measures them, and its own, as it ends: it docks into them, or fades
//   if there are none.

/** Home's lockup: the views the intro docks into. */
export interface HomeLockup {
  mark: RefObject<ViewInstance | null>;
  word: RefObject<ViewInstance | null>;
}

export interface LaunchReveal {
  reveal: SharedValue<number>;
  /** Registers Home's lockup; returns what unregisters it. */
  registerLockup: (lockup: HomeLockup) => () => void;
  lockup: () => HomeLockup | null;
}

const LaunchRevealContext = createContext<LaunchReveal | null>(null);

export const LaunchRevealProvider = LaunchRevealContext.Provider;

/** The provider's state. `revealed`, read once, is whether Home starts at
 *  rest: true when the intro will not show this launch. */
export function useLaunchRevealState(revealed: boolean): LaunchReveal {
  const reveal = useSharedValue(revealed ? 1 : 0);
  const lockupRef = useRef<HomeLockup | null>(null);
  // Stable across renders, so a registering effect never reruns for it.
  const [value] = useState<LaunchReveal>(() => ({
    reveal,
    registerLockup: (lockup) => {
      lockupRef.current = lockup;
      return () => {
        if (lockupRef.current === lockup) lockupRef.current = null;
      };
    },
    lockup: () => lockupRef.current,
  }));
  return value;
}

/** Null outside the provider: everything then shows at rest. */
export function useLaunchReveal(): LaunchReveal | null {
  return useContext(LaunchRevealContext);
}

/** Where a view is in the window, or null when it is not mounted. Both ends of
 *  the dock are measured this way, at the same moment, so they share one
 *  coordinate space. */
export function measureInWindow(view: ViewInstance | null): Promise<DockRect | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}
