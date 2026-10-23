// Home's view model (#181): returning or first run, and Continue's text. Pure,
// so the screen stays layout and these rules stay testable.
import type { Messages } from '@/i18n/en';
import { A_LA_ESCUADRA } from '@/i18n/names';
import type { BestScore } from '@/lib/bestScore';
import { focusedLevel, isEscuadra, ladderRows } from '@/lib/ladderView';
import { ROUND_LENGTH } from '@/lib/scoring';
import { starredTeams } from '@/lib/starred';
import type { SquadManifestEntry } from '@/types/squad';

/** Continue: the last team played, at the rung its Difficulty focuses, which
 *  is where the button takes the player. */
export interface HomeContinue {
  squad: SquadManifestEntry;
  /** The nearest level still to clear, else the last: `focusedLevel`. */
  level: number;
  /** That level's best, if a round of it has finished. */
  best: { score: number; outdated: boolean } | undefined;
  /** Every level cleared and the last a current 10/10: the squad is done. */
  escuadra: boolean;
}

export type HomeView =
  | { kind: 'loading' }
  | { kind: 'returning'; continue: HomeContinue; starred: SquadManifestEntry[] }
  | { kind: 'firstRun'; starred: SquadManifestEntry[] };

export function homeView(input: {
  hydrated: boolean;
  lastPlayed: { squadId: string; level: number } | null;
  bestScores: Record<string, BestScore>;
  starred: readonly string[];
  squads: readonly SquadManifestEntry[];
}): HomeView {
  if (!input.hydrated) return { kind: 'loading' };
  const starred = starredTeams(input.starred, input.squads);
  const last = input.lastPlayed;
  // A last team that has left the data is first run again: there is nothing to continue.
  const squad = last === null ? undefined : input.squads.find((s) => s.id === last.squadId);
  if (last === null || squad === undefined) return { kind: 'firstRun', starred };
  // The level last played is not the point: Continue shows what Difficulty will
  // offer next, so a cleared level 1 points at level 2.
  const rows = ladderRows(squad.id, input.bestScores, squad.lastUpdated);
  const level = focusedLevel(rows);
  const row = rows.find((r) => r.level === level) ?? { level, status: 'unlocked' as const };
  return {
    kind: 'returning',
    continue: {
      squad,
      level,
      best: row.best && { score: row.best.correct, outdated: row.best.outdated },
      escuadra: isEscuadra(row),
    },
    starred,
  };
}

/** "LEVEL 2 · BEST 7/10", "LEVEL 2 · Not played yet" or "a la escuadra"; the
 *  style sets it in capitals, and the screen adds the OUTDATED mark after it. */
export function continueMeta(c: HomeContinue, messages: Messages): string {
  if (c.escuadra) return A_LA_ESCUADRA;
  const level = messages.home.continueMeta(c.level, c.best?.score, ROUND_LENGTH);
  return c.best === undefined ? `${level} · ${messages.ladder.notPlayed}` : level;
}

/** Continue as one spoken button, its level read the way a picker row is. */
export function continueSpoken(name: string, c: HomeContinue, messages: Messages): string {
  const progress = c.escuadra
    ? A_LA_ESCUADRA
    : c.best === undefined
      ? `${messages.common.level(c.level)}, ${messages.ladder.notPlayed}`
      : c.best.outdated
        ? messages.picker.bestOutdatedSpoken(c.level, c.best.score, ROUND_LENGTH)
        : messages.picker.bestSpoken(c.level, c.best.score, ROUND_LENGTH);
  return `${messages.home.continueTeam(name)}, ${progress}`;
}
