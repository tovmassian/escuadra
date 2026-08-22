// Pure difficulty-ladder model. Kept out of the screen so the unlock rules
// are unit-testable — the project's Vitest setup has no RN renderer, so this
// file must never import from `components/`.
import type { Level } from '@/lib/questionEngine';
import { scoreKey } from '@/stores/progress';

const LEVELS: Level[] = [1, 2, 3];
const ROUND_LENGTH = 10;

export type DifficultyStatus = 'best' | 'unlocked' | 'locked';

export interface LadderRow {
  level: Level;
  status: DifficultyStatus;
  best?: { correct: number; total: number };
  /** Present only when locked — states what clears the gate, so the padlock
   *  is not left to imply it. */
  unlockHint?: string;
}

export function ladderRows(
  squadId: string,
  bestScores: Record<string, number>,
  completedLevels: Record<string, true>,
): LadderRow[] {
  return LEVELS.map((level) => {
    const best = bestScores[scoreKey(squadId, level)];
    // `completedLevels`, not `bestScores`, so a legitimate 0/10 round still
    // unlocks the next level.
    const prevCompleted = level === 1 || completedLevels[scoreKey(squadId, level - 1)] === true;

    if (best !== undefined) {
      return { level, status: 'best', best: { correct: best, total: ROUND_LENGTH } };
    }
    if (prevCompleted) return { level, status: 'unlocked' };
    return { level, status: 'locked', unlockHint: `Clear L${level - 1}` };
  });
}
