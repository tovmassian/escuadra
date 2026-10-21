// `unlink` writes two files: the decision, and the record it clears. Spawned
// rather than called in-process, like alias.integration.test.ts, because what
// is under test is which files the command writes.
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

const PHOTO = {
  file: 'Gomez.jpg',
  url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Gomez.jpg',
  width: 800,
  height: 1200,
  author: 'Someone',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
};

/** Nicaragua's Emmanuel Gómez carrying the Gambian defender's title, and a
 *  namesake elsewhere carrying the same title, who must be left alone. */
function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'squadctl-unlink-'));
  madeRoots.push(root);
  mkdirSync(path.join(root, 'data', 'squads', 'nation'), { recursive: true });
  const player = (over: Partial<Player> & { id: string }): Player => ({
    name: 'Emmanuel Gómez',
    fullName: 'Emmanuel Gómez',
    birth: '2000-05-17',
    position: 'DF',
    nationality: 'Nicaragua',
    club: 'UMECIT',
    photo: PHOTO,
    wikiTitle: 'Emmanuel Gómez',
    ...over,
  });
  writeFileSync(
    path.join(root, 'data', 'players.json'),
    JSON.stringify([
      player({ id: 'emmanuel-gomez' }),
      player({ id: 'gambian', nationality: 'Gambia', birth: '1990-12-20' }),
    ]),
  );
  writeFileSync(
    path.join(root, 'data', 'squads', 'nation', 'nca.json'),
    JSON.stringify({ id: 'nca', kind: 'nation', members: [{ playerId: 'emmanuel-gomez', no: 5 }] }),
  );
  writeFileSync(path.join(root, 'data', 'decisions.json'), JSON.stringify({ splits: [] }));
  return root;
}

function unlink(root: string): number | null {
  return spawnSync(
    process.execPath,
    [CLI, 'unlink', 'nca', 'Emmanuel Gómez', '--reason', 'a Gambian defender born 1990'],
    { env: { ...process.env, SQUADCTL_REPO_ROOT: root }, encoding: 'utf8' },
  ).status;
}

const read = <T>(root: string, file: string): T =>
  JSON.parse(readFileSync(path.join(root, 'data', file), 'utf8')) as T;

describe('squadctl unlink', () => {
  it('records the decision and clears the title and photo from the squad member', () => {
    const root = fixture();
    expect(unlink(root)).toBe(0);
    expect(read<{ wrongLinks: unknown[] }>(root, 'decisions.json').wrongLinks).toEqual([
      { team: 'nca', title: 'Emmanuel Gómez', reason: 'a Gambian defender born 1990' },
    ]);
    const players = new Map(read<Player[]>(root, 'players.json').map((p) => [p.id, p]));
    expect(players.get('emmanuel-gomez')).toMatchObject({ wikiTitle: null, photo: null });
    expect(players.get('emmanuel-gomez')?.birth).toBe('2000-05-17');
    // The person the title does name is not in this squad.
    expect(players.get('gambian')?.wikiTitle).toBe('Emmanuel Gómez');
  });

  it('is idempotent', () => {
    const root = fixture();
    unlink(root);
    const decisions = readFileSync(path.join(root, 'data', 'decisions.json'), 'utf8');
    expect(unlink(root)).toBe(0);
    expect(readFileSync(path.join(root, 'data', 'decisions.json'), 'utf8')).toBe(decisions);
  });
});
