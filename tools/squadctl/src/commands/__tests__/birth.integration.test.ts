// End-to-end tests of `birth`, the command answer to `enrich`'s birth-date
// conflicts, driven through the real oclif `run` statics against a throwaway
// repo (lib/__tests__/fixtures/enrich-repo.ts). Each answer is checked by the `enrich`
// run that follows it, offline: the held photo is already cached.
import { describe, expect, it } from 'vitest';
import {
  PLAYERS,
  player,
  readText,
  repo,
  stored,
  useThrowawayRepos,
} from '../../lib/__tests__/fixtures/enrich-repo.ts';
import Birth from '../birth.ts';
import Enrich from '../enrich.ts';

useThrowawayRepos();

const keptBirths = (root: string): unknown =>
  (JSON.parse(readText(root, 'decisions.json')) as { keptBirths: unknown }).keptBirths;

describe('birth <id> <date>, then enrich', () => {
  it('clears the conflict and releases the photo once the date is answered', async () => {
    const root = repo();
    await Birth.run(['torres', '2000-02-29', '--json'], import.meta.url);
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.conflicts).toEqual([]);
    expect(stored(root).get('torres')).toMatchObject({
      birth: '2000-02-29',
      photo: { file: 'Torres.jpg' },
    });
  });

  // The kept birth confirmed the old date; left behind, it would fail the
  // data test (`npm run check`) until someone hand-edited decisions.json.
  it('removes the kept birth that confirmed the date it replaces', async () => {
    const root = repo();
    await Birth.run(['torres', '2000-02-28', '--json'], import.meta.url);
    await Birth.run(['torres', '--keep', '--json'], import.meta.url);
    expect(keptBirths(root)).toEqual([{ player: 'torres', birth: '2000-02-28' }]);

    const report = await Birth.run(['torres', '2000-02-29', '--json'], import.meta.url);
    expect(report.droppedKept).toBe(true);
    expect(keptBirths(root)).toEqual([]);
    expect(stored(root).get('torres')?.birth).toBe('2000-02-29');
  });

  it('touches no decisions when there is no kept birth', async () => {
    const root = repo();
    const report = await Birth.run(['torres', '2000-02-29', '--json'], import.meta.url);
    expect(report.droppedKept).toBe(false);
    expect(() => readText(root, 'decisions.json')).toThrow();
  });

  // Filled from Wikidata, 1950 makes the player 76 in 2026: no squad player
  // is, so the title probably names an older namesake.
  it('confirms a date enrich would not fill, and releases the photo', async () => {
    const root = repo({
      players: [...PLAYERS, player('veteran', { wikiTitle: 'Veteran' })],
      members: ['pedri', 'veteran'],
    });
    const held = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(held.conflicts.find((c) => c.playerId === 'veteran')).toMatchObject({
      kind: 'implausible-birth',
      age: 76,
    });
    expect(stored(root).get('veteran')).toMatchObject({ birth: null, photo: null });

    await Birth.run(['veteran', '1950-03-02', '--json'], import.meta.url);
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.players.find((p) => p.id === 'veteran')).toMatchObject({
      birth: 'agrees',
      photo: 'ok',
    });
  });
});

describe('birth --keep, then enrich', () => {
  it('keeps the stored date against Wikidata and releases the photo', async () => {
    const root = repo();
    await Birth.run(['torres', '2000-02-28', '--json'], import.meta.url);
    await Birth.run(['torres', '--keep', '--json'], import.meta.url);
    expect(keptBirths(root)).toEqual([{ player: 'torres', birth: '2000-02-28' }]);

    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.conflicts).toEqual([]);
    expect(report.players.find((p) => p.id === 'torres')?.birth).toBe('kept');
    expect(stored(root).get('torres')).toMatchObject({
      birth: '2000-02-28',
      photo: { file: 'Torres.jpg' },
    });
  });

  it('refuses to keep a stored date that does not exist', async () => {
    const root = repo();
    await expect(Birth.run(['torres', '--keep'], import.meta.url)).rejects.toThrow(/1998-02-29/);
    expect(() => readText(root, 'decisions.json')).toThrow();
  });
});
