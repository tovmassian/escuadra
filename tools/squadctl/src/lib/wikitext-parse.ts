// Pure wikitext -> rows. No network, no disk, no repo knowledge: everything
// here is a function of the string handed in, which is what makes the parser
// re-runnable against cached wikitext at zero cost when a rule changes.
//
// This layer stays deliberately dumb. It reports what the source says and
// what it could not understand; it never decides whether a team is writable.
// That judgement belongs to the assertion pass, which needs the raw text to
// name a problem precisely — hence the `*Raw` fields alongside the parsed
// ones.
import type { Position } from '../../../../types/squad.ts';

/** Squad section titles, in the order the fetcher tries them. Falling past
 *  `Current squad` is normal — most English club articles never use it. */
export const SECTION_PRIORITY = [
  'Current squad',
  'First-team squad',
  'First team squad',
  'Players',
  'Recent call-ups',
] as const;

export type SectionTitle = (typeof SECTION_PRIORITY)[number];

export interface SelectedSection {
  /** Section index to request with `action=raw&section=<N>`. Never cached:
   *  a section's number moves as an article is edited. */
  index: string;
  /** The matched title, recorded verbatim. `Recent call-ups` is a call-up
   *  list rather than a contract roster and is a conflict downstream. */
  title: SectionTitle;
}

export interface WikiSection {
  line: string;
  index: string;
}

/** First match in priority order, or null when the article has none. */
export function selectSquadSection(sections: readonly WikiSection[]): SelectedSection | null {
  for (const title of SECTION_PRIORITY) {
    const wanted = title.toLowerCase();
    for (const section of sections) {
      if (stripMarkup(section.line).trim().toLowerCase() === wanted) {
        return { index: section.index, title };
      }
    }
  }
  return null;
}

export interface RawTemplate {
  /** Template name as written, trimmed but not case-folded. */
  name: string;
  /** Parameters after the name, unsplit on `=`. */
  params: string[];
  /** The full `{{...}}` source, kept verbatim for `EnvelopeMember.raw`. */
  raw: string;
}

export interface ParsedRow {
  /** Null when the source lists no shirt number — legitimate, and kept. */
  no: number | null;
  /** Exactly what `no=` contained, so an unparseable value can be told apart
   *  from a deliberately blank one. */
  noRaw: string;
  /** Null when `pos=` is not one of GK/DF/MF/FW. */
  position: Position | null;
  positionRaw: string;
  /** Display text of the `name=` wikilink, or the plain value when unlinked. */
  name: string;
  /** Wikilink target with any anchor stripped, or null when `name=` is not a
   *  link. Carried for diagnostics only — reconciliation matches on the
   *  normalised name, never on this. */
  title: string | null;
  captain: boolean;
  /** Raw `nat=` code (e.g. `ESP`), untranslated. */
  nat: string | null;
  /** Display text of `club=`, matching the form players.json stores. */
  club: string | null;
  /** Article title behind `club=`. Argentina writes
   *  `[[Inter Milan|Internazionale]]` where other articles write
   *  `[[Inter Milan]]`, so the display text forks one club into two names
   *  while the title stays put. Used to canonicalise against the registry. */
  clubTitle: string | null;
  /** `YYYY-MM-DD` from `age={{birth date and age|...}}`, which only nation
   *  squads carry. Null everywhere else — normal, not anomalous. */
  birth: string | null;
  raw: string;
}

export interface ParsedSection {
  rows: ParsedRow[];
  /** Subsection headings dropped before parsing — `Reserve team`, `Out on
   *  loan` and friends. Reported rather than silently discarded. */
  droppedSubsections: string[];
  /** ISO date from `{{updated|1 September 2026}}`, null when absent or
   *  unparseable. */
  asOf: string | null;
  /** Templates that look player-ish but match no known variant. Never
   *  silently skipped — a new template variant must surface as a conflict,
   *  not as a quietly shorter squad. */
  unknownTemplates: RawTemplate[];
}

