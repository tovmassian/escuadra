// The contract between the squad data skills. squad-fetcher and
// squad-verifier both produce a RosterEnvelope; squad-writer consumes one.
// Kept as tested code rather than prose in a SKILL.md because a malformed
// envelope must be caught before it can mutate the shared players.json.
import type { League, TeamMarker } from '../types/squad';

export type EnvelopeStatus = 'OK' | 'NEEDS_DECISION' | 'SOURCE_BROKEN' | 'PARSE_FAILED';
export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface EnvelopeMember {
  name: string;
  fullName?: string;
  /** Null for a member the source lists without a shirt number, mirroring
   *  `SquadMember.no`. Kept rather than dropped: the player still appears in
   *  Study mode and as a name distractor. */
  no: number | null;
  /** Wikipedia article title for this player, when the source linked one.
   *  Two players can share a display name within one squad — Brazil carries
   *  both `Ederson (footballer, born 1993)` and `Éderson (footballer, born
   *  1999)` — and the article title is the thing that is unique by
   *  construction. Carried on the envelope for disambiguation during a run;
   *  deliberately NOT stored on `Player`. */
  title?: string;
  position: Position;
  captain?: true;
  nationality?: string;
  club?: string | null;
  birth?: string;
  /** The literal wikitext template line this member was parsed from. */
  raw: string;
}

export interface EnvelopeIdentity {
  primaryColor: string;
  secondaryColor: string;
  marker: TeamMarker;
}

export interface RosterEnvelope {
  status: EnvelopeStatus;
  team: {
    id: string;
    kind: 'nation' | 'club';
    name: string;
    league?: League;
    season: string;
    source: string;
    sectionTitle: string;
    asOf: string | null;
  };
  /** Present ONLY on new-team intake. Absent means "not inspected" — the
   *  writer preserves whatever is stored. See the spec's identity section. */
  identity?: EnvelopeIdentity;
  members: EnvelopeMember[];
  /** Names of templates that looked player-ish but matched no known variant.
   *  Structural, because a conflict must never depend on matching the prose of
   *  a warning string — reword the sentence and the conflict stops firing. */
  unknownTemplates?: string[];
  warnings: string[];
  decisions?: string[];
}

/** Fraction of a roster that may change before the run is treated as
 *  suspicious (page restructure or vandalism, not a transfer window). */
export const BLAST_RADIUS_THRESHOLD = 0.4;

/** The closed set of league folder names under data/squads/club/, mirroring
 *  the list in scripts/gen-squads.ts. Validated here so a club envelope with
 *  an unrecognised league is refused at squad-writer's entry gate, rather
 *  than throwing out of the generator once the whole batch is already on
 *  disk and the generated outputs are stale. */
export const LEAGUES: League[] = [
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
  'premier-league',
  'ucl',
];

const STATUSES: EnvelopeStatus[] = ['OK', 'NEEDS_DECISION', 'SOURCE_BROKEN', 'PARSE_FAILED'];
const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW'];
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Latin letters carrying their mark INSIDE the glyph rather than as a
 *  combining accent. NFD leaves these intact, so diacritic stripping alone
 *  does not fold `Ødegaard` onto `Odegaard` and two sources spelling one
 *  player differently would never match. Transliterated explicitly. */
const NON_DECOMPOSING: Record<string, string> = {
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  þ: 'th',
  ı: 'i',
  ŋ: 'n',
  ħ: 'h',
};

/** Folds the letters NFD cannot decompose. Applied after lowercasing, so the
 *  table only needs lowercase keys. */
export function transliterate(value: string): string {
  return value.replace(/[øđðłæœßþıŋħ]/g, (char) => NON_DECOMPOSING[char] ?? char);
}

/** Case-, diacritic- and script-insensitive form used for every player match.
 *  Bugs here silently merge two real people, which is why it is tested. */
export function normalizeName(name: string): string {
  return transliterate(
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase(),
  )
    .trim()
    .replace(/\s+/g, ' ');
}

/** True when two names differ as written but agree only once the
 *  non-decomposing letters are folded — the sources disagree on spelling and
 *  the match is transliteration-dependent rather than exact. */
export function isTransliterationVariant(a: string, b: string): boolean {
  const fold = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  return fold(a) !== fold(b) && normalizeName(a) === normalizeName(b);
}

/** A title with its trailing parenthetical disambiguator removed:
 *  `Endrick (footballer, born 2006)` -> `Endrick`. Only a trailing group is
 *  stripped, because a parenthetical anywhere else is part of the name. */
export function baseTitle(title: string): string {
  return title.replace(/\s*\([^()]*\)\s*$/, '').trim();
}

/** True when two article titles name the same article.
 *
 *  Byte-equality is wrong here: Wikipedia lets an article be reached through
 *  a redirect, so one person legitimately has more than one link target. Real
 *  Madrid links `[[Endrick]]` where Brazil links
 *  `[[Endrick (footballer, born 2006)]]`, and Barcelona links
 *  `Eric Garcia (footballer, born 2001)` where Spain links
 *  `Eric García (footballer, born 2001)`.
 *
 *  Two relations, both local — resolving a redirect properly would cost a
 *  request per link and break `--offline`:
 *
 *  1. One side is the other's base title, i.e. a link to the undisambiguated
 *     redirect.
 *  2. The whole titles are equal once normalised.
 *
 *  NOT `isTransliterationVariant`, which is the obvious candidate and is
 *  wrong: it requires the NFD fold itself to differ, so it fires only on
 *  `ø đ ð ł æ œ ß þ ı ŋ ħ` and returns false for the Eric García pair.
 *
 *  Deliberately conservative about the disambiguator: two titles that share a
 *  base but carry *different* disambiguators are two people, which is exactly
 *  the Otávio and Vitinha collisions this whole mechanism exists to catch. */
