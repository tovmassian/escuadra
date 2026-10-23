import type { BestScore } from './bestScore';

// Reset progress (#197): the pure part of the three resets. A best score's key
// is `${squadId}:${level}` (`scoreKey`), so a squad's keys are the ones whose
// id, up to the last colon, is that squad's.

function squadOf(key: string): string {
  return key.slice(0, key.lastIndexOf(':'));
}

/** Every best score but `squadId`'s; the same object when it has none. */
export function withoutSquad(
  bestScores: Record<string, BestScore>,
  squadId: string,
): Record<string, BestScore> {
  const kept = Object.entries(bestScores).filter(([key]) => squadOf(key) !== squadId);
  return kept.length === Object.keys(bestScores).length ? bestScores : Object.fromEntries(kept);
}

/** `squadId`'s bests, level by level: the Start over sheet's "L1 10 · L2 8". */
export function squadScores(
  bestScores: Record<string, BestScore>,
  squadId: string,
): { level: number; score: number }[] {
  return Object.entries(bestScores)
    .filter(([key]) => squadOf(key) === squadId)
    .map(([key, best]) => ({
      level: Number(key.slice(key.lastIndexOf(':') + 1)),
      score: best.score,
    }))
    .sort((a, b) => a.level - b.level);
}

/** How many bests there are, and over how many teams: Clear all's count. */
export function scoreSummary(bestScores: Record<string, BestScore>): {
  scores: number;
  teams: number;
} {
  const keys = Object.keys(bestScores);
  return { scores: keys.length, teams: new Set(keys.map(squadOf)).size };
}
