import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEAGUES } from '../scripts/roster-envelope.ts';
import type { Player, Squad } from '@/types/squad';
import type { DecisionFile } from '../tools/squadctl/src/lib/decisions.ts';
import { wikiTitleFromSource } from '../tools/squadctl/src/lib/registry.ts';

// Squad data is spread across data/teams.json, data/squads/**/*.json,
// data/players.json, data/decisions.json and the generated data/index.json,
// repeating id / name / club / nationality across them. lib/squads.test.ts
// checks each squad's own shape once it's loaded through the generated
// SQUAD_FILES map (marker geometry, shirt-number uniqueness, manifest/file
// agreement); this file checks that the *sources* — squad files, players.json
// and decisions.json — agree with each other in the first place.
//
// Read directly with node:fs + JSON.parse rather than through lib/squads.ts:
// getRoster() silently drops any squad member whose playerId doesn't
// resolve, which is exactly the failure mode invariant 1 below exists to
// catch — routing through it would mask the bug instead of reporting it.
//
// Comparing data/teams.json against the squad files is a separate axis,
// covered by `squadctl registry check` and deliberately not duplicated here.
// The registry is read for one thing only: the last two invariants need each
// tracked club's Wikipedia article title, which lives nowhere else.
const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SQUADS_DIR = path.join(DATA_DIR, 'squads');

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

interface DiscoveredSquad {
  /** The squad's own `id` field, not the filename — they're kept equal by
   *  `npm run gen:squads` (which refuses to write a mismatch), but the
   *  content id is what decisions.json's `splits[].team` actually refers to. */
  id: string;
  squad: Squad;
}

/** Walks data/squads/nation/<id>.json and data/squads/club/<league>/<id>.json
 *  for every league in LEAGUES. Driven off the closed LEAGUES list rather
 *  than the directories actually present on disk, so a league with no
 *  squads yet (an empty folder, like bundesliga, or one that doesn't exist
 *  at all, like ucl) just contributes zero squads instead of erroring. */
function discoverSquadFiles(): DiscoveredSquad[] {
  const discovered: DiscoveredSquad[] = [];

  const nationDir = path.join(SQUADS_DIR, 'nation');
  // Guarded like the league loop below, so a missing directory contributes
  // zero squads and trips the canary rather than throwing ENOENT out of
  // module scope, where no `it` is running to attribute it to.
  if (existsSync(nationDir)) {
    for (const fileName of readdirSync(nationDir).filter((f) => f.endsWith('.json'))) {
      const squad = readJson<Squad>(path.join(nationDir, fileName));
      discovered.push({ id: squad.id, squad });
    }
  }

  for (const league of LEAGUES) {
    const leagueDir = path.join(SQUADS_DIR, 'club', league);
    if (!existsSync(leagueDir)) continue;
    for (const fileName of readdirSync(leagueDir).filter((f) => f.endsWith('.json'))) {
      const squad = readJson<Squad>(path.join(leagueDir, fileName));
      discovered.push({ id: squad.id, squad });
    }
  }

  return discovered.sort((a, b) => a.id.localeCompare(b.id));
}

const squadFiles = discoverSquadFiles();
const playersData = readJson<Player[]>(path.join(DATA_DIR, 'players.json'));
const players = new Map(playersData.map((p) => [p.id, p]));

function label(entry: DiscoveredSquad): string {
  return `${entry.squad.name} (${entry.id})`;
}

/** Shared by the club- and nation-match invariants below: for each entry,
 *  resolve its members and assert every one's `field` equals the squad's
 *  own `name`, reporting every mismatch (not just whether one exists) so a
 *  failure names the offending players. The generic keeps `actual` tied to
 *  Player's real field type per call site — `string` for nationality,
 *  `string | null` for club — rather than widening nationality's assertion
 *  down to club's looser type. */
