import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { scoreKey } from '@/lib/scoring';
import type { ThemePreference } from '@/theme/tokens';

// Re-exported so existing importers (e.g. `app/index.tsx`) keep working —
// `scoreKey` is a scoring scalar defined once in `lib/scoring.ts`, not here.
export { scoreKey };

interface LastPlayed {
  squadId: string;
  level: number;
}

interface ProgressState {
  bestScores: Record<string, number>; // key: `${squadId}:${level}`
  /** Backs Home's "continue" card — the most recent team+level a round was
   *  started for, regardless of how it finished. */
  lastPlayed: LastPlayed | null;
  /** Appearance preference. `'system'` follows the device setting; an explicit
   *  value pins one theme. Survives `reset()`, which clears game progress
   *  only — reverting someone's appearance choice alongside their scores
   *  would be a surprise, and the two are unrelated. */
  themePreference: ThemePreference;
  recordScore: (squadId: string, level: number, score: number) => void;
  setLastPlayed: (squadId: string, level: number) => void;
  setThemePreference: (preference: ThemePreference) => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      bestScores: {},
      lastPlayed: null,
      themePreference: 'system',
      recordScore: (squadId, level, score) =>
        set((s) => {
          const key = scoreKey(squadId, level);
          const prev = s.bestScores[key];
          // `prev === undefined`, not `?? 0`: a first round of 0/10 is still a
          // score the ladder and picker should show as played.
          return {
            bestScores:
              prev === undefined || score > prev ? { ...s.bestScores, [key]: score } : s.bestScores,
          };
        }),
      setLastPlayed: (squadId, level) => set({ lastPlayed: { squadId, level } }),
      setThemePreference: (themePreference) => set({ themePreference }),
      reset: () => set({ bestScores: {}, lastPlayed: null }),
    }),
    {
      name: 'escuadra-progress',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * `true` once the persisted state has been read back off disk. Anything that
 * renders a best score should wait for this, otherwise it flashes zeroes on a
 * cold start.
 */
export function useProgressHydrated() {
  const [hydrated, setHydrated] = useState(() => useProgress.persist.hasHydrated());

  useEffect(() => {
    const unsub = useProgress.persist.onFinishHydration(() => setHydrated(true));
    if (useProgress.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  return hydrated;
}
