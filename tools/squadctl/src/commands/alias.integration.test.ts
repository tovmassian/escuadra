// `alias` has two meanings behind one command — another display name, and
// another article title — and the flag is what picks. Spawned rather than
// called in-process because the thing under test is which file the command
// writes.
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

/** A throwaway repo holding one player and an empty decision file. */
function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'squadctl-alias-'));
  madeRoots.push(root);
  mkdirSync(path.join(root, 'data'), { recursive: true });

  const grimaldo: Player = {
    id: 'grimaldo',
    name: 'Álex Grimaldo',
    fullName: 'Alejandro Grimaldo García',
    birth: '1995-09-20',
    position: 'DF',
    nationality: 'Spain',
    club: 'Atlético Madrid',
    photo: null,
    wikiTitle: 'Álex Grimaldo',
  };
  writeFileSync(path.join(root, 'data', 'players.json'), JSON.stringify([grimaldo]));
  writeFileSync(
    path.join(root, 'data', 'decisions.json'),
    JSON.stringify({ splits: [], aliases: [] }),
  );
  return root;
}

function runAlias(root: string, argv: string[]): { status: number | null } {
  const result = spawnSync(process.execPath, [CLI, 'alias', ...argv], {
    env: { ...process.env, SQUADCTL_REPO_ROOT: root },
    encoding: 'utf8',
  });
  return { status: result.status };
}

function decisions(root: string): {
  aliases?: { player: string; name: string }[];
  titleAliases?: { player: string; title: string }[];
} {
  return JSON.parse(readFileSync(path.join(root, 'data', 'decisions.json'), 'utf8')) as ReturnType<
    typeof decisions
  >;
}

describe('alias --title', () => {
  it('records a title alias, leaving name aliases untouched', () => {
    const root = fixture();
    expect(runAlias(root, ['grimaldo', '--title', 'Alejandro Grimaldo']).status).toBe(0);
    expect(decisions(root).titleAliases).toEqual([
      { player: 'grimaldo', title: 'Alejandro Grimaldo' },
    ]);
    expect(decisions(root).aliases).toEqual([]);
  });

  it('still records a name alias when --title is absent', () => {
    const root = fixture();
    expect(runAlias(root, ['grimaldo', 'Alejandro Grimaldo']).status).toBe(0);
    expect(decisions(root).aliases).toEqual([{ player: 'grimaldo', name: 'Alejandro Grimaldo' }]);
    expect(decisions(root).titleAliases ?? []).toEqual([]);
  });

  it('refuses a title the record already carries, which would be a no-op', () => {
    const root = fixture();
    expect(runAlias(root, ['grimaldo', '--title', 'Álex Grimaldo']).status).toBe(5);
  });

  it('refuses when neither a name nor --title is given', () => {
    const root = fixture();
    expect(runAlias(root, ['grimaldo']).status).toBe(5);
  });
});
