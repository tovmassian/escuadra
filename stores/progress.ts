import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LanguagePreference } from '@/i18n/resolveLanguage';
import { scoreKey } from '@/lib/scoring';
import { toggleStarred } from '@/lib/starred';
import type { StudyView } from '@/lib/studyView';
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
  /** The app's language (#141): `'system'` follows the phone, an explicit
   *  language pins it. A preference like `themePreference`, so it survives
   *  `reset()`. Set by Settings' language sheet (#175). */
  languagePreference: LanguagePreference;
  /** Random UUID created once per installation, the anonymous `clientUser`
   *  for telemetry. Null until the root layout creates it after hydration.
   *  Survives `reset()`; a reinstall clears storage and so gets a new one. */
  installId: string | null;
  /** Settings' opt-out. Off means `lib/telemetry.ts` sends nothing.
   *  Survives `reset()` for the same reason as `themePreference`. */
  telemetryEnabled: boolean;
  /** Settings' Vibration switch (spec §7, #175). Off means `lib/haptics.ts`
   *  plays nothing. On by default; survives `reset()` like the other settings. */
  haptics: boolean;
  /** Study's grid or list view (spec §5.1). A preference like `themePreference`,
   *  so it survives `reset()`. */
  studyView: StudyView;
  /** The app version that last asked the OS for its store-rating dialog
   *  (#57), so each version asks at most once. Null until one has. Survives
   *  `reset()`: clearing scores should not earn a second ask. */
  reviewAskedVersion: string | null;
  /** Your squads (#179): the squad ids starred on Difficulty, newest first.
   *  A preference like `themePreference`, so it survives `reset()`. */
  starredSquads: string[];
  recordScore: (squadId: string, level: number, score: number) => void;
  setLastPlayed: (squadId: string, level: number) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setLanguagePreference: (preference: LanguagePreference) => void;
  setInstallId: (installId: string) => void;
  setTelemetryEnabled: (enabled: boolean) => void;
  setHaptics: (enabled: boolean) => void;
  setStudyView: (view: StudyView) => void;
  setReviewAskedVersion: (version: string) => void;
  toggleStar: (squadId: string) => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      bestScores: {},
      lastPlayed: null,
      themePreference: 'system',
      languagePreference: 'system',
      installId: null,
      telemetryEnabled: true,
      haptics: true,
      studyView: 'grid',
      reviewAskedVersion: null,
      starredSquads: [],
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
      setLanguagePreference: (languagePreference) => set({ languagePreference }),
      setInstallId: (installId) => set((s) => (s.installId === null ? { installId } : s)),
      setTelemetryEnabled: (telemetryEnabled) => set({ telemetryEnabled }),
      setHaptics: (haptics) => set({ haptics }),
      setStudyView: (studyView) => set({ studyView }),
      setReviewAskedVersion: (reviewAskedVersion) => set({ reviewAskedVersion }),
      toggleStar: (squadId) =>
        set((s) => ({ starredSquads: toggleStarred(s.starredSquads, squadId) })),
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
