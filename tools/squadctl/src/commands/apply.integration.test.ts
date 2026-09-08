// End-to-end tests of `apply`'s run(), driven through its real oclif `run`
// static rather than by re-deriving the command's own logic. That
// distinction is the point: lib/apply-plan.test.ts pins the pure decision
// functions apply.ts calls, but a final review found all three regressions
// those functions once guarded against actually lived at apply.ts's CALL
// SITES — reverting a call site to its pre-fix form keeps every
// apply-plan.test.ts test green, since the pure functions themselves never
// changed. Only a test that runs the command end to end, against real files
// on disk, can catch that. See each `describe` below for which call site it
// pins, and tools/squadctl/README.md / the squadctl design doc for the
// wider `apply` contract.
//
// Every test builds its own throwaway repo under node:os's tmpdir() via
// mkdtempSync and points BaseCommand.repoRoot at it with SQUADCTL_REPO_ROOT
// (see base-command.ts). Nothing here may ever touch this repo's real
// data/ — afterEach removes the fixture and restores the env var.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvelopeMember, RosterEnvelope } from '../../../../scripts/roster-envelope.ts';
import type { Player, Squad, SquadMember, TeamMarker } from '../../../../types/squad.ts';
import type { DecisionFile } from '../lib/decisions.ts';
import type { TeamRegistryEntry } from '../lib/registry.ts';
import Apply from './apply.ts';

// apply.ts's real (non-dry-run) write path ends with
// `await import('../../../../scripts/gen-squads.ts')`. That script resolves
// its own root from `import.meta.dirname`, not from SQUADCTL_REPO_ROOT (see
// scripts/gen-squads.ts's REPO_ROOT constant) — it has no seam a fixture can
// use, so importing it for real from a test would regenerate THIS machine's
// actual data/index.json and lib/squads.generated.ts from whatever this
// repo's real data/squads/ happens to hold. Mocked out here so every
// real-write test below is safe to run: the dynamic import still happens
// exactly as apply.ts wrote it, it just resolves to this empty stub instead
// of the real generator. genSquadsSpy lets the one test that pins this
// contract (bottom of the file) prove the import actually fired.
const { genSquadsSpy } = vi.hoisted(() => ({ genSquadsSpy: vi.fn() }));
vi.mock('../../../../scripts/gen-squads.ts', () => {
  genSquadsSpy();
  return {};
});

// --- fixture plumbing ------------------------------------------------------

const madeRoots: string[] = [];
let originalExitCode: typeof process.exitCode;

beforeEach(() => {
  // apply.ts sets process.exitCode directly on a conflict or repo failure
  // (see EXIT.* in apply.ts). That's a real, global, process-wide mutation —
  // left alone it would make an intentionally-conflicted fixture in this
  // file flip `npm run check`'s own exit code.
  originalExitCode = process.exitCode;
});

afterEach(() => {
  process.exitCode = originalExitCode;
  delete process.env.SQUADCTL_REPO_ROOT;
  for (const root of madeRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function scratchRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'squadctl-apply-'));
  madeRoots.push(root);
  return root;
}

// --- data factories ----------------------------------------------------
// One club, one nation, mirroring what real registry/squad data looks like.
// Kept deliberately small (just above the assertion thresholds in
// lib/assertions.ts) rather than realistic squad sizes.

const CLUB_PRIMARY = '#FFFFFF';
const CLUB_SECONDARY = '#D2001C';
const CLUB_MARKER: TeamMarker = { bands: [CLUB_PRIMARY, CLUB_SECONDARY], orientation: 'vertical' };
const CLUB_SOURCE = 'https://en.wikipedia.org/wiki/Sevilla_FC';

const NATION_PRIMARY = '#AA151B';
const NATION_SECONDARY = '#F1BF00';
const NATION_MARKER: TeamMarker = {
  bands: [NATION_PRIMARY, NATION_SECONDARY, NATION_PRIMARY],
  orientation: 'horizontal',
  weights: [1, 2, 1],
};
const NATION_SOURCE = 'https://en.wikipedia.org/wiki/Spain_national_football_team';

