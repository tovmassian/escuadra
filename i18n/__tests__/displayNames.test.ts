import { describe, expect, it } from 'vitest';
import indexData from '@/data/index.json';
import { countryName, nationalityName, squadDisplayName } from '../displayNames';
import type { SquadManifestEntry } from '@/types/squad';

describe('countryName', () => {
  it('names a code in a language', () => {
    expect(countryName('ESP', 'en')).toBe('Spain');
    expect(countryName('CHN', 'en')).toBe('China PR');
  });
});

describe('nationalityName', () => {
  it('shows the language name of a mapped nationality', () => {
    expect(nationalityName('Spain', 'en')).toBe('Spain');
    expect(nationalityName('Ivory Coast', 'en')).toBe('Ivory Coast');
  });

  it('falls back to the English string for an unmapped one, never throwing', () => {
    expect(nationalityName('Atlantis', 'en')).toBe('Atlantis');
    expect(nationalityName('—', 'en')).toBe('—');
  });
});

describe('squadDisplayName', () => {
  it('translates a nation by its country name', () => {
    expect(squadDisplayName({ kind: 'nation', name: 'Spain' }, 'en')).toBe('Spain');
  });

  it('leaves a club alone, even one whose name is also a country', () => {
    expect(squadDisplayName({ kind: 'club', name: 'Real Betis' }, 'en')).toBe('Real Betis');
    expect(squadDisplayName({ kind: 'club', name: 'Spain' }, 'en')).toBe('Spain');
  });

  it('shows every nation squad in the data exactly as today in English', () => {
    const nations = (indexData as SquadManifestEntry[]).filter((s) => s.kind === 'nation');
    expect(nations.length).toBeGreaterThan(0);
    for (const nation of nations) {
      expect(squadDisplayName(nation, 'en')).toBe(nation.name);
    }
  });

  it('shows every club in the data exactly as today', () => {
    const clubs = (indexData as SquadManifestEntry[]).filter((s) => s.kind === 'club');
    for (const club of clubs) {
      expect(squadDisplayName(club, 'en')).toBe(club.name);
    }
  });
});
