// End-to-end tests of `enrich`, driven through its real oclif `run` static
// against a throwaway repo seeded with cached answers (lib/__fixtures__/enrich-repo.ts).
// `birth`'s answers to the conflicts enrich raises: birth.integration.test.ts.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLAYERS,
  SEED,
  player,
  readText,
  repo,
  stored,
  useThrowawayRepos,
} from '../lib/__fixtures__/enrich-repo.ts';
import { CREDITS } from '../lib/photo-credit.ts';
import Enrich from './enrich.ts';

useThrowawayRepos();

describe('enrich --offline', () => {
  it('writes the photo and fills the birth date, holding both on a conflict', async () => {
    const root = repo();
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    const players = stored(root);

    expect(players.get('pedri')?.photo).toEqual({
      file: 'Pedri.jpg',
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Pedri.jpg/500px-Pedri.jpg',
      author: 'Bryan Berlin',
      licence: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    });
    expect(players.get('pedri')?.birth).toBe('2002-11-25');
    // Stored 1998-02-29 against Wikidata's 2000-02-29: neither is taken.
    expect(players.get('torres')).toMatchObject({ birth: '1998-02-29', photo: null });
    expect(report.conflicts.map((c) => c.playerId)).toEqual(['torres']);
    expect(report.requests).toBe(0);
    expect(process.exitCode).toBe(4);
  });

  // Pedri's article image is usable, so Wikidata's own image for him is
  // never asked for — it is not even cached, and nothing fails.
  it('looks up an item’s image only when the article’s is not usable', async () => {
    repo();
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.failures).toEqual([]);
    expect(report.players.find((p) => p.id === 'pedri')?.imageSource).toBe('article');
  });

  it('is idempotent: a second run changes nothing', async () => {
    const root = repo();
    await Enrich.run(['--offline', '--json'], import.meta.url);
    const first = readText(root, 'players.json');
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.summary.changed.records).toBe(0);
    expect(readText(root, 'players.json')).toBe(first);
  });

  it('writes nothing on --dry-run', async () => {
    const root = repo();
    const before = readText(root, 'players.json');
    const report = await Enrich.run(['--offline', '--dry-run', '--json'], import.meta.url);
    expect(report.summary.changed.photos).toBe(1);
    expect(readText(root, 'players.json')).toBe(before);
  });

  it('keeps every record and exits 1 when a lookup cannot be served', async () => {
    const root = repo({ seed: [] });
    const before = readText(root, 'players.json');
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.failures).toEqual([
      'wikipedia: nothing cached for Ferran Torres, Pedri (run once without --offline first)',
    ]);
    expect(report.summary.photo['lookup-failed']).toBe(2);
    expect(readText(root, 'players.json')).toBe(before);
    expect(process.exitCode).toBe(1);
  });

  // Answers are cached per key, so any selection is served from one run's
  // cache, whatever batches that run happened to send.
  it('looks up only the named teams’ members with --only, from the same cache', async () => {
    const root = repo();
    const report = await Enrich.run(['--offline', '--only', 'esp', '--json'], import.meta.url);
    expect(report.players.map((p) => p.id)).toEqual(['pedri']);
    expect(stored(root).get('pedri')?.photo?.file).toBe('Pedri.jpg');
    expect(process.exitCode).toBeUndefined();
  });

  it('serves every other player from the cache after one is retitled', async () => {
    const root = repo();
    const retitled = PLAYERS.map((p) =>
      p.id === 'torres' ? { ...p, wikiTitle: 'Ferran Torres (footballer)' } : p,
    );
    writeFileSync(path.join(root, 'data', 'players.json'), JSON.stringify(retitled));
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.players.find((p) => p.id === 'pedri')?.photo).toBe('ok');
    expect(report.players.find((p) => p.id === 'torres')?.photo).toBe('lookup-failed');
    expect(report.failures).toEqual([
      'wikipedia: nothing cached for Ferran Torres (footballer) (run once without --offline first)',
    ]);
  });

  // Both of Pedri's images are missing from Commons: the walk tries the
  // item's after the article's, and reports why the first was refused.
  it('says why a photo’s credit is incomplete', async () => {
    const missing = (file: string) => ({ title: `File:${file}`, missing: true });
    repo({
      players: [player('pedri', { wikiTitle: 'Pedri' })],
      seed: [
        ...SEED.filter(([, key]) => key !== 'Pedri.jpg'),
        [CREDITS, 'Pedri.jpg', missing('Pedri.jpg')],
        [CREDITS, 'Pedri item.jpg', missing('Pedri item.jpg')],
      ],
    });
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.failures).toEqual([]);
    expect(report.players).toEqual([
      expect.objectContaining({
        id: 'pedri',
        photo: 'incomplete-credit',
        file: 'Pedri.jpg',
        missing: ['licence', 'thumbnail', 'commons-page'],
      }),
    ]);
  });
});