function clubRegistryEntry(over: Partial<TeamRegistryEntry> = {}): TeamRegistryEntry {
  return {
    id: 'sev',
    kind: 'club',
    league: 'la-liga',
    name: 'Sevilla',
    source: CLUB_SOURCE,
    identity: { primaryColor: CLUB_PRIMARY, secondaryColor: CLUB_SECONDARY, marker: CLUB_MARKER },
    ...over,
  };
}

function nationRegistryEntry(over: Partial<TeamRegistryEntry> = {}): TeamRegistryEntry {
  return {
    id: 'esp',
    kind: 'nation',
    name: 'Spain',
    source: NATION_SOURCE,
    identity: {
      primaryColor: NATION_PRIMARY,
      secondaryColor: NATION_SECONDARY,
      marker: NATION_MARKER,
    },
    ...over,
  };
}

function player(over: Partial<Player> & { id: string; name: string }): Player {
  return {
    fullName: over.name,
    birth: '1995-01-01',
    position: 'MF',
    nationality: 'Spain',
    club: 'Sevilla',
    photo: null,
    ...over,
  };
}

function member(playerId: string, no: number | null, captain?: true): SquadMember {
  const m: SquadMember = { playerId, no };
  if (captain) m.captain = true;
  return m;
}

// Field order matches reconcileTeam's own `squad` object literal exactly
// (tools/squadctl/src/lib/reconcile.ts): isFileUnchanged compares candidate
// and stored via JSON.stringify, which is key-order sensitive, so a fixture
// squad whose keys land in a different order would register as "changed"
// even when nothing meaningful differs.
function clubSquad(over: Partial<Squad> = {}): Squad {
  return {
    id: 'sev',
    kind: 'club',
    name: 'Sevilla',
    season: '2026/27',
    primaryColor: CLUB_PRIMARY,
    secondaryColor: CLUB_SECONDARY,
    verified: true,
    marker: CLUB_MARKER,
    lastUpdated: '2026-01-01',
    source: CLUB_SOURCE,
    members: [],
    ...over,
  };
}

function nationSquad(over: Partial<Squad> = {}): Squad {
  return {
    id: 'esp',
    kind: 'nation',
    name: 'Spain',
    season: '2026/27',
    primaryColor: NATION_PRIMARY,
    secondaryColor: NATION_SECONDARY,
    verified: true,
    marker: NATION_MARKER,
    lastUpdated: '2026-01-01',
    source: NATION_SOURCE,
    members: [],
    ...over,
  };
}

function row(over: Partial<EnvelopeMember> & { name: string }): EnvelopeMember {
  return {
    no: 1,
    position: 'MF',
    raw: '{{Fs player}}',
    ...over,
  };
}

function clubTeam(over: Partial<RosterEnvelope['team']> = {}): RosterEnvelope['team'] {
  return {
    id: 'sev',
    kind: 'club',
    name: 'Sevilla',
    league: 'la-liga',
    season: '2026/27',
    source: CLUB_SOURCE,
    sectionTitle: 'Current squad',
    asOf: '2026-09-01',
    ...over,
  };
}

function nationTeam(over: Partial<RosterEnvelope['team']> = {}): RosterEnvelope['team'] {
  return {
    id: 'esp',
    kind: 'nation',
    name: 'Spain',
    season: '2026/27',
    source: NATION_SOURCE,
    sectionTitle: 'Current squad',
    asOf: '2026-09-01',
    ...over,
  };
}

// identity is deliberately omitted: these envelopes model a re-fetch of an
// EXISTING team, and apply.ts always writes the registry's identity over
// whatever an envelope carries (apply.ts, ~line 130) regardless.
function envelope(
  team: RosterEnvelope['team'],
  members: EnvelopeMember[],
  over: Partial<RosterEnvelope> = {},
): RosterEnvelope {
  return { status: 'OK', team, members, warnings: [], ...over };
}

