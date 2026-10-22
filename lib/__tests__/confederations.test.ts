import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFEDERATIONS, CONFEDERATION_MEMBERS, confederationOf } from '../confederations';
import { flagFor } from '../flags';
import type { SquadManifestEntry } from '@/types/squad';

// The map is hand-authored knowledge, like lib/flags.ts, so drift from the
// data is the failure to guard: a nation squad added without a confederation
// fails here, rather than vanishing from every pill but All.
const ROOT = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(
  readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf-8'),
) as SquadManifestEntry[];
const nations = manifest.filter((s) => s.kind === 'nation');

describe('confederationOf', () => {
  it('maps a nation to its confederation', () => {
    expect(confederationOf('ESP')).toBe('UEFA');
    expect(confederationOf('ARG')).toBe('CONMEBOL');
    expect(confederationOf('MEX')).toBe('CONCACAF');
    expect(confederationOf('SEN')).toBe('CAF');
    expect(confederationOf('JPN')).toBe('AFC');
    expect(confederationOf('NZL')).toBe('OFC');
  });

  it('follows the confederation, not the continent', () => {
    expect(confederationOf('AUS')).toBe('AFC');
    expect(confederationOf('KAZ')).toBe('UEFA');
    expect(confederationOf('GUY')).toBe('CONCACAF');
    expect(confederationOf('SUR')).toBe('CONCACAF');
    expect(confederationOf('CYP')).toBe('UEFA');
    expect(confederationOf('GUM')).toBe('AFC');
  });

  it('returns null for a code it does not map', () => {
    // GLP (Guadeloupe) has a flag but no nation squad.
    expect(confederationOf('GLP')).toBeNull();
  });
});

describe('CONFEDERATION_MEMBERS', () => {
  it('maps every nation squad in data/index.json', () => {
    const unmapped = nations
      .filter((s) => {
        const code = flagFor(s.name);
        return code === null || confederationOf(code) === null;
      })
      .map((s) => s.name);
    expect(unmapped).toEqual([]);
  });

  it('puts no code in two confederations', () => {
    const codes = CONFEDERATIONS.flatMap((c) => CONFEDERATION_MEMBERS[c]);
    expect(codes.filter((code, i) => codes.indexOf(code) !== i)).toEqual([]);
  });

  it('lists each confederation in the order the pills show', () => {
    expect(CONFEDERATIONS).toEqual(['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']);
    expect(Object.keys(CONFEDERATION_MEMBERS)).toEqual([...CONFEDERATIONS]);
  });
});
