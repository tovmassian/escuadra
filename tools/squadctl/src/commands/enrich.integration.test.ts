// End-to-end tests of `enrich` and `birth`, driven through their real oclif
// `run` statics against a throwaway repo, as apply.integration.test.ts does.
// The network is never touched: each test seeds .cache/wikimedia/ with the
// responses for exactly the URLs the command builds, then runs `--offline`.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Player, Squad } from '../../../../types/squad.ts';
import {
  COMMONS_API,
  REQUESTS,
  WIKIDATA_API,
  WIKIPEDIA_API,
  apiUrl,
  cacheFile,
} from '../lib/wikimedia-fetch.ts';
import Birth from './birth.ts';
import Enrich from './enrich.ts';

const madeRoots: string[] = [];
let originalExitCode: typeof process.exitCode;

beforeEach(() => {
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
});

afterEach(() => {
  process.exitCode = originalExitCode;
  delete process.env.SQUADCTL_REPO_ROOT;
  for (const root of madeRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    fullName: id,
    birth: null,
    position: 'MF',
    nationality: 'Spain',
    club: 'Barcelona',
    photo: null,
    wikiTitle: null,
    ...overrides,
  };
}

const PLAYERS: Player[] = [
  player('nobody'),
  player('pedri', { wikiTitle: 'Pedri' }),
  player('torres', { wikiTitle: 'Ferran Torres', birth: '1998-02-29' }),
];

const timeClaim = (time: string) => ({
  rank: 'normal',
  mainsnak: {
    snaktype: 'value',
    datavalue: {
      value: { time, precision: 11, calendarmodel: 'http://www.wikidata.org/entity/Q1985727' },
    },
  },
});
const itemClaim = (id: string) => ({
  rank: 'normal',
  mainsnak: { snaktype: 'value', datavalue: { value: { id } } },
});
const imageInfo = (file: string) => ({
  title: `File:${file}`,
  imageinfo: [
    {
      thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/500px-${file}?utm_source=x`,
      descriptionurl: `https://commons.wikimedia.org/wiki/File:${file}`,
      extmetadata: {
        Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:B">Bryan Berlin</a>' },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
      },
    },
  ],
});

/** The responses the lookups for PLAYERS get, keyed by request. */
const RESPONSES: [string, Record<string, string>, unknown][] = [
  [
    WIKIPEDIA_API,
    REQUESTS.articles(['Ferran Torres', 'Pedri']),
    {
      query: {
        pages: [
          { title: 'Pedri', pageimage: 'Pedri.jpg', pageprops: { wikibase_item: 'Q1' } },
          { title: 'Ferran Torres', pageimage: 'Torres.jpg', pageprops: { wikibase_item: 'Q2' } },
        ],
      },
    },
  ],
  [
    WIKIDATA_API,
    REQUESTS.people(['Q1', 'Q2']),
    {
      entities: {
        Q1: {
          id: 'Q1',
          claims: { P31: [itemClaim('Q5')], P569: [timeClaim('+2002-11-25T00:00:00Z')] },
        },
        Q2: {
          id: 'Q2',
          claims: { P31: [itemClaim('Q5')], P569: [timeClaim('+2000-02-29T00:00:00Z')] },
        },
      },
    },
  ],
  [
    COMMONS_API,
    REQUESTS.credits(['Pedri.jpg', 'Torres.jpg']),
    { query: { pages: [imageInfo('Pedri.jpg'), imageInfo('Torres.jpg')] } },
  ],
];

function repo({ seed = RESPONSES }: { seed?: typeof RESPONSES } = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'squadctl-enrich-'));
  madeRoots.push(root);
  mkdirSync(path.join(root, 'data', 'squads', 'nation'), { recursive: true });
  writeFileSync(path.join(root, 'data', 'players.json'), JSON.stringify(PLAYERS, null, 2));
  const esp = { id: 'esp', members: [{ playerId: 'pedri', no: 20 }] } as unknown as Squad;
  writeFileSync(path.join(root, 'data', 'squads', 'nation', 'esp.json'), JSON.stringify(esp));
  const cacheDir = path.join(root, '.cache', 'wikimedia');
  mkdirSync(cacheDir, { recursive: true });
  for (const [endpoint, params, body] of seed) {
    const url = apiUrl(endpoint, params);
    writeFileSync(cacheFile(cacheDir, url), JSON.stringify({ url, fetchedAt: '', body }));
  }
  process.env.SQUADCTL_REPO_ROOT = root;
  return root;
}

function stored(root: string): Map<string, Player> {
  const players = JSON.parse(
    readFileSync(path.join(root, 'data', 'players.json'), 'utf8'),
  ) as Player[];
  return new Map(players.map((p) => [p.id, p]));
}

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
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pedri.jpg',
    });
    expect(players.get('pedri')?.birth).toBe('2002-11-25');
    // Stored 1998-02-29 against Wikidata's 2000-02-29: neither is taken.
    expect(players.get('torres')).toMatchObject({ birth: '1998-02-29', photo: null });
    expect(report.conflicts.map((c) => c.playerId)).toEqual(['torres']);
    expect(report.requests).toBe(0);
    expect(process.exitCode).toBe(4);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const root = repo();
    await Enrich.run(['--offline', '--json'], import.meta.url);
    const first = readFileSync(path.join(root, 'data', 'players.json'), 'utf8');
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.summary.changed.records).toBe(0);
    expect(readFileSync(path.join(root, 'data', 'players.json'), 'utf8')).toBe(first);
  });

  it('writes nothing on --dry-run', async () => {
    const root = repo();
    const before = readFileSync(path.join(root, 'data', 'players.json'), 'utf8');
    const report = await Enrich.run(['--offline', '--dry-run', '--json'], import.meta.url);
    expect(report.summary.changed.photos).toBe(1);
    expect(readFileSync(path.join(root, 'data', 'players.json'), 'utf8')).toBe(before);
  });

  it('keeps every record and exits 1 when a lookup cannot be served', async () => {
    const root = repo({ seed: [] });
    const before = readFileSync(path.join(root, 'data', 'players.json'), 'utf8');
    const report = await Enrich.run(['--offline', '--json'], import.meta.url);
    expect(report.failures).toHaveLength(1);
    expect(report.summary.photo['lookup-failed']).toBe(2);
    expect(readFileSync(path.join(root, 'data', 'players.json'), 'utf8')).toBe(before);
    expect(process.exitCode).toBe(1);
  });

  it('looks up only the named teams’ members with --only', async () => {
    const root = repo({
      seed: [
        [
          WIKIPEDIA_API,
          REQUESTS.articles(['Pedri']),
          {
            query: {
              pages: [
                { title: 'Pedri', pageimage: 'Pedri.jpg', pageprops: { wikibase_item: 'Q1' } },
              ],
            },
          },
        ],
        [WIKIDATA_API, REQUESTS.people(['Q1']), RESPONSES[1]?.[2]],
        [
          COMMONS_API,
          REQUESTS.credits(['Pedri.jpg']),
          { query: { pages: [imageInfo('Pedri.jpg')] } },
        ],
      ],
    });
    const report = await Enrich.run(['--offline', '--only', 'esp', '--json'], import.meta.url);
    expect(report.players.map((p) => p.id)).toEqual(['pedri']);
    expect(stored(root).get('pedri')?.photo?.file).toBe('Pedri.jpg');
    expect(process.exitCode).toBeUndefined();
  });
});

describe('birth, then enrich', () => {
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
});
