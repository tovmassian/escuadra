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
  no: number;
  position: Position;
  captain?: true;
  nationality?: string;
  club?: string | null;
  clubNat?: string;
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
  warnings: string[];
  decisions?: string[];
}

/** Fraction of a roster that may change before the run is treated as
 *  suspicious (page restructure or vandalism, not a transfer window). */
export const BLAST_RADIUS_THRESHOLD = 0.4;

const STATUSES: EnvelopeStatus[] = ['OK', 'NEEDS_DECISION', 'SOURCE_BROKEN', 'PARSE_FAILED'];
const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW'];
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Case- and diacritic-insensitive form used for every player match.
 *  Bugs here silently merge two real people, which is why it is tested. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
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
    if (team.kind === 'club' && !nonEmptyString(team.league)) {
      errors.push('team.league is required on club squads');
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
      if (typeof entry.no !== 'number' || !Number.isInteger(entry.no)) {
        errors.push(`${at}.no must be an integer shirt number`);
      } else if (seenNumbers.has(entry.no)) {
        errors.push(`${at} duplicate shirt number ${entry.no}`);
      } else {
        seenNumbers.add(entry.no);
      }
      if (nonEmptyString(entry.name)) {
        const key = normalizeName(entry.name);
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
