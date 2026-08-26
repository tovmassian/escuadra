// Shared domain scalars for scoring — round length, the pass threshold, and
// the best-score storage key. These are read by pure `lib/` modules (the
// difficulty ladder, the team picker, the question engine, the results
// screen) as well as by `stores/progress.ts`, so they live in one dependency
// -free module rather than being defined once and re-imported sideways
// between unrelated screens' view models.
//
// This file must stay importable by a Vitest run that has no React Native
// renderer: no React, no store imports, no I/O. That is also why it must
// never import `@react-native-async-storage/async-storage`, `react`, or
// `zustand` — pulling in `stores/progress.ts` for a one-line template
// literal was the bug this module exists to fix.

/** The number of questions in a round. Determines both the actual round
 *  length built by `buildRound` and the denominator the UI prints as
 *  `BEST n/10`. A single source keeps the two from silently diverging. */
export const ROUND_LENGTH = 10;

/**
 * Shared pass threshold: the results screen's pass/fail verdict and the
 * picker's "cleared" badge are the same concept, so they share one constant
 * rather than two values that can silently drift apart.
 */
export const PASS_RATIO = 0.8;

/** The `bestScores` / `completedLevels` storage key for a team+level pair. */
export const scoreKey = (squadId: string, level: number) => `${squadId}:${level}`;
