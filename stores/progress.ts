import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ProgressState {
  bestScores: Record<string, number>; // key: `${squadId}:${level}`
  recordScore: (squadId: string, level: number, score: number) => void;
  reset: () => void;
}

export const scoreKey = (squadId: string, level: number) => `${squadId}:${level}`;

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      bestScores: {},
      recordScore: (squadId, level, score) =>
        set((s) => {
          const key = scoreKey(squadId, level);
          const prev = s.bestScores[key] ?? 0;
          return score > prev ? { bestScores: { ...s.bestScores, [key]: score } } : s;
        }),
      reset: () => set({ bestScores: {} }),
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
