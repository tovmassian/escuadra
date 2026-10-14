import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Player, Squad } from '../../../../types/squad.ts';
import { playersInTeams, seasonYears, squadFiles } from './squad-files.ts';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const squad = (id: string, season: string, playerIds: string[]): Squad =>
  ({ id, season, members: playerIds.map((playerId) => ({ playerId, no: 1 })) }) as unknown as Squad;

describe('squadFiles', () => {
  it('walks nations, then each league folder in LEAGUES order, sorted within each', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'squadctl-squads-'));
    dirs.push(root);
    for (const [dir, file] of [
      ['nation', 'fra.json'],
      ['nation', 'esp.json'],
      ['club/serie-a', 'int.json'],
      ['club/la-liga', 'rma.json'],
      ['club/la-liga', 'notes.txt'],
    ] as const) {
      mkdirSync(path.join(root, dir), { recursive: true });
      writeFileSync(path.join(root, dir, file), '{}');
    }
    expect(squadFiles(root).map((f) => [path.relative(root, f.path), f.kind])).toEqual([
      ['nation/esp.json', 'nation'],
      ['nation/fra.json', 'nation'],
      ['club/la-liga/rma.json', 'club'],
      ['club/serie-a/int.json', 'club'],
    ]);
    expect(squadFiles(root)[2]).toMatchObject({ kind: 'club', league: 'la-liga' });
  });

  it('finds nothing where there are no squads', () => {
    expect(squadFiles(path.join(tmpdir(), 'squadctl-no-such-dir'))).toEqual([]);
  });
});

describe('playersInTeams', () => {
  const player = (id: string) => ({ id }) as Player;

  it('selects the members of the named teams', () => {
    const selected = playersInTeams(
      [player('a'), player('b'), player('c')],
      [squad('esp', '2026', ['a', 'b']), squad('fra', '2026', ['c'])],
      ['esp'],
    );
    expect(selected.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('seasonYears', () => {
  it('gives each member the first year of their latest season', () => {
    const years = seasonYears([
      squad('esp', '2026', ['pedri']),
      squad('fcb', '2027/28', ['pedri', 'gavi']),
      squad('old', '2024/25', ['gavi']),
    ]);
    expect(years).toEqual(
      new Map([
        ['pedri', 2027],
        ['gavi', 2027],
      ]),
    );
  });
});
