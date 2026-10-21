import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIFA_COUNTRIES, countryForCode } from './fifa-countries.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

interface StoredPlayer {
  nationality: string;
}

function storedNationalities(): string[] {
  const players = JSON.parse(readFileSync(path.join(REPO_ROOT, 'data', 'players.json'), 'utf8')) as
    StoredPlayer[] | Record<string, StoredPlayer>;
  const list = Array.isArray(players) ? players : Object.values(players);
  return [...new Set(list.map((p) => p.nationality))].sort();
}

describe('fifa-countries table', () => {
  it('holds all 211 FIFA members, the four non-FIFA codes seen in club wikitext and five second codes', () => {
    expect(Object.keys(FIFA_COUNTRIES)).toHaveLength(220);
    for (const code of ['GLP', 'MTQ', 'GUF', 'REU']) {
      expect(FIFA_COUNTRIES[code]).toBeTypeOf('string');
    }
  });

  it('keys every entry on an uppercase trigram', () => {
    const bad = Object.keys(FIFA_COUNTRIES).filter((c) => !/^[A-Z]{3}$/.test(c));
    expect(bad).toEqual([]);
  });

  // A second code is one Wikipedia's own flag templates accept for that
  // country: Freiburg writes KVX (FIFA's) where most write KOS, and the
  // October 2026 sweep found SPA, SLO, DRC and NGR (IOC-style). Each names the
  // one spelling, so nothing forks; any other pair is a copy error.
  it('never maps two codes to the same country name, except the known second codes', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const [code, country] of Object.entries(FIFA_COUNTRIES)) {
      const first = seen.get(country);
      if (first !== undefined) collisions.push(`${country}: ${first} and ${code}`);
      else seen.set(country, code);
    }
    expect(collisions.sort()).toEqual([
      'DR Congo: COD and DRC',
      'Kosovo: KOS and KVX',
      'Nigeria: NGA and NGR',
      'Slovenia: SLO and SVN',
      'Spain: ESP and SPA',
    ]);
  });

  // The guard that keeps the table from forking a nationality string. If this
  // fails, the table invented a second spelling for a country players.json
  // already names — fix the table, never players.json.
  it('produces every nationality spelling already stored in players.json', () => {
    const spellings = new Set(Object.values(FIFA_COUNTRIES));
    const unreachable = storedNationalities().filter((n) => !spellings.has(n));
    expect(unreachable).toEqual([]);
  });

  // The spellings this project has settled on, pinned so a future re-seed
  // cannot quietly swap one in. Deliberately not uniform: TUR takes FIFA's
  // current official name, while CIV and CZE keep the common-English form the
  // data already used. Each is a content decision, not an oversight.
  it('pins the country names the repo has settled on', () => {
    expect(countryForCode('CIV')).toBe('Ivory Coast');
    expect(countryForCode('CZE')).toBe('Czech Republic');
    expect(countryForCode('KOR')).toBe('South Korea');
    expect(countryForCode('COD')).toBe('DR Congo');
    expect(countryForCode('IRL')).toBe('Republic of Ireland');
    expect(countryForCode('USA')).toBe('United States');
    expect(countryForCode('TUR')).toBe('Türkiye');
  });

  it('normalises case and surrounding whitespace, and reports an unmapped code as null', () => {
    expect(countryForCode('esp')).toBe('Spain');
    expect(countryForCode(' Ned ')).toBe('Netherlands');
    expect(countryForCode('ZZZ')).toBeNull();
  });
});
