// Pure difficulty-ladder model. Kept out of the screen so the unlock rules
// are unit-testable — the project's Vitest setup has no RN renderer, so this
// file must never import from `components/`.
import type { Messages } from '@/i18n/en';
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
}

/** Each level opens only once the one before it is open and cleared. */
export function ladderRows(squadId: string, bestScores: Record<string, number>): LadderRow[] {
  let open = true;
  return LEVELS.map((level): LadderRow => {
    if (!open) {
      return { level, status: 'locked' };
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

/** What clears a locked level's gate, so the padlock is not left to imply it. */
export function unlockHint(level: Level, messages: Messages): string {
  return messages.ladder.unlockHint(`${PASS_MARK}/${ROUND_LENGTH}`, level - 1);
}

export function playLabel(row: LadderRow, messages: Messages): string {
  return row.best ? messages.ladder.playAgain : messages.ladder.play;
}

/** What a screen reader announces for a compact rung, whose status is
 *  otherwise carried only by its badge and pill. */
export function rungAccessibilityLabel(row: LadderRow, title: string, messages: Messages): string {
  if (row.status === 'locked') {
    return messages.ladder.rungLocked(title, PASS_MARK, ROUND_LENGTH, row.level - 1);
  }
  if (row.best) return messages.ladder.rungBest(title, row.best.correct, row.best.total);
  return title;
}

/** Formats a squad's `lastUpdated` (`YYYY-MM-DD`) for the difficulty
 *  screen's staleness footnote: "21 Aug 2026" in English. */
export function formatLastUpdated(isoDate: string, messages: Messages): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return messages.formats.date({ day: day ?? 1, month: month ?? 1, year: year ?? 0 });
}
