import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { scoreKey } from '@/lib/scoring';

// Re-exported so existing importers (e.g. `app/index.tsx`) keep working —
// `scoreKey` is a scoring scalar defined once in `lib/scoring.ts`, not here.
export { scoreKey };

interface LastPlayed {
  squadId: string;
  level: number;
}

interface ProgressState {
  bestScores: Record<string, number>; // key: `${squadId}:${level}`
  /** Set true the moment a level is finished, independent of `bestScores` —
   *  a legitimate 0/10 round wouldn't raise `bestScores` above its default
   *  of 0, which would otherwise make the difficulty ladder's "unlocked once
   *  the prior level has a recorded score" gate impossible to clear. */
  completedLevels: Record<string, true>;
  /** Backs Home's "continue" card — the most recent team+level a round was
   *  started for, regardless of how it finished. */
  lastPlayed: LastPlayed | null;
  recordScore: (squadId: string, level: number, score: number) => void;
  setLastPlayed: (squadId: string, level: number) => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      bestScores: {},
      completedLevels: {},
      lastPlayed: null,
      recordScore: (squadId, level, score) =>
        set((s) => {
          const key = scoreKey(squadId, level);
          const prev = s.bestScores[key] ?? 0;
          return {
            bestScores: score > prev ? { ...s.bestScores, [key]: score } : s.bestScores,
            completedLevels: { ...s.completedLevels, [key]: true },
          };
        }),
      setLastPlayed: (squadId, level) => set({ lastPlayed: { squadId, level } }),
      reset: () => set({ bestScores: {}, completedLevels: {}, lastPlayed: null }),
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
