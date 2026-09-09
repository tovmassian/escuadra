import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLAG_BY_NATIONALITY, flagFor } from './flags.ts';
import type { Player, Squad } from '@/types/squad';

// The lookup table is hand-authored — it is knowledge, not derivable — which
// makes drift between it and the data the one real failure mode. These tests
// are the guard the design chose instead of adding a `flag` field to squad
// JSON: a newly ingested squad whose name or whose players' nationalities are
// not in the table fails `npm run check` rather than silently losing a flag.
//
// Read the PNG directory with node:fs rather than importing
// assets/flags/generated.ts: that module require()s PNGs, which only Metro
// can resolve, and would throw in this Node test process.
const ROOT = path.resolve(import.meta.dirname, '..');

function flagFilesOnDisk(): Set<string> {
  return new Set(
    readdirSync(path.join(ROOT, 'assets', 'flags'))
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.replace(/\.png$/, '')),
  );
}

function readJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(path.join(ROOT, relPath), 'utf-8')) as T;
}

describe('flagFor', () => {
  it('resolves a nationality to its FIFA code', () => {
    expect(flagFor('Spain')).toBe('ESP');
    expect(flagFor('Japan')).toBe('JPN');
  });

  it('resolves names whose code is not derivable from the spelling', () => {
    expect(flagFor('Republic of Ireland')).toBe('IRL');
    expect(flagFor('Ivory Coast')).toBe('CIV');
    expect(flagFor('DR Congo')).toBe('COD');
    expect(flagFor('Congo')).toBe('CGO');
    expect(flagFor('Saudi Arabia')).toBe('KSA');
    expect(flagFor('Türkiye')).toBe('TUR');
    expect(flagFor('Netherlands')).toBe('NED');
  });

  it('returns null for an unmapped name rather than throwing', () => {
    // Call sites degrade to text-only on null; they must never crash a round.
    expect(flagFor('Atlantis')).toBeNull();
    expect(flagFor('')).toBeNull();
  });
});

describe('FLAG_BY_NATIONALITY', () => {
  it('maps every code to a PNG that exists on disk', () => {
    const onDisk = flagFilesOnDisk();
    const missing = Object.entries(FLAG_BY_NATIONALITY)
      .filter(([, code]) => !onDisk.has(code))
      .map(([name, code]) => `${name} -> ${code}.png`);
    expect(missing).toEqual([]);
  });

  it('never maps two nationalities to the same code', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const [name, code] of Object.entries(FLAG_BY_NATIONALITY)) {
      const first = seen.get(code);
      if (first !== undefined) collisions.push(`${code}: ${first} and ${name}`);
      else seen.set(code, name);
    }
    expect(collisions).toEqual([]);
  });

  it('covers every nationality in players.json', () => {
    const players = readJson<Player[]>('data/players.json');
    const unmapped = [...new Set(players.map((p) => p.nationality))]
      .filter((n) => flagFor(n) === null)
      .sort();
    expect(unmapped).toEqual([]);
  });

  it('covers every nation squad name', () => {
    const dir = path.join(ROOT, 'data', 'squads', 'nation');
    const unmapped = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJson<Squad>(path.join('data', 'squads', 'nation', f)).name)
      .filter((name) => flagFor(name) === null)
      .sort();
    expect(unmapped).toEqual([]);
  });
});
