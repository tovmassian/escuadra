import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEAGUES } from '../scripts/roster-envelope.ts';
import type { Player, Squad } from '@/types/squad';

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
// data/teams.json is deliberately not touched here — comparing it against
// the squad files is a separate axis, covered elsewhere.
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
  for (const fileName of readdirSync(nationDir).filter((f) => f.endsWith('.json'))) {
    const squad = readJson<Squad>(path.join(nationDir, fileName));
    discovered.push({ id: squad.id, squad });
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

interface DecisionSplit {
  team: string;
  departed: string;
  arrived: string;
}

interface DecisionAlias {
  player: string;
  name: string;
}

interface DecisionsFile {
  splits: DecisionSplit[];
  aliases?: DecisionAlias[];
}

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
describe('data/decisions.json refers to players and teams that exist', () => {
  const decisions = readJson<DecisionsFile>(path.join(DATA_DIR, 'decisions.json'));
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
