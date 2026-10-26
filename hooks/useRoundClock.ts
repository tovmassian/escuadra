import { useCallback, useEffect, useRef } from 'react';
import { useSession } from '@/stores/session';

/**
 * The round's active time (#221, `seconds`): runs while `running`, and adds each
 * stretch to the session's `activeMs` as it ends, so a round resumed after Back
 * keeps its clock. `stop` ends the current stretch at once, for a signal that
 * reads the time before the next render would.
 */
export function useRoundClock(running: boolean): { stop: () => void } {
  const since = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (since.current === null) return;
    useSession.getState().addActiveMs(Date.now() - since.current);
    since.current = null;
  }, []);

  useEffect(() => {
    if (!running) return;
    since.current = Date.now();
    return stop;
  }, [running, stop]);

  return { stop };
}
