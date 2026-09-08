// `data/teams.json` — the single input to `fetch`. A registry entry with no
// squad file simply IS a new team, so there is no separate intake path.
//
// `identity` cannot be derived: reading a club's kit colours and expressing a
// national flag as bands is design judgement, done once per team ever. An
// entry without it is a hard failure rather than an invented colour.
import type { League, TeamMarker } from '../../../../types/squad.ts';
import { LEAGUES } from '../../../../scripts/roster-envelope.ts';

export interface TeamRegistryEntry {
  /** Squad id; becomes the squad filename. */
  id: string;
  kind: 'club' | 'nation';
  /** Required iff kind === 'club', absent otherwise. */
  league?: League;
  /** Display name, e.g. "Juventus". Also the club written onto every member
   *  of a club squad, and the nationality of every member of a nation squad. */
  name: string;
  /** Full en.wikipedia.org article URL. */
  source: string;
  identity: {
    primaryColor: string;
    secondaryColor: string;
    marker: TeamMarker;
  };
}

export type TeamRegistry = TeamRegistryEntry[];

const HEX = /^#[0-9a-fA-F]{6}$/;
const WIKI_ARTICLE = /^https:\/\/en\.wikipedia\.org\/wiki\/(.+)$/;

/** The `<Title>` the Wikipedia API wants, read out of the entry's source URL.
 *  Percent-decoded with underscores restored to spaces; callers re-encode at
 *  request time. Null when the URL is not an en.wikipedia article. */
export function wikiTitleFromSource(source: string): string | null {
  const match = WIKI_ARTICLE.exec(source.trim());
  const slug = match?.[1];
  if (slug === undefined || slug === '') return null;
  try {
    return (
      decodeURIComponent(slug.split('#')[0] ?? '')
        .replace(/_/g, ' ')
        .trim() || null
    );
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Human-readable problems; empty means valid. Run before the first network
 *  call, so a malformed registry fails in milliseconds rather than halfway
 *  through 150 teams. */
export function validateRegistry(value: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(value)) return ['teams.json must be a JSON array of registry entries'];

  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const at = `teams[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${at} must be an object`);
      return;
    }

    if (!nonEmptyString(entry.id)) {
      errors.push(`${at}.id must be a non-empty string`);
    } else {
      if (seen.has(entry.id)) errors.push(`${at} duplicate team id ${entry.id}`);
      seen.add(entry.id);
    }

    if (!nonEmptyString(entry.name)) errors.push(`${at}.name must be a non-empty string`);

    if (entry.kind !== 'club' && entry.kind !== 'nation') {
      errors.push(`${at}.kind must be "club" or "nation"; got ${JSON.stringify(entry.kind)}`);
    } else if (entry.kind === 'club') {
      if (!nonEmptyString(entry.league)) {
        errors.push(`${at}.league is required on club entries`);
      } else if (!(LEAGUES as string[]).includes(entry.league)) {
        errors.push(`${at}.league must be one of ${LEAGUES.join(', ')}`);
      }
    } else if (entry.league !== undefined) {
      errors.push(`${at}.league must be absent on nation entries`);
    }

    if (!nonEmptyString(entry.source) || wikiTitleFromSource(entry.source) === null) {
      errors.push(`${at}.source must be a full https://en.wikipedia.org/wiki/... article URL`);
    }

    if (!isRecord(entry.identity)) {
      errors.push(
        `${at}.identity is required — a team without one is never given an invented colour`,
      );
      return;
    }
    for (const field of ['primaryColor', 'secondaryColor'] as const) {
      const colour = entry.identity[field];
      if (typeof colour !== 'string' || !HEX.test(colour)) {
        errors.push(`${at}.identity.${field} must be a six-digit hex colour like #AA151B`);
      }
    }
    const marker = entry.identity.marker;
    if (!isRecord(marker) || !Array.isArray(marker.bands) || marker.bands.length === 0) {
      errors.push(`${at}.identity.marker must be a TeamMarker with a non-empty bands array`);
    } else if (marker.orientation !== 'horizontal' && marker.orientation !== 'vertical') {
      errors.push(`${at}.identity.marker.orientation must be "horizontal" or "vertical"`);
    }
  });

  return errors;
}
