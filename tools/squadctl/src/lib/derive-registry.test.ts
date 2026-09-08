import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Squad } from '../../../../types/squad.ts';
import { deriveRegistry, diffRegistry } from './derive-registry.ts';
import type { TeamRegistryEntry } from './registry.ts';

const made: string[] = [];
const scratch = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'squadctl-derive-'));
  made.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const marker = { bands: ['#FFFFFF', '#E20001'], orientation: 'vertical' as const };

function squadFixture(over: Partial<Squad> = {}): Squad {
  return {
    id: 'sev',
    kind: 'club',
    name: 'Sevilla',
    season: '2025-26',
    primaryColor: '#FFFFFF',
    secondaryColor: '#E20001',
    verified: true,
    marker,
    lastUpdated: '2026-01-01',
    source: 'https://en.wikipedia.org/wiki/Sevilla_FC',
    members: [],
    ...over,
  };
}

/** Writes a squad fixture into `squadsDir` at the path deriveRegistry reads
 *  it from: `nation/<id>.json` or `club/<league>/<id>.json`. */
function writeSquad(squadsDir: string, league: string | null, squad: Squad): void {
  const dir =
    squad.kind === 'nation'
      ? path.join(squadsDir, 'nation')
      : path.join(squadsDir, 'club', league ?? '');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${squad.id}.json`), JSON.stringify(squad));
}

describe('deriveRegistry', () => {
  it('derives a nation entry with no league field', () => {
    const dir = scratch();
    writeSquad(
      dir,
      null,
      squadFixture({
        id: 'esp',
        kind: 'nation',
        name: 'Spain',
        source: 'https://en.wikipedia.org/wiki/Spain_national_football_team',
      }),
    );

    expect(deriveRegistry(dir)).toEqual([
      {
        id: 'esp',
        kind: 'nation',
        name: 'Spain',
        source: 'https://en.wikipedia.org/wiki/Spain_national_football_team',
        identity: { primaryColor: '#FFFFFF', secondaryColor: '#E20001', marker },
      },
    ]);
  });

  it('derives a club entry with its league', () => {
    const dir = scratch();
    writeSquad(dir, 'la-liga', squadFixture());

    expect(deriveRegistry(dir)).toEqual([
      {
        id: 'sev',
        kind: 'club',
        league: 'la-liga',
        name: 'Sevilla',
        source: 'https://en.wikipedia.org/wiki/Sevilla_FC',
        identity: { primaryColor: '#FFFFFF', secondaryColor: '#E20001', marker },
      },
    ]);
  });

  it('orders nation before club, clubs by LEAGUES order, filenames sorted within each', () => {
    const dir = scratch();
    // Written out of order on purpose so a passing test can't be an accident
    // of insertion order.
    writeSquad(dir, 'premier-league', squadFixture({ id: 'ars', name: 'Arsenal' }));
    writeSquad(dir, 'la-liga', squadFixture({ id: 'vil', name: 'Villarreal' }));
    writeSquad(dir, 'la-liga', squadFixture({ id: 'ala', name: 'Alavés' }));
    writeSquad(dir, 'serie-a', squadFixture({ id: 'int', name: 'Inter Milan' }));
    writeSquad(dir, null, squadFixture({ id: 'esp', kind: 'nation', name: 'Spain' }));
    writeSquad(dir, null, squadFixture({ id: 'arg', kind: 'nation', name: 'Argentina' }));

    expect(deriveRegistry(dir).map((e) => e.id)).toEqual([
      'arg',
      'esp',
      'ala',
      'vil',
      'int',
      'ars',
    ]);
  });

  it('returns an empty array when squadsDir has no nation or club subfolders', () => {
    expect(deriveRegistry(scratch())).toEqual([]);
  });

  it('skips a league folder that does not exist without error', () => {
    // Mirrors the repo today: data/squads/club/bundesliga/ exists but is
    // empty, and data/squads/club/ucl/ does not exist at all.
    const dir = scratch();
    writeSquad(dir, 'la-liga', squadFixture());
    mkdirSync(path.join(dir, 'club', 'bundesliga'), { recursive: true });

    expect(deriveRegistry(dir).map((e) => e.id)).toEqual(['sev']);
  });
});

describe('diffRegistry', () => {
  const derivedEntry = (over: Partial<TeamRegistryEntry> = {}): TeamRegistryEntry => ({
    id: 'sev',
    kind: 'club',
    league: 'la-liga',
    name: 'Sevilla',
    source: 'https://en.wikipedia.org/wiki/Sevilla_FC',
    identity: { primaryColor: '#FFFFFF', secondaryColor: '#E20001', marker },
    ...over,
  });

  it('reports nothing when every derived entry matches its stored entry', () => {
    expect(diffRegistry([derivedEntry()], [derivedEntry()])).toEqual([]);
  });

  it('reports a squad file with no stored entry', () => {
    const problems = diffRegistry([derivedEntry()], []);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('sev');
  });

  it('does not report a stored entry with no squad file — a not-yet-fetched new team', () => {
    const notYetFetched = derivedEntry({ id: 'bay', name: 'Bayern Munich' });
    expect(diffRegistry([], [notYetFetched])).toEqual([]);
  });

  it('is a subset check: unmatched stored entries alongside a clean match report nothing', () => {
    const matched = derivedEntry();
    const notYetFetched = derivedEntry({ id: 'bay', name: 'Bayern Munich' });
    expect(diffRegistry([matched], [matched, notYetFetched])).toEqual([]);
  });

  it('reports a name mismatch naming both values', () => {
    const problems = diffRegistry([derivedEntry()], [derivedEntry({ name: 'Sevilla FC' })]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('sev');
    expect(problems[0]).toContain('Sevilla FC');
    expect(problems[0]).toContain('Sevilla');
  });

  it('reports a source mismatch naming both values', () => {
    const otherSource = 'https://en.wikipedia.org/wiki/Sevilla';
    const problems = diffRegistry([derivedEntry()], [derivedEntry({ source: otherSource })]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(otherSource);
    expect(problems[0]).toContain('https://en.wikipedia.org/wiki/Sevilla_FC');
  });

  it('reports a league mismatch naming both values', () => {
    const problems = diffRegistry([derivedEntry()], [derivedEntry({ league: 'serie-a' })]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('la-liga');
    expect(problems[0]).toContain('serie-a');
  });

  it('reports a kind mismatch', () => {
    const problems = diffRegistry(
      [derivedEntry()],
      [derivedEntry({ kind: 'nation', league: undefined })],
    );
    expect(problems.join()).toContain('kind');
  });

  it('reports an identity.primaryColor mismatch naming both values', () => {
    const problems = diffRegistry(
      [derivedEntry()],
      [derivedEntry({ identity: { primaryColor: '#000000', secondaryColor: '#E20001', marker } })],
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('#FFFFFF');
    expect(problems[0]).toContain('#000000');
  });

  it('reports an identity.secondaryColor mismatch naming both values', () => {
    const problems = diffRegistry(
      [derivedEntry()],
      [derivedEntry({ identity: { primaryColor: '#FFFFFF', secondaryColor: '#000000', marker } })],
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('#E20001');
    expect(problems[0]).toContain('#000000');
  });

  it('reports a structural identity.marker mismatch', () => {
    const otherMarker = { bands: ['#E20001', '#FFFFFF'], orientation: 'vertical' as const };
    const problems = diffRegistry(
      [derivedEntry()],
      [
        derivedEntry({
          identity: { primaryColor: '#FFFFFF', secondaryColor: '#E20001', marker: otherMarker },
        }),
      ],
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('marker');
  });

  it('does not report a marker with identical content built in a different key order', () => {
    const reordered = { orientation: 'vertical' as const, bands: ['#FFFFFF', '#E20001'] };
    const problems = diffRegistry(
      [derivedEntry()],
      [
        derivedEntry({
          identity: { primaryColor: '#FFFFFF', secondaryColor: '#E20001', marker: reordered },
        }),
      ],
    );
    expect(problems).toEqual([]);
  });

  it('reports every mismatching field for one team, each naming the team id', () => {
    const problems = diffRegistry(
      [derivedEntry()],
      [derivedEntry({ name: 'Sevilla FC', source: 'https://en.wikipedia.org/wiki/Sevilla' })],
    );
    expect(problems).toHaveLength(2);
    for (const problem of problems) expect(problem).toContain('sev');
  });
});
