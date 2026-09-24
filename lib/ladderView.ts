// Pure difficulty-ladder model. Kept out of the screen so the unlock rules
// are unit-testable — the project's Vitest setup has no RN renderer, so this
// file must never import from `components/`.
import type { Level } from '@/lib/questionEngine';
import { PASS_RATIO, ROUND_LENGTH, scoreKey } from '@/lib/scoring';

const LEVELS: Level[] = [1, 2, 3];

/** The lowest score that passes a round: 8 of 10 at `PASS_RATIO` 0.8. */
const PASS_MARK = Math.ceil(PASS_RATIO * ROUND_LENGTH);

/** `cleared`: passed, at the same bar as the results screen's verdict.
 *  `unlocked`: open to play, perhaps already played below the bar. */
export type DifficultyStatus = 'cleared' | 'unlocked' | 'locked';

export interface LadderRow {
  level: Level;
  status: DifficultyStatus;
  /** The best recorded score. Never on a locked rung. */
  best?: { correct: number; total: number };
  /** Present only when locked — states what clears the gate, so the padlock
   *  is not left to imply it. */
  unlockHint?: string;
}

/** Each level opens only once the one before it is open and cleared. */
export function ladderRows(squadId: string, bestScores: Record<string, number>): LadderRow[] {
  let open = true;
  return LEVELS.map((level): LadderRow => {
    if (!open) {
      return {
        level,
        status: 'locked',
        unlockHint: `Score ${PASS_MARK}/${ROUND_LENGTH} on L${level - 1}`,
      };
    }
    const score = bestScores[scoreKey(squadId, level)];
    if (score === undefined) {
      open = false;
      return { level, status: 'unlocked' };
    }
    const cleared = score >= PASS_MARK;
    open = cleared;
    return {
      level,
      status: cleared ? 'cleared' : 'unlocked',
      best: { correct: score, total: ROUND_LENGTH },
    };
  });
}

/** The rung the ladder expands into a Play card: the first level still to
 *  clear (a retry, if it's been played), else the last level (a replay),
 *  else level 1. */
export function focusedLevel(rows: LadderRow[]): Level {
  const next = rows.find((r) => r.status === 'unlocked');
  if (next) return next.level;
  const open = rows.filter((r) => r.status !== 'locked');
  return open[open.length - 1]?.level ?? 1;
}

export function playLabel(row: LadderRow): string {
  return row.best ? 'Play Again' : 'Play';
}

/** What a screen reader announces for a compact rung, whose status is
 *  otherwise carried only by its badge and pill. */
export function rungAccessibilityLabel(row: LadderRow, title: string): string {
  if (row.status === 'locked') {
    return row.unlockHint ? `${title}, locked, ${row.unlockHint}` : `${title}, locked`;
  }
  if (row.best) return `${title}, best ${row.best.correct} of ${row.best.total}`;
  return title;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats a squad's `lastUpdated` (`YYYY-MM-DD`) as "21 Aug 2026" for the
 *  difficulty screen's staleness footnote. */
export function formatLastUpdated(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}
