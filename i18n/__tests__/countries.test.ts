import { describe, expect, it } from 'vitest';
import { FLAG_BY_NATIONALITY } from '@/lib/flags';
import { COUNTRY_NAMES } from '../countries';
import { SUPPORTED_LANGUAGES } from '../resolveLanguage';

// The FIFA codes `lib/flags.ts` maps nationalities to. Country names are keyed
// by these, so the flag table and the name table cannot drift apart unseen.
const CODES = Object.values(FLAG_BY_NATIONALITY);

describe('COUNTRY_NAMES', () => {
  it('maps each nationality to a code of its own, so no two names share one label', () => {
    expect(new Set(CODES).size).toBe(CODES.length);
  });

  for (const language of SUPPORTED_LANGUAGES) {
    describe(language, () => {
      const names = COUNTRY_NAMES[language];

      it('names every code in FLAG_BY_NATIONALITY', () => {
        const missing = CODES.filter((code) => !names[code]);
        expect(missing).toEqual([]);
      });

      it('names no code the flag table does not know', () => {
        expect(Object.keys(names).sort()).toEqual([...CODES].sort());
      });

      it('gives two countries two different names', () => {
        const values = Object.values(names);
        expect(new Set(values).size).toBe(values.length);
      });
    });
  }

  it('reproduces, in English, the name the data uses today', () => {
    for (const [nationality, code] of Object.entries(FLAG_BY_NATIONALITY)) {
      expect(COUNTRY_NAMES.en[code]).toBe(nationality);
    }
    expect(COUNTRY_NAMES.en.CHN).toBe('China PR');
  });
});
