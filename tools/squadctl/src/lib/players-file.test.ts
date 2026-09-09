import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPlayers, writePlayers } from './players-file.ts';

function dataDirWith(json: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'players-file-'));
  writeFileSync(path.join(dir, 'players.json'), json);
  return dir;
}

const RECORD = {
  id: 'raya',
  name: 'David Raya',
  fullName: 'David Raya Martín',
  birth: '1995-09-15',
  position: 'GK',
  nationality: 'Spain',
  club: 'Arsenal',
  photo: null,
};

describe('readPlayers', () => {
  it('reads a record written before wikiTitle existed as null, not undefined', () => {
    const dir = dataDirWith(JSON.stringify([RECORD]));
    const [player] = readPlayers(dir);
    expect(player?.wikiTitle).toBeNull();
    expect('wikiTitle' in (player ?? {})).toBe(true);
  });

  it('keeps a stored title', () => {
    const dir = dataDirWith(JSON.stringify([{ ...RECORD, wikiTitle: 'David Raya' }]));
    expect(readPlayers(dir)[0]?.wikiTitle).toBe('David Raya');
  });
});

describe('writePlayers', () => {
  it('sorts by id, so a no-op run produces an empty git diff', async () => {
    const dir = dataDirWith(JSON.stringify([]));
    await writePlayers(dir, [
      { ...RECORD, id: 'zubimendi', wikiTitle: null, position: 'MF' as const },
      { ...RECORD, id: 'raya', wikiTitle: null, position: 'GK' as const },
    ]);
    const written = JSON.parse(readFileSync(path.join(dir, 'players.json'), 'utf8')) as {
      id: string;
    }[];
    expect(written.map((p) => p.id)).toEqual(['raya', 'zubimendi']);
  });

  it('round-trips a title through write and read', async () => {
    const dir = dataDirWith(JSON.stringify([]));
    await writePlayers(dir, [{ ...RECORD, position: 'GK' as const, wikiTitle: 'David Raya' }]);
    expect(readPlayers(dir)[0]?.wikiTitle).toBe('David Raya');
  });
});