const PLAYER_TEMPLATE = /^(nat\s+)?fs\s+[a-z\s]*player$/i;
const BIRTH_TEMPLATE = /^birth[\s_]date(\s+and\s+age)?$/i;
const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW'];

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function decodeEntities(value: string): string {
  return value.replace(/&[a-z]+;|&#\d+;/gi, (match) => ENTITIES[match.toLowerCase()] ?? match);
}

function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

function stripMarkup(value: string): string {
  return decodeEntities(value.replace(/'''?/g, '').replace(/<[^>]*>/g, '')).trim();
}

/** Splits template parameters on `|` at brace/bracket depth zero only.
 *
 *  The trap this exists for: `age={{birth date and age|df=y|1995|9|15}}`
 *  carries three pipes inside `{{}}`, so a naive `split('|')` shreds one
 *  parameter into four and loses the birth date. */
export function splitParams(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;
  while (i < body.length) {
    const pair = body.substring(i, i + 2);
    if (pair === '{{' || pair === '[[') {
      depth += 1;
      current += pair;
      i += 2;
      continue;
    }
    if (pair === '}}' || pair === ']]') {
      depth -= 1;
      current += pair;
      i += 2;
      continue;
    }
    const char = body.charAt(i);
    if (char === '|' && depth === 0) {
      parts.push(current);
      current = '';
      i += 1;
      continue;
    }
    current += char;
    i += 1;
  }
  parts.push(current);
  return parts;
}

/** Every balanced `{{...}}` at top level, in document order. Templates nested
 *  inside another (a birth date inside a player row) stay part of their
 *  parent's `raw` and are not returned separately. */
export function findTemplates(text: string): RawTemplate[] {
  const found: RawTemplate[] = [];
  let i = 0;
  while (i < text.length) {
    if (!text.startsWith('{{', i)) {
      i += 1;
      continue;
    }
    let depth = 0;
    let j = i;
    while (j < text.length) {
      if (text.startsWith('{{', j)) {
        depth += 1;
        j += 2;
        continue;
      }
      if (text.startsWith('}}', j)) {
        depth -= 1;
        j += 2;
        if (depth === 0) break;
        continue;
      }
      j += 1;
    }
    // Unbalanced braces: stop rather than emit a truncated template.
    if (depth !== 0) break;
    const raw = text.substring(i, j);
    const parts = splitParams(raw.substring(2, raw.length - 2));
    found.push({
      name: (parts[0] ?? '').trim(),
      params: parts.slice(1),
      raw,
    });
    i = j;
  }
  return found;
}

/** Named parameters only. A bare positional parameter has no name to key on
 *  and no field rule reads one, so they are dropped here. */
export function namedParams(params: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const param of params) {
    const eq = param.indexOf('=');
    if (eq < 0) continue;
    const key = param.substring(0, eq).trim();
    if (!/^[A-Za-z0-9 _-]+$/.test(key)) continue;
    out[key.toLowerCase()] = param.substring(eq + 1).trim();
  }
  return out;
}

export interface Wikilink {
  /** `Target` with any `#Anchor` removed, `_` as space, whitespace collapsed
   *  and entities decoded. Case is left alone beyond the first character,
   *  which MediaWiki itself capitalises. */
  title: string | null;
  /** `Display`, or `Target` when the link has no `|`. */
  display: string;
}

/** Reads `[[Target#Anchor|Display]]`. A plain unlinked value yields a null
 *  title and itself as the display text. */
export function parseWikilink(value: string): Wikilink {
  const trimmed = value.trim();
  const match = /^\[\[([^\]]*)\]\]/.exec(trimmed);
  if (!match) return { title: null, display: stripMarkup(trimmed) };
  const inner = match[1] ?? '';
  const pipe = inner.indexOf('|');
  const target = (pipe < 0 ? inner : inner.substring(0, pipe)).split('#')[0] ?? '';
  const display = pipe < 0 ? target : inner.substring(pipe + 1);
  return {
    title: decodeEntities(target.replace(/_/g, ' ')).replace(/\s+/g, ' ').trim() || null,
    display: stripMarkup(display),
  };
}

/** Reads `name={{sortname|First|Last}}`, which the United States and
 *  Australia articles use for every single player where every other article
 *  writes a plain wikilink. Without it the template source itself becomes the
 *  player's name, and 52 records land in players.json as `sortnamemathewryan`.
 *
 *  The template's own contract: the two positional parameters are the first
 *  and last name and are also the link target, a third positional overrides
 *  that target, `dab=` disambiguates it (`dab=soccer` -> `Matt Turner
 *  (soccer)`), and `nolink=` means it links nowhere. Display text is always
 *  just the two names.
 *
 *  Null when the value is not a sortname, so the caller falls back to
 *  `parseWikilink` — only `name=` is routed through here, since `club=` and
 *  `nat=` are plain wikilinks in every article seen so far. */
export function parseSortname(value: string): Wikilink | null {
  const template = findTemplates(value)[0];
  if (template === undefined || !/^sortname$/i.test(template.name)) return null;
  const named = namedParams(template.params);
  const positional = template.params
    .filter((param) => !/^[A-Za-z0-9 _-]+=/.test(param.trim()))
    .map((param) => stripMarkup(param));
  const [first, last, target] = positional;
  const display = [first, last].filter((part) => part !== undefined && part !== '').join(' ');
  if (display === '') return null;

  const nolink = named.nolink;
  if (nolink !== undefined && nolink !== '' && nolink !== '0' && !/^no$/i.test(nolink)) {
    return { title: null, display };
  }
  if (target !== undefined && target !== '') return { title: target, display };
  const dab = named.dab;
  if (dab !== undefined && dab !== '') return { title: `${display} (${dab})`, display };
  return { title: display, display };
}

/** A player row's `name=`, which is a wikilink almost everywhere and a
 *  `{{sortname}}` on the two North American / Australian articles. */
export function parseNameField(value: string): Wikilink {
  return parseSortname(value) ?? parseWikilink(value);
}

function parseBirth(value: string): string | null {
  const inner = findTemplates(value).find((t) => BIRTH_TEMPLATE.test(t.name));
  if (!inner) return null;
  // Year/month/day are the positional parameters; `df=y` and friends are
  // named and may appear before or after them, so filter rather than index.
  const positional = inner.params
    .filter((p) => !/^[A-Za-z0-9 _-]+=/.test(p.trim()))
    .map((p) => p.trim());
  const [year, month, day] = positional;
  if (year === undefined || month === undefined || day === undefined) return null;
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** `{{updated|1 September 2026}}` -> `2026-09-01`. A template, not prose, so
 *  no natural-language date handling is involved. */
export function parseUpdated(text: string): string | null {
  const updated = findTemplates(text).find((t) => /^updated$/i.test(t.name));
  if (!updated) return null;
  const value = updated.params.find((p) => !p.includes('='))?.trim();
  if (value === undefined) return null;
  const match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(stripMarkup(value));
  if (!match) return null;
  const [, day, monthName, year] = match;
  const month = MONTHS[(monthName ?? '').toLowerCase()];
  if (month === undefined || day === undefined || year === undefined) return null;
  return `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** True when this row's `other=` says the player is out on loan AT ANOTHER
 *  club — so this squad is the parent, which merely owns the registration,
 *  and not where the player actually plays.
 *
 *  Premier League and Serie A articles keep the loaned-away player inline in
 *  the main squad table rather than under an `===Out on loan===` heading, so
 *  `trimToFirstSquadTable` has nothing to cut at and `other=` is the only
 *  signal. Its two directions mean opposite things and both occur:
 *
 *    other=on loan from [[X]]              the player is HERE   -> keep
 *    other=at [[Y]] until <date>           the player is at Y   -> drop
 *    other=on loan to [[Y]] until <date>   the player is at Y   -> drop
 *
 *  Anchored at the start of the value and requiring the wikilink, for the
 *  same reason the captain test is an exact match: `on loan from [[Atlético
 *  Madrid]]` contains "at" and must not read as a departure.
 *
 *  Deliberately conservative — an unrecognised phrasing returns false and
 *  leaves the player in both squads, which `dataIntegrity` then fails loudly
 *  on. Quietly shortening a squad on a phrasing nobody has seen is the
 *  unrecoverable direction. */
export function isOutOnLoan(raw: string): boolean {
  return /^(at|on loan to)\s+\[\[/i.test(otherAnnotation(raw));
}

/** The row's `other=` value, trimmed, or '' when it carries none. Reported
 *  alongside a dropped row so the drop is traceable to the source text. */
export function otherAnnotation(raw: string): string {
  const template = findTemplates(raw)[0];
  if (template === undefined) return '';
  return (namedParams(template.params).other ?? '').trim();
}

function toRow(template: RawTemplate): ParsedRow {
  const params = namedParams(template.params);
  const noRaw = params.no ?? '';
  const positionRaw = params.pos ?? '';
  const position = positionRaw.trim().toUpperCase();
  const nameLink = parseNameField(params.name ?? '');
  const clubValue = params.club;
  const natValue = params.nat;

  return {
    no: /^\d+$/.test(noRaw.trim()) ? Number(noRaw.trim()) : null,
    noRaw,
    position: (POSITIONS as readonly string[]).includes(position) ? (position as Position) : null,
    positionRaw,
    name: nameLink.display,
    title: nameLink.title,
    // Exact match on the display text, never a substring: Arsenal carries
    // `captain`, `vice-captain` AND `3rd captain`, and a substring test
    // returns three captains from one squad.
    captain: /^captain$/i.test(parseWikilink(params.other ?? '').display),
    nat: natValue === undefined || natValue === '' ? null : parseWikilink(natValue).display,
    club: clubValue === undefined || clubValue === '' ? null : parseWikilink(clubValue).display,
    clubTitle: clubValue === undefined || clubValue === '' ? null : parseWikilink(clubValue).title,
    birth: parseBirth(params.age ?? ''),
    raw: template.raw,
  };
}

const HEADING = /^\s*(={2,6})\s*(.+?)\s*\1\s*$/;
const PLAYER_LINE = /\{\{\s*(nat\s+)?fs\s+[a-z\s]*player/i;

/** A raw section request returns the section AND every subsection beneath it.
 *  Most Spanish club articles put `===Reserve team===` and `===Out on loan===`
 *  under `==Current squad==`, so parsing the whole response pulls reserve and
 *  loaned-away players into the first-team squad — Elche came back with 35
 *  members against a stored 24.
 *
 *  The cut point is the first heading that FOLLOWS the first player row. That
 *  handles both shapes: a squad table directly under the matched heading (cut
 *  at the next subsection) and a squad table nested one level down, as when
 *  `Players` matches and the roster lives in a subsection of it (nothing is
 *  cut before the table is reached). */
export function trimToFirstSquadTable(wikitext: string): { text: string; dropped: string[] } {
  const lines = wikitext.split('\n');
  const firstPlayer = lines.findIndex((line) => PLAYER_LINE.test(line));
  if (firstPlayer < 0) return { text: wikitext, dropped: [] };

  const cut = lines.findIndex((line, i) => i > firstPlayer && HEADING.test(line));
  if (cut < 0) return { text: wikitext, dropped: [] };

  const dropped = lines
    .slice(cut)
    .map((line) => HEADING.exec(line)?.[2])
    .filter((title): title is string => title !== undefined);
  return { text: lines.slice(0, cut).join('\n'), dropped };
}

export function parseSection(wikitext: string): ParsedSection {
  const full = stripComments(wikitext);
  const { text, dropped } = trimToFirstSquadTable(full);
  const rows: ParsedRow[] = [];
  const unknownTemplates: RawTemplate[] = [];

  for (const template of findTemplates(text)) {
    if (PLAYER_TEMPLATE.test(template.name)) {
      rows.push(toRow(template));
      continue;
    }
    // Player-ish but unrecognised. Surfaced rather than skipped: a silently
    // dropped row is a squad that is quietly one player short.
    if (/player/i.test(template.name)) unknownTemplates.push(template);
  }

  // asOf is read from the whole section: some articles place {{updated}}
  // below the table, past the cut.
  return { rows, asOf: parseUpdated(full), unknownTemplates, droppedSubsections: dropped };
}