// Bulk, interchangeable squad padding, used to clear lib/assertions.ts's
// member-count thresholds (a club under 14 is a hard failure; under 18 is a
// warning) without hand-writing rows. Player and row are built from the same
// loop so a "faithful re-fetch" envelope reproduces the stored data exactly
// — no accidental diffs from a row's position disagreeing with its player.
function fillers(
  count: number,
  prefix: string,
  startNo: number,
  playerOver: Partial<Player> = {},
  rowOver: Partial<EnvelopeMember> = {},
): { players: Player[]; members: SquadMember[]; rows: EnvelopeMember[] } {
  const players: Player[] = [];
  const members: SquadMember[] = [];
  const rows: EnvelopeMember[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = `${prefix}-${i}`;
    const name = `Filler ${prefix} ${i}`;
    const no = startNo + i;
    players.push(player({ id, name, position: 'DF', ...playerOver }));
    members.push(member(id, no));
    rows.push(row({ name, no, position: 'DF', ...rowOver }));
  }
  return { players, members, rows };
}

// --- repo + envelope fixture writers ---------------------------------------

interface FixtureInput {
  /** Defaults to one club and one nation entry — a registry entry with no
   *  squad file is a legitimate "not yet fetched" state, so tests that only
   *  exercise one team can leave the fixture's other team file-less. */
  teams?: TeamRegistryEntry[];
  players: Player[];
  squads: { relPath: string; squad: Squad }[];
  decisions?: DecisionFile;
}

function writeFixture(input: FixtureInput): { root: string; dataDir: string } {
  const root = scratchRoot();
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    path.join(dataDir, 'teams.json'),
    JSON.stringify(input.teams ?? [clubRegistryEntry(), nationRegistryEntry()], null, 2),
  );
  writeFileSync(path.join(dataDir, 'players.json'), JSON.stringify(input.players, null, 2));
  writeFileSync(
    path.join(dataDir, 'decisions.json'),
    JSON.stringify(input.decisions ?? { splits: [], aliases: [] }, null, 2),
  );
  for (const { relPath, squad } of input.squads) {
    const filePath = path.join(dataDir, 'squads', relPath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(squad, null, 2));
  }
  return { root, dataDir };
}

function writeEnvelopes(
  root: string,
  entries: { fileName: string; data: RosterEnvelope }[],
): string {
  const dir = path.join(root, 'envelopes');
  mkdirSync(dir, { recursive: true });
  for (const { fileName, data } of entries) {
    writeFileSync(path.join(dir, fileName), JSON.stringify(data, null, 2));
  }
  return dir;
}

// --- driving the real command -----------------------------------------
// RunReport/TeamReport (apply.ts) aren't exported — they're the command's
// own return-type detail, not part of any public contract — so this is the
// subset of that shape the tests below read, asserted onto the real result.

interface TeamReportShape {
  id: string;
  status: 'written' | 'unchanged' | 'conflicted' | 'failed';
  verified: boolean;
  conflicts: { kind: string }[];
}

interface RunReportShape {
  dryRun: boolean;
  teams: TeamReportShape[];
  exitCode: number;
}

async function runApply(
  root: string,
  envelopesDir: string,
  extraArgs: string[] = [],
): Promise<RunReportShape> {
  process.env.SQUADCTL_REPO_ROOT = root;
  const result = await Apply.run([envelopesDir, ...extraArgs], import.meta.url);
  return result as unknown as RunReportShape;
}

function findTeam(report: RunReportShape, id: string): TeamReportShape {
  const team = report.teams.find((t) => t.id === id);
  if (team === undefined) throw new Error(`no report entry for team "${id}"`);
  return team;
}

