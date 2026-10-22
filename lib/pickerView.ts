// Pure team-picker row model. Kept out of the screen so it is unit-testable.
import type { Messages } from '@/i18n/en';
import { CONFEDERATIONS, confederationOf, type Confederation } from '@/lib/confederations';
import { flagFor } from '@/lib/flags';
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

/** The nations tab's confederation filter (#177). `'ALL'` is the default. */
export type ConfederationFilter = 'ALL' | Confederation;

/** A nation's confederation, through the flag code of its English name; null
 *  for a club, or a nation `lib/confederations.ts` does not map. */
export function squadConfederation(squad: SquadManifestEntry): Confederation | null {
  if (squad.kind !== 'nation') return null;
  const code = flagFor(squad.name);
  return code === null ? null : confederationOf(code);
}

/** `'ALL'` plus every confederation that has a nation in the manifest, in
 *  `CONFEDERATIONS` order: like `leagueFilters`, no pill filters to nothing. */
export function confederationFilters(squads: SquadManifestEntry[]): ConfederationFilter[] {
  const present = new Set<Confederation>();
  for (const squad of squads) {
    const confederation = squadConfederation(squad);
    if (confederation !== null) present.add(confederation);
  }
  return ['ALL', ...CONFEDERATIONS.filter((c) => present.has(c))];
}

/** A confederation pill's label: the acronym, a proper noun like a league's name. */
export function confederationLabel(filter: ConfederationFilter, messages: Messages): string {
  return filter === 'ALL' ? messages.picker.allConfederations : filter;
}

/** A confederation pill's spoken name: "UEFA, Europe". */
export function confederationSpoken(filter: ConfederationFilter, messages: Messages): string {
  return filter === 'ALL'
    ? messages.picker.allConfederations
    : [filter, messages.picker.regions[filter]].join(', ');
}

/** The nations list's caption, beside its first letter: "UEFA · A–Z". */
export function nationsCaption(filter: ConfederationFilter, messages: Messages): string {
  return messages.picker.nationsCaption(filter === 'ALL' ? messages.picker.allNations : filter);
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

/** A displayed name's first letter, folded as search folds it: "Ägypten" is
 *  filed under A, "Égypte" under E. */
export function initialOf(name: string): string {
  return fold(name).charAt(0).toUpperCase();
}

/** One letter of the nations tab and its nations, in the displayed order. */
export interface NationSection {
  letter: string;
  squads: SquadManifestEntry[];
}

/** The nations tab grouped A–Z (#176), in the app's language: the visible
 *  nations in `visibleSquads`' order, narrowed to one confederation unless it
 *  is `'ALL'` (#177), under the first letter of their displayed name. A letter
 *  the locale's order would split (a folded "Ñ" after "N") still opens once:
 *  later names join its section. */
export function nationSections(
  squads: SquadManifestEntry[],
  names: SquadNames,
  query = '',
  confederation: ConfederationFilter = 'ALL',
): NationSection[] {
  const sections: NationSection[] = [];
  const byLetter = new Map<string, NationSection>();
  for (const squad of visibleSquads(squads, 'nation', 'ALL', names, query)) {
    if (confederation !== 'ALL' && squadConfederation(squad) !== confederation) continue;
    const letter = initialOf(names.nameOf(squad));
    let section = byLetter.get(letter);
    if (section === undefined) {
      section = { letter, squads: [] };
      byLetter.set(letter, section);
      sections.push(section);
    }
    section.squads.push(squad);
  }
  return sections;
}

/** Where a letter's heading sits in the scrolled content. */
export interface LetterOffset {
  letter: string;
  y: number;
}

/** The letter in view: the last heading at or above `y`, or the first
 *  letter before any heading is reached. `offsets` is in scroll order. */
export function letterAt(offsets: readonly LetterOffset[], y: number): string | null {
  let current = offsets[0]?.letter ?? null;
  for (const offset of offsets) {
    if (offset.y > y) break;
    current = offset.letter;
  }
  return current;
}

/** Each tab's count: the squads of that kind matching the search. The league
 *  and confederation filters do not narrow it. */
export function kindCounts(
  squads: SquadManifestEntry[],
  names: SquadNames,
  query = '',
): { club: number; nation: number } {
  return {
    club: visibleSquads(squads, 'club', 'ALL', names, query).length,
    nation: visibleSquads(squads, 'nation', 'ALL', names, query).length,
  };
}

/** What a row's right-hand side shows. `hydrating` shows nothing, so a row
 *  never claims "not played" for a squad whose scores are still loading. */
export type ScoreBlock =
  | { kind: 'hydrating' }
  | { kind: 'unplayed' }
  | { kind: 'played'; level: number; correct: number; total: number; flawless: boolean };

export function scoreBlock(progress: TeamProgress | null | undefined): ScoreBlock {
  if (progress === undefined) return { kind: 'hydrating' };
  if (progress === null) return { kind: 'unplayed' };
  return {
    kind: 'played',
    level: progress.level,
    correct: progress.correct,
    total: progress.total,
    flawless: progress.correct === progress.total,
  };
}