export function titlesEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  if (normalizeName(a) === normalizeName(b)) return true;
  const strippedA = baseTitle(a);
  const strippedB = baseTitle(b);
  // Only when one side carries no disambiguator at all. Otherwise
  // `Otávio (born 2002)` and `Otávio (born November 2005)` would relate.
  const oneIsBare = strippedA === a || strippedB === b;
  return oneIsBare && normalizeName(strippedA) === normalizeName(strippedB);
}

/** 1 minus the Jaccard similarity of two rosters, by normalised name.
 *  0 means identical, 1 means wholly disjoint. */
export function changeRatio(stored: string[], parsed: string[]): number {
  const a = new Set(stored.map(normalizeName));
  const b = new Set(parsed.map(normalizeName));
  let shared = 0;
  for (const name of a) {
    if (b.has(name)) shared += 1;
  }
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : (union - shared) / union;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Returns a list of human-readable problems; empty means valid. */
export function validateEnvelope(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['envelope must be a JSON object'];

  const status = value.status;
  if (!STATUSES.includes(status as EnvelopeStatus)) {
    errors.push(`status must be one of ${STATUSES.join(', ')}; got ${JSON.stringify(status)}`);
  }

  if (!isRecord(value.team)) {
    errors.push('team is required and must be an object');
  } else {
    const team = value.team;
    for (const field of ['id', 'name', 'season', 'source', 'sectionTitle'] as const) {
      if (!nonEmptyString(team[field])) {
        errors.push(`team.${field} must be a non-empty string`);
      }
    }
    if (team.kind !== 'nation' && team.kind !== 'club') {
      errors.push(`team.kind must be "nation" or "club"; got ${JSON.stringify(team.kind)}`);
    }
    if (team.kind === 'club') {
      if (!nonEmptyString(team.league)) {
        errors.push('team.league is required on club squads');
      } else if (!(LEAGUES as string[]).includes(team.league)) {
        errors.push(
          `team.league must be one of ${LEAGUES.join(', ')}; got ${JSON.stringify(team.league)}`,
        );
      }
    }
    if (team.kind === 'nation' && team.league !== undefined) {
      errors.push('team.league must be absent on nation squads');
    }
    if (team.asOf !== null && typeof team.asOf !== 'string') {
      errors.push('team.asOf must be a string or null');
    }
  }

  if (!Array.isArray(value.members)) {
    errors.push('members must be an array');
  } else {
    if (status === 'OK' && value.members.length === 0) {
      errors.push(
        'status OK requires a non-empty members array; zero parsed members is PARSE_FAILED',
      );
    }
    const seenNumbers = new Set<number>();
    const seenNames = new Set<string>();
    value.members.forEach((entry, index) => {
      const at = `members[${index}]`;
      if (!isRecord(entry)) {
        errors.push(`${at} must be an object`);
        return;
      }
      if (!nonEmptyString(entry.name)) errors.push(`${at}.name must be a non-empty string`);
      if (!nonEmptyString(entry.raw)) errors.push(`${at}.raw must be a non-empty string`);
      if (!POSITIONS.includes(entry.position as Position)) {
        errors.push(`${at}.position must be one of ${POSITIONS.join(', ')}`);
      }
      // null is a legitimate shirt number (see EnvelopeMember.no); only
      // real numbers are range-checked and deduplicated.
      if (entry.no !== null) {
        if (typeof entry.no !== 'number' || !Number.isInteger(entry.no)) {
          errors.push(`${at}.no must be an integer shirt number or null`);
        } else if (seenNumbers.has(entry.no)) {
          errors.push(`${at} duplicate shirt number ${entry.no}`);
        } else {
          seenNumbers.add(entry.no);
        }
      }
      if (nonEmptyString(entry.name)) {
        // Keyed on the article title as well as the name: two different real
        // people can share a normalised display name inside one squad, and
        // only the title separates them.
        const key = `${normalizeName(entry.name)}#${typeof entry.title === 'string' ? entry.title : ''}`;
        if (seenNames.has(key)) errors.push(`${at} duplicate player name ${entry.name}`);
        seenNames.add(key);
      }
    });
  }

  if (!Array.isArray(value.warnings)) {
    errors.push('warnings must be an array (use [] when there are none)');
  }

  if (value.identity !== undefined) {
    if (!isRecord(value.identity)) {
      errors.push('identity, when present, must be an object');
    } else {
      const identity = value.identity;
      for (const field of ['primaryColor', 'secondaryColor'] as const) {
        if (typeof identity[field] !== 'string' || !HEX.test(identity[field] as string)) {
          errors.push(`identity.${field} must be a six-digit hex colour like #AA151B`);
        }
      }
      if (!isRecord(identity.marker) || !Array.isArray(identity.marker.bands)) {
        errors.push('identity.marker must be a TeamMarker with a bands array');
      }
    }
  }

  return errors;
}
