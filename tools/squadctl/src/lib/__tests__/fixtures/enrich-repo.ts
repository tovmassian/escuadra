// A throwaway repo for driving `enrich` and `birth` through their real oclif
// `run` statics, as apply.integration.test.ts does. Here, not beside the
// commands, because oclif loads every non-test file under src/commands/ as a
// command. The network is never
// touched: each repo's .cache/wikimedia/ is seeded with the answer every key
// gets, and the commands run `--offline`.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach } from 'vitest';
import { commonsFileUrl } from '../../../../../../scripts/commons.ts';
import type { Player, Squad } from '../../../../../../types/squad.ts';
import { CREDITS } from '../../photo-credit.ts';
import { writeAnswer, type Lookup } from '../../wikimedia-fetch.ts';
import { ARTICLES, INFOBOXES, PEOPLE } from '../../wikimedia-parse.ts';

/** Registers the hooks that restore `process.exitCode` and delete every repo
 *  a test made. Call once at the top of a test file. */
export function useThrowawayRepos(): void {
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
}

const madeRoots: string[] = [];

export function player(id: string, overrides: Partial<Player> = {}): Player {
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

/** No title; Pedri, with no birth date stored; Torres, whose stored date
 *  (one that does not exist) Wikidata disagrees with. */
export const PLAYERS: Player[] = [
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
const valueClaim = (value: unknown) => ({
  rank: 'normal',
  mainsnak: { snaktype: 'value', datavalue: { value } },
});
const person = (id: string, born: string, image?: string) => ({
  id,
  claims: {
    P31: [valueClaim({ id: 'Q5' })],
    P569: [timeClaim(`+${born}T00:00:00Z`)],
    ...(image === undefined ? {} : { P18: [valueClaim(image)] }),
  },
});
/** A Commons file with a complete, accepted credit naming `artist`. */
export const imagePage = (
  file: string,
  artist = '<a href="//commons.wikimedia.org/wiki/User:B">Bryan Berlin</a>',
) => ({
  title: `File:${file}`,
  imageinfo: [
    {
      thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/960px-${file}?utm_source=x`,
      width: 1200,
      height: 1600,
      descriptionurl: commonsFileUrl(file),
      extmetadata: {
        Artist: { value: artist },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
      },
    },
  ],
});

export type Seed = [Lookup<unknown>, string, unknown][];

/** The answer each key gets. Q1's own image is never needed: Pedri's
 *  article image is usable, so it is deliberately not cached. Q3 is an
 *  older namesake, whose date gives no playing age in 2026. Torres's
 *  infobox gives no date, so his tie stays for a person. */
export const SEED: Seed = [
  [
    ARTICLES,
    'Pedri',
    { title: 'Pedri', pageimage: 'Pedri.jpg', pageprops: { wikibase_item: 'Q1' } },
  ],
  [
    ARTICLES,
    'Ferran Torres',
    { title: 'Ferran Torres', pageimage: 'Torres.jpg', pageprops: { wikibase_item: 'Q2' } },
  ],
  [
    ARTICLES,
    'Veteran',
    { title: 'Veteran', pageimage: 'Veteran.jpg', pageprops: { wikibase_item: 'Q3' } },
  ],
  [PEOPLE, 'Q1', person('Q1', '2002-11-25', 'Pedri item.jpg')],
  [PEOPLE, 'Q2', person('Q2', '2000-02-29')],
  [PEOPLE, 'Q3', person('Q3', '1950-03-02')],
  [INFOBOXES, 'Ferran Torres', { title: 'Ferran Torres', birthDate: null, currentClub: null }],
  [CREDITS, 'Pedri.jpg', imagePage('Pedri.jpg')],
  [CREDITS, 'Torres.jpg', imagePage('Torres.jpg')],
  [CREDITS, 'Veteran.jpg', imagePage('Veteran.jpg')],
];

/** A repo holding `players`, the `esp` squad (season 2026) of `members`,
 *  and the `seed` answers cached. Points squadctl at it. */
export function repo({
  players = PLAYERS,
  members = ['pedri'],
  seed = SEED,
}: { players?: Player[]; members?: string[]; seed?: Seed } = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'squadctl-enrich-'));
  madeRoots.push(root);
  mkdirSync(path.join(root, 'data', 'squads', 'nation'), { recursive: true });
  writeFileSync(path.join(root, 'data', 'players.json'), JSON.stringify(players, null, 2));
  const esp = {
    id: 'esp',
    season: '2026',
    members: members.map((playerId, no) => ({ playerId, no: no + 1 })),
  } as unknown as Squad;
  writeFileSync(path.join(root, 'data', 'squads', 'nation', 'esp.json'), JSON.stringify(esp));
  const cacheDir = path.join(root, '.cache', 'wikimedia');
  for (const [lookup, key, answer] of seed) writeAnswer(cacheDir, lookup, key, answer);
  process.env.SQUADCTL_REPO_ROOT = root;
  return root;
}

export function stored(root: string): Map<string, Player> {
  const players = JSON.parse(
    readFileSync(path.join(root, 'data', 'players.json'), 'utf8'),
  ) as Player[];
  return new Map(players.map((p) => [p.id, p]));
}

export function readText(root: string, file: string): string {
  return readFileSync(path.join(root, 'data', file), 'utf8');
}
