import { useEffect, useRef } from 'react';
import type { ViewInstance } from 'react-native';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  planShot,
  shotOrigin,
  type Box,
  type LiveShot,
  type Point,
  type ShotName,
  type ShotVerdict,
} from '@/lib/shot';
import { durations, spotlightCues } from '@/theme/tokens';

/** Where a tile was tapped: the press's window coordinates (0, 0 when it
 *  carried none, as a screen reader's activation may) and the tile itself. */
export interface ShotTap {
  pageX: number;
  pageY: number;
  tile: ViewInstance | null;
}

function measure(view: ViewInstance | null): Promise<Box | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

// The shot when a question is decided (#129, spec §6). It owns what the
// corner and the overlay read on the UI thread: the shot (`live`) and its
// clock, the ms since the ball left the tile.
// - `fire` waits for the slot to fill (`spotlightCues.slot`), since a long
//   answer can reflow the chips and move the corner. Then it measures the
//   overlay, the corner and the tile, plans the shot and strikes it at
//   `spotlightCues.ball`.
// - With Reduce Motion, or if something can't be measured, nothing flies:
//   the corner just turns.
// - A shot belongs to its question. The next question ignores it, and drops
//   one still waiting to be struck.
export function useShot(question: number) {
  const reduced = useReducedMotion();
  const live = useSharedValue<LiveShot | null>(null);
  const clock = useSharedValue(-1);
  const overlayRef = useRef<ViewInstance>(null);
  const cornerRef = useRef<ViewInstance>(null);
  const previous = useRef<Record<ShotVerdict, ShotName | null>>({ goal: null, miss: null });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onScreen = useRef<number | null>(question);

  useEffect(() => {
    onScreen.current = question;
    return () => {
      onScreen.current = null;
      clearTimeout(timer.current);
    };
  }, [question]);

  const strike = (shot: LiveShot, delay: number, end: number) => {
    clock.set(-1);
    live.set(shot);
    clock.set(
      withDelay(
        delay,
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(end, { duration: end, easing: Easing.linear }),
        ),
      ),
    );
  };

  const fire = (verdict: ShotVerdict, tap: ShotTap) => {
    const firedAt = Date.now();
    const still = (delay: number) =>
      strike({ question, verdict, impact: 0, frames: null }, delay, durations.transition);
    if (reduced) {
      still(0);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void Promise.all([
        measure(overlayRef.current),
        measure(cornerRef.current),
        measure(tap.tile),
      ]).then(([overlay, corner, tile]) => {
        if (onScreen.current !== question) return;
        const wait = Math.max(0, spotlightCues.ball - (Date.now() - firedAt));
        if (!overlay || !corner) {
          still(wait);
          return;
        }
        const local = (p: Point): Point => ({ x: p.x - overlay.x, y: p.y - overlay.y });
        const from = shotOrigin(
          tap.pageX || tap.pageY ? local({ x: tap.pageX, y: tap.pageY }) : null,
          tile ? { ...tile, ...local(tile) } : null,
        );
        if (!from) {
          still(wait);
          return;
        }
        const plan = planShot({
          verdict,
          from,
          corner: local(corner),
          bounds: overlay,
          seed: firedAt,
          previous: previous.current[verdict],
        });
        previous.current[verdict] = plan.name;
        strike({ question, verdict, impact: plan.impact, frames: plan.frames }, wait, plan.end);
      });
    }, spotlightCues.slot);
  };

  return { live, clock, overlayRef, cornerRef, fire };
}
