// Pure difficulty-ladder model. Kept out of the screen so the unlock rules
// are unit-testable — the project's Vitest setup has no RN renderer, so this
// file must never import from `components/`.
import type { Messages } from '@/i18n/en';
import { isOutdated, type BestScore } from '@/lib/bestScore';
import { leagueName } from '@/lib/pickerView';
import type { Level } from '@/lib/questionEngine';
import { PASS_RATIO, ROUND_LENGTH, scoreKey } from '@/lib/scoring';
import type { League, Squad } from '@/types/squad';

const LEVELS: Level[] = [1, 2, 3];

/** The lowest score that passes a round: 8 of 10 at `PASS_RATIO` 0.8. */
const PASS_MARK = Math.ceil(PASS_RATIO * ROUND_LENGTH);

/** `cleared`: passed, at the same bar as the results screen's verdict.
 *  `unlocked`: open to play, perhaps already played below the bar. */
export type DifficultyStatus = 'cleared' | 'unlocked' | 'locked';

export interface LadderRow {
  level: Level;
  status: DifficultyStatus;
  /** The best recorded score. Never on a locked rung. `outdated`: set before
   *  the squad was last updated (#180), so drawn grey. */
  best?: { correct: number; total: number; outdated: boolean };
}

/** Each level opens only once the one before it is open and cleared. An
 *  outdated score still counts, so a squad update never locks a level again.
 *  `lastUpdated` is the squad's current date. */
export function ladderRows(
  squadId: string,
  bestScores: Record<string, BestScore>,
  lastUpdated: string,
): LadderRow[] {
  let open = true;
  return LEVELS.map((level): LadderRow => {
    if (!open) {
      return { level, status: 'locked' };
    }
    const best = bestScores[scoreKey(squadId, level)];
    if (best === undefined) {
      open = false;
      return { level, status: 'unlocked' };
    }
    const cleared = best.score >= PASS_MARK;
    open = cleared;
    return {
      level,
      status: cleared ? 'cleared' : 'unlocked',
      best: { correct: best.score, total: ROUND_LENGTH, outdated: isOutdated(best, lastUpdated) },
    };
  });
}

/** Whether any shown score is outdated: Difficulty then says why some are grey. */
export function hasOutdated(rows: LadderRow[]): boolean {
  return rows.some((r) => r.best?.outdated === true);
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

/** The hero's mono line: "National team · 2026 · 26 players", or the club's
 *  league in place of "National team". Capitals come from the style. */
export function heroLine(
  squad: Pick<Squad, 'kind' | 'season' | 'members'>,
  league: League | undefined,
  messages: Messages,
): string {
  const lead =
    squad.kind === 'nation' ? messages.ladder.nationalTeam : league ? leagueName(league) : null;
  return [lead, squad.season, messages.study.players(squad.members.length)]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/** What a level asks. Level 3's last part is the club for a nation squad and
 *  the nationality for a club squad. */
export function levelDescription(level: Level, kind: Squad['kind'], messages: Messages): string {
  if (level === 3) {
    const l3 = messages.ladder.levels[3];
    return kind === 'club' ? l3.descriptionClub : l3.descriptionNation;
  }
  return level === 1
    ? messages.ladder.levels[1].description
    : messages.ladder.levels[2].description;
}

/** A compact rung is always cleared or locked; a cleared one is tagged
 *  a la escuadra at full marks. */
export type RungTag = 'escuadra' | 'cleared';
export function rungTag(best: { correct: number; total: number }): RungTag {
  return best.correct === best.total ? 'escuadra' : 'cleared';
}

/** The focused card's status line, as shown and as spoken. */
export function statusLine(row: LadderRow, messages: Messages): { text: string; spoken: string } {
  if (!row.best) return { text: messages.ladder.notPlayed, spoken: messages.ladder.notPlayed };
  const { correct, total, outdated } = row.best;
  if (outdated) {
    return {
      text: messages.ladder.bestOutdated(correct, total),
      spoken: messages.ladder.bestOutdatedSpoken(correct, total),
    };
  }
  return {
    text: messages.ladder.yourBest(correct, total),
    spoken: messages.ladder.yourBestSpoken(correct, total),
  };
}

export function playLevelLabel(level: Level, messages: Messages): string {
  return messages.ladder.playLevel(level);
}

/** What a screen reader announces for a compact rung, whose status is
 *  otherwise carried only by its badge and pill. */
export function rungAccessibilityLabel(row: LadderRow, title: string, messages: Messages): string {
  if (row.status === 'locked') {
    return messages.ladder.rungLocked(title, PASS_MARK, ROUND_LENGTH, row.level - 1);
  }
  if (row.best?.outdated) {
    return messages.ladder.rungOutdated(title, row.best.correct, row.best.total);
  }
  if (row.best && row.status === 'cleared') {
    const { correct, total } = row.best;
    return rungTag(row.best) === 'escuadra'
      ? messages.ladder.rungEscuadra(title, correct, total)
      : messages.ladder.rungCleared(title, correct, total);
  }
  if (row.best) return messages.ladder.rungBest(title, row.best.correct, row.best.total);
  return title;
}

/** The line under "The ladder" when a score is outdated (#180). */
export function squadUpdatedLine(lastUpdated: string, messages: Messages): string {
  return messages.ladder.squadUpdated(formatLastUpdated(lastUpdated, messages));
}

/** Formats a squad's `lastUpdated` (`YYYY-MM-DD`) for the difficulty
 *  screen's staleness footnote: "21 Aug 2026" in English. */
export function formatLastUpdated(isoDate: string, messages: Messages): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return messages.formats.date({ day: day ?? 1, month: month ?? 1, year: year ?? 0 });
}