function findPlayer(players: Player[], id: string): Player {
  const found = players.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no player "${id}" in players.json`);
  return found;
}

function readSquad(dataDir: string, relPath: string): Squad {
  return JSON.parse(readFileSync(path.join(dataDir, 'squads', relPath), 'utf8')) as Squad;
}

function readPlayers(dataDir: string): Player[] {
  return JSON.parse(readFileSync(path.join(dataDir, 'players.json'), 'utf8')) as Player[];
}

// --- headline contract: regenerating the index -----------------------
// A vi.mock factory for a module reached only via dynamic import is
// memoized once evaluated: vi.resetModules() does not force it to re-run
// within the same file, even from a freshly re-imported copy of apply.ts
// (checked by hand against a standalone repro before settling on this
// design). That makes genSquadsSpy's call count meaningful only for
// whichever real (non-dry-run, with-changes) write reaches it FIRST in this
// file — so this is the one test here allowed to depend on declaration
// order, and it must stay the first describe block below. Every other test
// is unaffected: none of them assert on genSquadsSpy, they only need the
// mock active at all — which it is, regardless of caching — to keep the
// real repo safe.

describe('regenerating the index', () => {
  it('imports scripts/gen-squads.ts after a real write', async () => {
    const raya = player({
      id: 'raya',
      name: 'David Raya',
      position: 'MF', // wrong on purpose — corrected to GK below
      club: 'Sevilla',
      nationality: 'Spain',
    });
    const clubFiller = fillers(17, 'sev-f', 2, { club: 'Sevilla', nationality: 'Spain' });
    const storedClub = clubSquad({
      lastUpdated: '2026-01-01',
      members: [member('raya', 1), ...clubFiller.members],
    });

    const { root } = writeFixture({
      players: [raya, ...clubFiller.players],
      squads: [{ relPath: 'club/la-liga/sev.json', squad: storedClub }],
    });

    const clubEnvelope = envelope(clubTeam(), [
      row({ name: 'David Raya', no: 1, position: 'GK', club: 'Sevilla' }),
      ...clubFiller.rows,
    ]);
    const envelopesDir = writeEnvelopes(root, [{ fileName: 'club.json', data: clubEnvelope }]);

    await runApply(root, envelopesDir);

    expect(genSquadsSpy).toHaveBeenCalledTimes(1);
  });
});

// --- regression 1: lastUpdated stability -----------------------------------
// apply-plan.ts's isFileUnchanged doc comment: "Folding players.json edits in
// here meant one player's position correction rewrote the lastUpdated of
// every unrelated squad that happened to contain them." Pins apply.ts's
// `const fileUnchanged = isFileUnchanged(squad, stored);` call — reverted to
// AND in the run-level `playersDirty` flag, a team processed after another
// team dirties a shared player would look changed even though nothing of
// its own did.
//
// The mutation that proves the cross-squad assertions below are load-bearing
// is exactly that one — `isFileUnchanged(squad, stored) && !playersDirty` at
// apply.ts's call site, which fails this test with "expected 'written' to be
// 'unchanged'". Folding a team's OWN plan into the condition instead
// (`&& plan.updatedPlayers.length === 0`) does not exercise them: the second
// squad's envelope is a faithful re-fetch of an already-corrected player, and
// reconcile's field ownership means a nation row never contributes
// `position`, so that squad's own updatedPlayers is empty either way.

describe('regression 1: lastUpdated stability', () => {
  it('leaves an unrelated squad sharing a corrected player untouched: no lastUpdated bump, no rewrite', async () => {
    const raya = player({
      id: 'raya',
      name: 'David Raya',
      position: 'MF', // wrong on purpose — corrected to GK by Sevilla's envelope below
      club: 'Sevilla',
      nationality: 'Spain',
      birth: '1995-09-15',
    });
    const clubFiller = fillers(17, 'sev-f', 2, { club: 'Sevilla', nationality: 'Spain' });
    const nationFiller = fillers(2, 'esp-f', 20, { nationality: 'Spain', club: null });

    const storedClub = clubSquad({
      lastUpdated: '2026-01-01',
      members: [member('raya', 1), ...clubFiller.members],
    });
    const storedNation = nationSquad({
      lastUpdated: '2026-02-02',
      members: [member('raya', 13), ...nationFiller.members],
    });

    const { root, dataDir } = writeFixture({
      players: [raya, ...clubFiller.players, ...nationFiller.players],
      squads: [
        { relPath: 'club/la-liga/sev.json', squad: storedClub },
        { relPath: 'nation/esp.json', squad: storedNation },
      ],
    });

    // Sevilla's envelope corrects Raya's position — a field only a club
    // squad owns — and changes nothing else.
    const clubEnvelope = envelope(clubTeam(), [
      row({ name: 'David Raya', no: 1, position: 'GK', club: 'Sevilla' }),
      ...clubFiller.rows,
    ]);
    // Spain shares Raya but is a faithful re-fetch: nothing of Spain's own
    // changes. This is the "other squad" the regression must leave alone.
    const nationEnvelope = envelope(nationTeam(), [
      row({ name: 'David Raya', no: 13, position: 'GK', nationality: 'Spain' }),
      ...nationFiller.rows,
    ]);

    // loadEnvelopes sorts by filename, and the leak this pins only shows up
    // on a team processed AFTER the one that dirtied the shared player.
    const envelopesDir = writeEnvelopes(root, [
      { fileName: '01-club.json', data: clubEnvelope },
      { fileName: '02-nation.json', data: nationEnvelope },
    ]);

    const nationFileBefore = readFileSync(
      path.join(dataDir, 'squads', 'nation', 'esp.json'),
      'utf8',
    );

    const report = await runApply(root, envelopesDir);

    // Sevilla's own squad content didn't change either — only a player
    // field did — so it must not report written or bump its own date.
    expect(findTeam(report, 'sev').status).toBe('unchanged');
    expect(findTeam(report, 'esp').status).toBe('unchanged');

    expect(readFileSync(path.join(dataDir, 'squads', 'nation', 'esp.json'), 'utf8')).toBe(
      nationFileBefore,
    );
    expect(readSquad(dataDir, 'nation/esp.json').lastUpdated).toBe('2026-02-02');
  });
});

// --- regression 2: the write gate ------------------------------------------
// apply-plan.ts's hasWritableChanges doc comment: "Keying the whole write
// step on squadWrites.length meant a run that only corrected player fields
// ... silently discarded every change." Pins apply.ts's
// `if (!dryRun && hasWritableChanges(squadWrites.length, playersDirty))` —
// reverted to `if (!dryRun && squadWrites.length > 0)`, a player-only
// correction with zero squad writes never reaches players.json at all.

describe('regression 2: the write gate', () => {
  it('still writes players.json when the only effect is a player-field correction', async () => {
    const raya = player({
      id: 'raya',
      name: 'David Raya',
      position: 'MF', // wrong on purpose — corrected to GK below
      club: 'Sevilla',
      nationality: 'Spain',
    });
    const clubFiller = fillers(17, 'sev-f', 2, { club: 'Sevilla', nationality: 'Spain' });
    const storedClub = clubSquad({
      lastUpdated: '2026-01-01',
      members: [member('raya', 1), ...clubFiller.members],
    });

    const { root, dataDir } = writeFixture({
      players: [raya, ...clubFiller.players],
      squads: [{ relPath: 'club/la-liga/sev.json', squad: storedClub }],
    });

    const clubEnvelope = envelope(clubTeam(), [
      row({ name: 'David Raya', no: 1, position: 'GK', club: 'Sevilla' }),
      ...clubFiller.rows,
    ]);
    const envelopesDir = writeEnvelopes(root, [{ fileName: 'club.json', data: clubEnvelope }]);

    const report = await runApply(root, envelopesDir);

    // No membership change anywhere, so no squad file is rewritten...
    expect(findTeam(report, 'sev').status).toBe('unchanged');
    // ...but the player correction itself must still land on disk.
    expect(findPlayer(readPlayers(dataDir), 'raya').position).toBe('GK');
  });
});

// --- regression 3: status reporting -----------------------------------
// apply-plan.ts's teamStatus doc comment: "Folding players.json edits in
// here reported teams as written whose file would not change at all." Pins
// apply.ts's `const status = teamStatus({ conflicts: verdict.conflicts,
// fileUnchanged });` call.

describe('regression 3: status reporting', () => {
  it('reports unchanged, never written, for a team whose file would not change', async () => {
    const raya = player({
      id: 'raya',
      name: 'David Raya',
      position: 'MF', // wrong on purpose — corrected to GK below
      club: 'Sevilla',
      nationality: 'Spain',
    });
    const clubFiller = fillers(17, 'sev-f', 2, { club: 'Sevilla', nationality: 'Spain' });
    const storedClub = clubSquad({
      lastUpdated: '2026-01-01',
      members: [member('raya', 1), ...clubFiller.members],
    });

    const { root } = writeFixture({
      players: [raya, ...clubFiller.players],
      squads: [{ relPath: 'club/la-liga/sev.json', squad: storedClub }],
    });

    const clubEnvelope = envelope(clubTeam(), [
      row({ name: 'David Raya', no: 1, position: 'GK', club: 'Sevilla' }),
      ...clubFiller.rows,
    ]);
    const envelopesDir = writeEnvelopes(root, [{ fileName: 'club.json', data: clubEnvelope }]);

    const report = await runApply(root, envelopesDir);

    expect(findTeam(report, 'sev').status).toBe('unchanged');
  });

  it('reports conflicted, not unchanged, for a team with an unresolved conflict and no other change', async () => {
    // Brazil's actual roster carries two Edersons (GK, born 1993; MF, born
    // 1999 — see reconcile.ts's own comment) sharing a display name. Neither
    // position, club nor number on this row narrows the match, so it HOLDs:
    // both stored members are kept exactly as they were, and the squad's own
    // content does not change even though a conflict is now on record.
    const gkEderson = player({
      id: 'ederson-gk',
      name: 'Ederson',
      position: 'GK',
      club: 'Sevilla',
      nationality: 'Brazil',
    });
    const mfEderson = player({
      id: 'ederson-mf',
      name: 'Ederson',
      position: 'MF',
      club: 'Sevilla',
      nationality: 'Brazil',
    });
    const clubFiller = fillers(16, 'sev-f', 3, { club: 'Sevilla', nationality: 'Spain' });

    const storedClub = clubSquad({
      lastUpdated: '2026-01-01',
      // Already unverified from a prior run that hit this same unresolved
      // conflict — so `verified` itself does not change either, and the
      // squad file is unchanged in every field, not just members.
      verified: false,
      members: [member('ederson-gk', 1), ...clubFiller.members, member('ederson-mf', 24)],
    });

    const { root, dataDir } = writeFixture({
      players: [gkEderson, mfEderson, ...clubFiller.players],
      squads: [{ relPath: 'club/la-liga/sev.json', squad: storedClub }],
    });

    const clubEnvelope = envelope(clubTeam(), [
      row({ name: 'Ederson', no: 77, position: 'FW', club: 'Other FC' }), // matches neither stored Ederson
      ...clubFiller.rows,
    ]);
    const envelopesDir = writeEnvelopes(root, [{ fileName: 'club.json', data: clubEnvelope }]);

    const squadFileBefore = readFileSync(
      path.join(dataDir, 'squads', 'club', 'la-liga', 'sev.json'),
      'utf8',
    );

    const report = await runApply(root, envelopesDir);
    const team = findTeam(report, 'sev');

    expect(team.status).toBe('conflicted');
    expect(team.conflicts.some((c) => c.kind === 'ambiguous-name')).toBe(true);
    expect(readFileSync(path.join(dataDir, 'squads', 'club', 'la-liga', 'sev.json'), 'utf8')).toBe(
      squadFileBefore,
    );
  });
});

// --- headline contract: --dry-run ------------------------------------------

describe('apply --dry-run', () => {
  it('writes nothing to disk even though the report describes real changes', async () => {
    const raya = player({ id: 'raya', name: 'David Raya', club: 'Sevilla', nationality: 'Spain' });
    const clubFiller = fillers(17, 'sev-f', 2, { club: 'Sevilla', nationality: 'Spain' });
    const storedClub = clubSquad({
      lastUpdated: '2026-01-01',
      members: [member('raya', 1), ...clubFiller.members],
    });

    const { root, dataDir } = writeFixture({
      players: [raya, ...clubFiller.players],
      squads: [{ relPath: 'club/la-liga/sev.json', squad: storedClub }],
    });

    // A genuine new signing, so the report's honest answer is "written".
    const clubEnvelope = envelope(clubTeam(), [
      row({ name: 'David Raya', no: 1, position: 'MF', club: 'Sevilla' }),
      ...clubFiller.rows,
      row({ name: 'New Signing', no: 99, position: 'FW', club: 'Sevilla', nationality: 'Spain' }),
    ]);
    const envelopesDir = writeEnvelopes(root, [{ fileName: 'club.json', data: clubEnvelope }]);

    const squadFileBefore = readFileSync(
      path.join(dataDir, 'squads', 'club', 'la-liga', 'sev.json'),
      'utf8',
    );
    const playersFileBefore = readFileSync(path.join(dataDir, 'players.json'), 'utf8');

    const report = await runApply(root, envelopesDir, ['--dry-run']);

    expect(report.dryRun).toBe(true);
    expect(findTeam(report, 'sev').status).toBe('written');
    expect(readFileSync(path.join(dataDir, 'squads', 'club', 'la-liga', 'sev.json'), 'utf8')).toBe(
      squadFileBefore,
    );
    expect(readFileSync(path.join(dataDir, 'players.json'), 'utf8')).toBe(playersFileBefore);
  });
});

// --- headline contract: a conflict still writes -----------------------

describe('a conflict still writes', () => {
  it('writes the team file with verified: false and exits 4 when a real change also carries a conflict', async () => {
    const gkEderson = player({
      id: 'ederson-gk',
      name: 'Ederson',
      position: 'GK',
      club: 'Sevilla',
      nationality: 'Brazil',
    });
    const mfEderson = player({
      id: 'ederson-mf',
      name: 'Ederson',
      position: 'MF',
      club: 'Sevilla',
      nationality: 'Brazil',
    });
    const clubFiller = fillers(16, 'sev-f', 3, { club: 'Sevilla', nationality: 'Spain' });

    const storedClub = clubSquad({
      lastUpdated: '2026-01-01',
      verified: true,
      members: [member('ederson-gk', 1), ...clubFiller.members, member('ederson-mf', 24)],
    });

    const { root, dataDir } = writeFixture({
      players: [gkEderson, mfEderson, ...clubFiller.players],
      squads: [{ relPath: 'club/la-liga/sev.json', squad: storedClub }],
    });

    const clubEnvelope = envelope(clubTeam(), [
      row({ name: 'Ederson', no: 77, position: 'FW', club: 'Other FC' }), // ambiguous
      ...clubFiller.rows,
      // A genuine signing alongside the conflict, so the squad file
      // genuinely differs from what's stored and a real write happens.
      row({ name: 'New Signing', no: 30, position: 'FW', club: 'Sevilla', nationality: 'Spain' }),
    ]);
    const envelopesDir = writeEnvelopes(root, [{ fileName: 'club.json', data: clubEnvelope }]);

    const report = await runApply(root, envelopesDir);
    const team = findTeam(report, 'sev');

    expect(team.status).toBe('conflicted');
    expect(team.verified).toBe(false);
    expect(report.exitCode).toBe(4);

    const stored = readSquad(dataDir, 'club/la-liga/sev.json');
    expect(stored.verified).toBe(false);
    expect(stored.members.some((m) => m.playerId === 'new-signing')).toBe(true);
  });
});
