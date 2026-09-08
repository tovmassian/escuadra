// The exit code a script or skill actually observes.
//
// squadctl publishes an exit-code table in its README and calls it stable,
// because the squad-factory skills are meant to branch on it. That contract
// was false under `--json`: oclif's `Command.catch` does
// `process.exitCode = process.exitCode ?? err.exitCode ?? 1`, and the
// `CLIError` built by `this.error(msg, { exit: N })` carries its code at
// `oclif.exit` rather than `exitCode`, so every such error exited 1 —
// which the same table assigns to "network / HTTP". A consumer would read a
// registry error as a transient failure and retry it. `BaseCommand.catch`
// now forwards `oclif.exit` first.
//
// `registry check` is the sharpest case: its only non-zero exit IS a
// `this.error`, so it was wrong on every failure.
//
// These spawn the real CLI rather than calling the command in-process,
// because the claim under test is about the exit code of a process. Running
// it in-process would set `process.exitCode` on the vitest runner itself and
// could fail an otherwise-green suite.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { Squad } from '../../../../../types/squad.ts';
import type { TeamRegistryEntry } from '../../lib/registry.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../../..');
const CLI = path.join(REPO_ROOT, 'tools', 'squadctl', 'bin', 'dev.js');

const marker = { bands: ['#AA151B', '#F1BF00'], orientation: 'vertical' as const };

const madeRoots: string[] = [];
afterEach(() => {
  for (const root of madeRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A throwaway repo holding one nation team. `drift` is applied to the
 *  registry entry only, so the squad file disagrees with it. */
function fixture(drift: Partial<TeamRegistryEntry> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'squadctl-check-'));
  madeRoots.push(root);
  mkdirSync(path.join(root, 'data', 'squads', 'nation'), { recursive: true });

  const entry: TeamRegistryEntry = {
    id: 'esp',
    kind: 'nation',
    name: 'Spain',
    source: 'https://en.wikipedia.org/wiki/Spain_national_football_team',
    identity: { primaryColor: '#AA151B', secondaryColor: '#F1BF00', marker },
  };
  const squad: Squad = {
    id: 'esp',
    kind: 'nation',
    name: 'Spain',
    season: '2026',
    primaryColor: '#AA151B',
    secondaryColor: '#F1BF00',
    verified: true,
    marker,
    lastUpdated: '2026-01-01',
    source: 'https://en.wikipedia.org/wiki/Spain_national_football_team',
    members: [{ playerId: 'someone', no: 1 }],
  };

  writeFileSync(path.join(root, 'data', 'teams.json'), JSON.stringify([{ ...entry, ...drift }]));
  writeFileSync(path.join(root, 'data', 'squads', 'nation', 'esp.json'), JSON.stringify(squad));
  return root;
}

function runCheck(root: string, argv: string[] = []): { status: number | null } {
  const result = spawnSync(process.execPath, [CLI, 'registry', 'check', ...argv], {
    env: { ...process.env, SQUADCTL_REPO_ROOT: root },
    encoding: 'utf8',
  });
  return { status: result.status };
}

describe('registry check exit codes', () => {
  it('exits 0 when the registry agrees with the squad files', () => {
    expect(runCheck(fixture()).status).toBe(0);
  });

  it('exits 5 on drift', () => {
    expect(runCheck(fixture({ name: 'Espana' })).status).toBe(5);
  });

  // The regression. Before BaseCommand.catch forwarded oclif.exit, this was 1
  // — indistinguishable, per the README's own table, from a network failure.
  it('exits 5 on drift under --json too, not 1', () => {
    expect(runCheck(fixture({ name: 'Espana' }), ['--json']).status).toBe(5);
  });

  // Drift is returned as data and signalled by setting process.exitCode
  // directly, so the cases above no longer reach BaseCommand.catch. This one
  // does: a missing registry is an exceptional case that still raises through
  // `this.error`, which is the path the override exists for. Without it this
  // exits 1 under --json.
  it('exits 5 under --json when data/teams.json is missing entirely', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'squadctl-check-empty-'));
    madeRoots.push(root);
    mkdirSync(path.join(root, 'data'), { recursive: true });
    expect(runCheck(root, ['--json']).status).toBe(5);
  });

  it('reports the same code with and without --json', () => {
    // One fixture, read twice — registry check writes nothing, so the second
    // run sees exactly the state the first did.
    const root = fixture({ name: 'Espana' });
    expect(runCheck(root, ['--json']).status).toBe(runCheck(root).status);
  });
});
