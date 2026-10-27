import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

// What the system last reported, or null until it has. One subscription for
// the whole app, started by the first screen that asks.
let latest: boolean | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(enabled: boolean): void {
  latest = enabled;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    // A change that arrives first is newer than the one-off read.
    let heard = false;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (!heard) set(enabled);
      },
      () => {},
    );
    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      heard = true;
      set(enabled);
    });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * True while the system's Reduce Motion setting is on, and live. Reanimated's
 * own hook reads the setting once, as JavaScript starts, so it only seeds this
 * one. On Android an app stays running in the background, so a setting turned
 * on meanwhile went unseen: the round's goal still flew while the wall stood
 * still (#227). Every screen reads it here; the lint rule refuses Reanimated's.
 * On web, react-native-web's AccessibilityInfo follows `prefers-reduced-motion`.
 */
export function useReduceMotion(): boolean {
  const atLaunch = useReducedMotion();
  return useSyncExternalStore(
    subscribe,
    () => latest ?? atLaunch,
    () => atLaunch,
  );
}
