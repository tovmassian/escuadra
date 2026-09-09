// Integration test for fork command, verifying that the duplicate-title guard
// uses titlesEquivalent rather than byte-equality (===).
//
// The guard should reject equivalent-but-not-identical titles and accept
// genuinely different titles.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { Player } from '../../../../types/squad.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const CLI = path.join(REPO_ROOT, 'tools', 'squadctl', 'bin', 'dev.js');

const madeRoots: string[] = [];
afterEach(() => {
  for (const root of madeRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Create a throwaway repo with one player whose wikiTitle is
 *  "Otávio (footballer, born 2002)". */
function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'squadctl-fork-'));
  madeRoots.push(root);
  mkdirSync(path.join(root, 'data'), { recursive: true });

  const players: Player[] = [
    {
      id: 'otavio-2002',
      name: 'Otávio',
      fullName: 'Otávio Monteiro da Silva',
      birth: '2002-10-18',
      position: 'MF',
      nationality: 'Brazil',
      club: 'FC Porto',
      photo: null,
      wikiTitle: 'Otávio (footballer, born 2002)',
    },
  ];

  writeFileSync(path.join(root, 'data', 'players.json'), JSON.stringify(players, null, 2));
  return root;
}

function runFork(
  root: string,
  playerId: string,
  title: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, 'fork', playerId, title], {
    env: { ...process.env, SQUADCTL_REPO_ROOT: root },
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function getPlayersCount(root: string): number {
  const content = readFileSync(path.join(root, 'data', 'players.json'), 'utf8');
  return (JSON.parse(content) as Player[]).length;
}

describe('fork command duplicate-title guard', () => {
  it('rejects equivalent-but-not-identical title (bare vs disambiguated)', () => {
    const root = fixture();
    const initialCount = getPlayersCount(root);

    // Fork with bare title "Otávio" should be rejected as equivalent to
    // the stored "Otávio (footballer, born 2002)"
    const result = runFork(root, 'otavio-2002', 'Otávio');

    expect(result.status).toBe(5);
    expect(result.stderr).toContain('is already otavio-2002 — nothing to fork');
    // No new player should be created
    expect(getPlayersCount(root)).toBe(initialCount);
  });

  it('accepts genuinely different title (different birth year)', () => {
    const root = fixture();
    const initialCount = getPlayersCount(root);

    // Fork with genuinely different title should succeed
    const result = runFork(root, 'otavio-2002', 'Otávio (footballer, born November 2005)');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('forked otavio-2002');
    // A new player should be created
    expect(getPlayersCount(root)).toBe(initialCount + 1);

    // Verify the new player was actually written
    const content = readFileSync(path.join(root, 'data', 'players.json'), 'utf8');
    const players = JSON.parse(content) as Player[];
    const newPlayer = players.find(
      (p) => p.wikiTitle === 'Otávio (footballer, born November 2005)',
    );
    expect(newPlayer).toBeDefined();
  });
});
