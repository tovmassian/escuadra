// Pure team-picker row model. Kept out of the screen so it is unit-testable.
import { PASS_RATIO, ROUND_LENGTH, scoreKey } from '@/lib/scoring';
import type { League, SquadManifestEntry } from '@/types/squad';

const LEVELS = [1, 2, 3] as const;

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

/** The team picker row's mono meta line: the season, plus progress once it's
 *  known. `undefined` progress (still hydrating) shows the season alone
 *  rather than a placeholder dash, since the season itself needs no store
 *  read and is available immediately. */
export function teamMetaLine(season: string, progress: TeamProgress | null | undefined): string {
  if (progress === undefined) return season;
  if (progress === null) return `${season} · NOT PLAYED`;
  return `${season} · LEVEL ${progress.level} · BEST ${progress.correct}/${progress.total}`;
}

/** The clubs tab's league filter. `'ALL'` is the default, unfiltered state. */
export type LeagueFilter = 'ALL' | League;

export const LEAGUE_LABELS: Record<LeagueFilter, string> = {
  ALL: 'ALL',
  'la-liga': 'La Liga',
  'serie-a': 'Serie A',
  'premier-league': 'Premier League',
  bundesliga: 'Bundesliga',
  'ligue-1': 'Ligue 1',
  ucl: 'UCL',
};

/** Pill order: the big five, then UCL. Fixed rather than alphabetical so the
 *  row doesn't reshuffle as squads are added. */
const LEAGUE_ORDER: readonly League[] = [
  'premier-league',
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
  'ucl',
];

/** `'ALL'` plus every league that actually has a club in the manifest, in
 *  `LEAGUE_ORDER`. Derived from the data rather than from the `League` union,
 *  so a league nobody has added a squad for yet never renders a pill that
 *  filters the list down to nothing. */
export function leagueFilters(squads: SquadManifestEntry[]): LeagueFilter[] {
  const present = new Set<League>();
  for (const squad of squads) {
    if (squad.kind === 'club' && squad.league !== undefined) present.add(squad.league);
  }
  return ['ALL', ...LEAGUE_ORDER.filter((l) => present.has(l))];
}

/** The rows the picker shows. `kind` always applies; `league` narrows clubs
 *  only — nation entries carry no league, so it is ignored on that tab.
 *  `query` narrows further by a case-insensitive substring of the name,
 *  composing with `kind` and `league` rather than replacing them. */
export function visibleSquads(
  squads: SquadManifestEntry[],
  kind: 'club' | 'nation',
  league: LeagueFilter,
  query = '',
): SquadManifestEntry[] {
  const q = query.trim().toLowerCase();
  return squads.filter(
    (s) =>
      s.kind === kind &&
      (kind !== 'club' || league === 'ALL' || s.league === league) &&
      (q === '' || s.name.toLowerCase().includes(q)),
  );
}