function checkFieldMatchesSquadName<F extends 'club' | 'nationality'>(
  entries: DiscoveredSquad[],
  field: F,
): void {
  for (const entry of entries) {
    it(label(entry), () => {
      const mismatches: Array<{ playerId: string; expected: string; actual: Player[F] }> = [];
      for (const member of entry.squad.members) {
        const player = players.get(member.playerId);
        if (!player) continue; // unresolved ids are invariant 1's concern, not this one
        const actual = player[field];
        if (actual !== entry.squad.name) {
          mismatches.push({ playerId: member.playerId, expected: entry.squad.name, actual });
        }
      }
      expect(mismatches).toEqual([]);
    });
  }
}

describe('every squad member resolves to a player', () => {
  // A canary against a broken discovery step: if SQUADS_DIR or LEAGUES were
  // wrong, the loop below would silently generate zero `it`s and every
  // invariant in this file would vacuously pass.
  it('discovered at least one squad file', () => {
    expect(squadFiles.length).toBeGreaterThan(0);
  });

  for (const entry of squadFiles) {
    it(label(entry), () => {
      const unresolved = [...new Set(entry.squad.members.map((m) => m.playerId))]
        .filter((playerId) => !players.has(playerId))
        .sort();
      expect(unresolved, `player ids on ${label(entry)} missing from data/players.json`).toEqual(
        [],
      );
    });
  }
});

// The bug this task exists to stop recurring: three players on the Athletic
// Club roster carried player.club: "Athletic Bilbao" (the Wikipedia article
// title) while a fourth carried the registry name "Athletic Club". Because
// level-3 club distractors are drawn from one roster's player.club values
// (lib/questionEngine.ts:158), two spellings of the same club in one squad
// make the correct answer indistinguishable from a distractor. Pinning every
// club squad's members to that squad's own `name` forces players.json to
// carry one canonical spelling per club.
describe("a club squad's members all carry that club", () => {
  checkFieldMatchesSquadName(
    squadFiles.filter((s) => s.squad.kind === 'club'),
    'club',
  );
});

// Same shape as the club check above, for the other half of Squad.kind. A
// nation squad asking a level-3 nationality question would be a non-question
// (CLAUDE.md — every member shares it), but the field still has to agree
// with the squad it's attached to, since Study mode and level-3 club
// distractor pools (on other nation squads) both read player.nationality.
describe("a nation squad's members all carry that nationality", () => {
  checkFieldMatchesSquadName(
    squadFiles.filter((s) => s.squad.kind === 'nation'),
    'nationality',
  );
});

// squadctl apply and squadctl rename always write players.json sorted by
// id.localeCompare(id) (tools/squadctl/src/commands/apply.ts,
// tools/squadctl/src/commands/rename.ts). Since squadctl is the only
// intended writer of this file, an id out of that order — or a duplicate —
// is evidence of an out-of-band hand edit, not a state squadctl itself would
// ever produce.
describe('players.json is canonically ordered and unique', () => {
  const ids = playersData.map((p) => p.id);

  it('has unique ids', () => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    expect([...duplicates]).toEqual([]);
  });

  it('is sorted by id.localeCompare(id)', () => {
    let firstOutOfOrderPair: { before: string; after: string } | null = null;
    for (let i = 1; i < ids.length; i++) {
      const before = ids[i - 1];
      const after = ids[i];
      if (before === undefined || after === undefined) continue;
      if (before.localeCompare(after) > 0) {
        firstOutOfOrderPair = { before, after };
        break;
      }
    }
    expect(firstOutOfOrderPair, 'first pair found out of order').toBeNull();
  });
});

