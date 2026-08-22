// Pure team-picker row model. Kept out of the screen so it is unit-testable.
import { scoreKey } from '@/stores/progress';

const LEVELS = [1, 2, 3] as const;
const ROUND_LENGTH = 10;
/** Matches the results screen's pass threshold. */
const PASS_RATIO = 0.8;

export interface TeamProgress {
  /** Highest level the team has a recorded score for. */
  level: number;
  correct: number;
  total: number;
  /** True once any level was passed — not only the highest one played. */
  cleared: boolean;
}

export function teamProgress(
  squadId: string,
  bestScores: Record<string, number>,
): TeamProgress | null {
  let highest: { level: number; correct: number } | null = null;
  let cleared = false;

  for (const level of LEVELS) {
    const score = bestScores[scoreKey(squadId, level)];
    if (score === undefined) continue;
    if (score / ROUND_LENGTH >= PASS_RATIO) cleared = true;
    if (highest === null || level > highest.level) highest = { level, correct: score };
  }

  if (highest === null) return null;
  return { level: highest.level, correct: highest.correct, total: ROUND_LENGTH, cleared };
}
