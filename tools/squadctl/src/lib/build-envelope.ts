// Registry entry + parsed rows -> RosterEnvelope. Pure, so the shape of every
// envelope squadctl produces is testable without a socket.
//
// The envelope is the shared contract with the squad-factory skills
// (scripts/roster-envelope.ts), imported upward rather than forked, which is
// what keeps the two paths' outputs directly diffable.
import {
  validateEnvelope,
  type EnvelopeMember,
  type RosterEnvelope,
} from '../../../../scripts/roster-envelope.ts';
import { countryForCode } from './fifa-countries.ts';
import type { TeamRegistryEntry } from './registry.ts';
import type { ParsedSection } from './wikitext-parse.ts';
import type { SectionTitle } from './wikitext-parse.ts';

/** There is no multi-season state, so season is a constant applied on every
 *  write rather than a flag. This also normalises the three clubs still
 *  stranded on 2025/26. */
export const SEASON = { club: '2026/27', nation: '2026' } as const;

export interface EnvelopeBuild {
  /** Null when the team could not produce a valid envelope at all. */
  envelope: RosterEnvelope | null;
  /** Conditions under which the team is not written. The run continues with
   *  the other teams — a failure is never fatal to the sweep. */
  failures: string[];
  /** Wholly-empty player templates used as layout spacers in the article.
   *  Skipped, but counted rather than silently discarded. */
  blankRows: number;
}

export interface BuildInput {
  entry: TeamRegistryEntry;
  /** Wikipedia article title -> the name the registry uses for that club.
   *  A club we track must appear under ONE name everywhere, or level 3 offers
   *  two spellings of the same club as different answers. */
  clubNames?: ReadonlyMap<string, string>;
  sectionTitle: SectionTitle;
  parsed: ParsedSection;
}

export function buildEnvelope({
  entry,
  sectionTitle,
  parsed,
  clubNames,
}: BuildInput): EnvelopeBuild {
  const failures: string[] = [];
  const warnings: string[] = [];
  const members: EnvelopeMember[] = [];

  if (parsed.rows.length === 0) {
    failures.push('parsed zero members from the matched section');
  }

  let blankRows = 0;

  for (const row of parsed.rows) {
    // Brazil's article (and others) carry `{{nat fs g player|no=|pos=|name=|
    // ...}}` rows with every parameter empty, used to space the table. They
    // are recognised templates carrying no player, so they are skipped rather
    // than failed — but counted, never silently dropped.
    if (row.name === '' && row.noRaw.trim() === '' && row.positionRaw.trim() === '') {
      blankRows += 1;
      continue;
    }
    if (row.name === '') {
      failures.push(`a row has no readable name: ${row.raw}`);
      continue;
    }
    if (row.position === null) {
      failures.push(
        `${row.name}: pos=${JSON.stringify(row.positionRaw)} is not one of GK/DF/MF/FW`,
      );
      continue;
    }
    if (row.no !== null && (row.no < 1 || row.no > 99)) {
      failures.push(`${row.name}: shirt number ${row.no} is outside 1-99`);
      continue;
    }
    // A non-empty `no=` that did not parse is a different problem from a
    // deliberately blank one, and only the first is worth failing on.
    if (row.no === null && row.noRaw.trim() !== '') {
      failures.push(`${row.name}: no=${JSON.stringify(row.noRaw)} is not a shirt number`);
      continue;
    }

    let nationality: string;
    if (entry.kind === 'nation') {
      // A nation squad has no per-member nat field: every member shares the
      // squad's country.
      nationality = entry.name;
    } else {
      if (row.nat === null) {
        failures.push(`${row.name}: club squad row carries no nat= code`);
        continue;
      }
      const country = countryForCode(row.nat);
      if (country === null) {
        failures.push(`${row.name}: unmapped FIFA code ${row.nat} — add it to fifa-countries.json`);
        continue;
      }
      nationality = country;
    }

    const member: EnvelopeMember = {
      name: row.name,
      no: row.no,
      position: row.position,
      nationality,
      // A club squad's members all play for that club; a nation squad's each
      // carry their own.
      club:
        entry.kind === 'club'
          ? entry.name
          : // Prefer the registry's name when this club is one we track, so a
            // display-text variant cannot fork it.
            (clubNames?.get(row.clubTitle ?? '') ?? row.club),
      raw: row.raw,
    };
    if (row.title !== null) member.title = row.title;
    if (row.captain) member.captain = true;
    if (row.birth !== null) member.birth = row.birth;
    members.push(member);
  }

  for (const unknown of parsed.unknownTemplates) {
    warnings.push(`unrecognised player-ish template {{${unknown.name}}} — parser needs teaching`);
  }
  if (sectionTitle === 'Recent call-ups') {
    warnings.push(
      `section matched "Recent call-ups": a call-up list, not a contract roster${
        parsed.asOf === null ? '' : ` (as of ${parsed.asOf})`
      }`,
    );
  }

  if (failures.length > 0) return { envelope: null, failures, blankRows };

  const envelope: RosterEnvelope = {
    // Anything needing judgement downstream is flagged here; the assertion
    // pass in `apply` decides what it means for `verified`.
    status: warnings.length > 0 ? 'NEEDS_DECISION' : 'OK',
    team: {
      id: entry.id,
      kind: entry.kind,
      name: entry.name,
      ...(entry.league === undefined ? {} : { league: entry.league }),
      season: entry.kind === 'club' ? SEASON.club : SEASON.nation,
      source: entry.source,
      sectionTitle,
      asOf: parsed.asOf,
    },
    identity: entry.identity,
    members,
    unknownTemplates: parsed.unknownTemplates.map((t) => t.name),
    warnings,
  };

  // The envelope contract is already tested and enforces duplicate shirt
  // numbers and duplicate names; reuse it rather than restating those rules.
  const invalid = validateEnvelope(envelope);
  if (invalid.length > 0) return { envelope: null, failures: invalid, blankRows };

  return { envelope, failures: [], blankRows };
}
