// Home's view model (#181): returning or first run, and Continue's text. Pure,
// so the screen stays layout and these rules stay testable.
import type { Messages } from '@/i18n/en';
import { isOutdated, type BestScore } from '@/lib/bestScore';
import { ROUND_LENGTH, scoreKey } from '@/lib/scoring';
import { starredTeams } from '@/lib/starred';
import type { SquadManifestEntry } from '@/types/squad';

export interface HomeContinue {
  squad: SquadManifestEntry;
  level: number;
  /** That level's best, if a round of it has finished. */
  best: { score: number; outdated: boolean } | undefined;
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
  const best = input.bestScores[scoreKey(squad.id, last.level)];
  return {
    kind: 'returning',
    continue: {
      squad,
      level: last.level,
      best:
        best === undefined
          ? undefined
          : { score: best.score, outdated: isOutdated(best, squad.lastUpdated) },
    },
    starred,
  };
}

/** "LEVEL 2 · BEST 7/10"; the screen adds the OUTDATED mark after it. */
export function continueMeta(c: HomeContinue, messages: Messages): string {
  return messages.home.continueMeta(c.level, c.best?.score, ROUND_LENGTH);
}

/** Continue as one spoken button, read the way a picker row is. */
export function continueSpoken(name: string, c: HomeContinue, messages: Messages): string {
  const progress =
    c.best === undefined
      ? messages.common.level(c.level)
      : c.best.outdated
        ? messages.picker.bestOutdatedSpoken(c.level, c.best.score, ROUND_LENGTH)
        : messages.picker.bestSpoken(c.level, c.best.score, ROUND_LENGTH);
  return `${messages.home.continueTeam(name)}, ${progress}`;
}
