// Pure team-picker row model. Kept out of the screen so it is unit-testable.
import type { Messages } from '@/i18n/en';
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
export function teamMetaLine(
  season: string,
  progress: TeamProgress | null | undefined,
  messages: Messages,
): string {
  if (progress === undefined) return season;
  if (progress === null) return messages.picker.notPlayed(season);
  return messages.picker.played(season, progress.level, progress.correct, progress.total);
}

/** The clubs tab's league filter. `'ALL'` is the default, unfiltered state. */
export type LeagueFilter = 'ALL' | League;

/** League names are proper nouns, like club names: data, not catalog text. */
const LEAGUE_NAMES: Record<League, string> = {
  'premier-league': 'Premier League',
  'la-liga': 'La Liga',
  'serie-a': 'Serie A',
  bundesliga: 'Bundesliga',
  'ligue-1': 'Ligue 1',
  ucl: 'UCL',
};

/** A league pill's label. */
export function leagueLabel(filter: LeagueFilter, messages: Messages): string {
  return filter === 'ALL' ? messages.picker.allLeagues : LEAGUE_NAMES[filter];
}

/** Pill order: the big five, then UCL. Fixed rather than alphabetical so the
 *  row doesn't reshuffle as squads are added. */
const LEAGUE_ORDER: readonly League[] = [
  'la-liga',
  'serie-a',
  'premier-league',
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

/** How the picker names and orders its rows. `nameOf` is the displayed name
 *  (`squadDisplayName`), injected so this module stays language-free. */
export interface SquadNames {
  nameOf: (squad: SquadManifestEntry) => string;
  /** The language the list is sorted in: `localeCompare`'s locale. */
  locale: string;
}

/** Lowercase, accents removed: "España" and "espana" fold to the same text.
 *  `normalize('NFD')` splits an accented letter into the letter and a combining
 *  mark (U+0300–U+036F), which the replace drops. No `Intl`. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** The rows the picker shows, sorted by the displayed name. `kind` always
 *  applies; `league` narrows clubs only — nation entries carry no league, so it
 *  is ignored on that tab. `query` narrows further by a substring of the
 *  displayed name or of the English one, ignoring case and accents, composing
 *  with `kind` and `league` rather than replacing them. */
export function visibleSquads(
  squads: SquadManifestEntry[],
  kind: 'club' | 'nation',
  league: LeagueFilter,
  names: SquadNames,
  query = '',
): SquadManifestEntry[] {
  const q = fold(query.trim());
  return squads
    .filter(
      (s) =>
        s.kind === kind &&
        (kind !== 'club' || league === 'ALL' || s.league === league) &&
        (q === '' || fold(names.nameOf(s)).includes(q) || fold(s.name).includes(q)),
    )
    .sort((a, b) => names.nameOf(a).localeCompare(names.nameOf(b), names.locale));
}