// An alias or split that names a player or team id which no longer exists is
// silently inert: squadctl will never match it against anything, so the
// conflict it was recorded for resurfaces every sweep with no clue why the
// recorded decision isn't taking effect. splits[].arrived is deliberately
// not checked here — it's the source's display name for the arrival, not a
// stored player id (tools/squadctl/src/commands/split.ts).
// Note on vacuity: `splits` is empty in the checked-in data — no split has
// been needed yet — so the two splits assertions below currently pass over an
// empty list. That is the honest state rather than a gap to paper over: the
// alternative would be a guard test asserting splits is non-empty, which would
// fail for a file that is legitimately empty. Both were perturbation-tested by
// adding a split pointing at a made-up player id and team id.
describe('data/decisions.json refers to players and teams that exist', () => {
  const decisions = readJson<DecisionFile>(path.join(DATA_DIR, 'decisions.json'));
  const squadIds = new Set(squadFiles.map((entry) => entry.id));

  it('every aliases[].player exists in players.json', () => {
    const missing = [...new Set((decisions.aliases ?? []).map((a) => a.player))]
      .filter((playerId) => !players.has(playerId))
      .sort();
    expect(missing).toEqual([]);
  });

  it('every splits[].departed exists in players.json', () => {
    const missing = [...new Set(decisions.splits.map((s) => s.departed))]
      .filter((playerId) => !players.has(playerId))
      .sort();
    expect(missing).toEqual([]);
  });

  it('every splits[].team has a squad file', () => {
    const missing = [...new Set(decisions.splits.map((s) => s.team))]
      .filter((teamId) => !squadIds.has(teamId))
      .sort();
    expect(missing).toEqual([]);
  });
});

// The two invariants above check `club` and `nationality` only for players who
// are *members* of a squad of that kind. That leaves the players who belong to
// no club squad of ours — nation-squad-only players and orphans — carrying an
// unvalidated `club`, and they are exactly the population that feeds level-3
// club distractors: buildClubPart (lib/questionEngine.ts) draws its pool from
// the nation roster's `player.club` values. A nation article linking a club we
// track through a different redirect falls through buildEnvelope's
// canonicalisation to the display text and forks the spelling, with nothing
// downstream to notice. That is the Athletic Club / Athletic Bilbao bug one
// step to the left.
//
// wikiTitleFromSource is imported rather than reimplemented — a test in lib/
// reaching into the CLI's lib is a deliberate direction, since the registry's
// URL parsing has exactly one correct definition and this is a second reader
// of it, not a second implementation.
describe('no player.club uses a tracked club article title over its registry name', () => {
  const registry = readJson<{ id: string; kind: string; name: string; source: string }[]>(
    path.join(DATA_DIR, 'teams.json'),
  );

  // Article title -> registry name, for every tracked club whose Wikipedia
  // title differs from the name we display. A club we do not track is not
  // covered by this rule: its spelling is free text we never canonicalise.
  const titleToName = new Map<string, string>();
  for (const team of registry) {
    if (team.kind !== 'club') continue;
    const title = wikiTitleFromSource(team.source);
    if (title !== null && title !== team.name) titleToName.set(title, team.name);
  }

  it('has at least one tracked club whose article title differs from its name', () => {
    // Otherwise the invariant below passes vacuously and proves nothing.
    expect(titleToName.size).toBeGreaterThan(0);
  });

  it('no player carries a tracked club under its article title', () => {
    const offenders = playersData
      .filter((player) => player.club !== null && titleToName.has(player.club))
      .map((player) => ({
        playerId: player.id,
        actual: player.club,
        expected: player.club === null ? null : titleToName.get(player.club),
      }));
    expect(offenders).toEqual([]);
  });
});

// The other half of the same family. A club squad's members get `nationality`
// from the closed data/fifa-countries.json vocabulary, enforced at write time
// by buildEnvelope; a nation squad's members get it from the squad's own name,
// which comes from data/teams.json and is enforced by nothing. `name:
// "Holland"` on a nation entry would fork "Holland" against "Netherlands" for
// every club-squad player, with `registry check` passing (the squad file would
// agree with the registry) and the nationality invariant above passing too
// (members would agree with their squad).
describe('every nation squad name is a FIFA country name', () => {
  // { CODE: Name }, so the names are the values.
  const countries = new Set(
    Object.values(readJson<Record<string, string>>(path.join(DATA_DIR, 'fifa-countries.json'))),
  );

  it('has a non-empty country vocabulary', () => {
    expect(countries.size).toBeGreaterThan(0);
  });

  it('uses only names present in fifa-countries.json', () => {
    const offenders = squadFiles
      .filter((entry) => entry.squad.kind === 'nation' && !countries.has(entry.squad.name))
      .map((entry) => ({ squadId: entry.squad.id, name: entry.squad.name }));
    expect(offenders).toEqual([]);
  });
});
