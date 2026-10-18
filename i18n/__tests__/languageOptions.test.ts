import { describe, expect, it } from 'vitest';
import { languageChipCode, languageRows } from '../languageOptions';
import { LANGUAGE_NAMES } from '../names';
import { LANGUAGES, SUPPORTED_LANGUAGES } from '../resolveLanguage';

describe('languageRows', () => {
  it('opens with "Match phone", showing the language the phone resolves to', () => {
    expect(languageRows(LANGUAGES, 'es')[0]).toEqual({ preference: 'system', language: 'es' });
  });

  it('then lists every supported language by its own name: Deutsch, English, Español, Français, Italiano', () => {
    const rows = languageRows(LANGUAGES, 'en').slice(1);
    expect(rows.map((row) => row.preference)).toEqual(['de', 'en', 'es', 'fr', 'it']);
    expect(rows.map((row) => LANGUAGE_NAMES[row.language])).toEqual([
      'Deutsch',
      'English',
      'Español',
      'Français',
      'Italiano',
    ]);
  });

  it('lists only the supported languages', () => {
    const rows = languageRows(['en', 'fr'], 'fr');
    expect(rows.map((row) => row.preference)).toEqual(['system', 'en', 'fr']);
  });

  it('offers "Match phone", then each reviewed language and no other', () => {
    const [first, ...rest] = languageRows(SUPPORTED_LANGUAGES, 'en');
    expect(first?.preference).toBe('system');
    expect(rest.map((row) => row.preference).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });
});

describe('languageChipCode', () => {
  it('is the language as a two-letter capital code', () => {
    expect(LANGUAGES.map(languageChipCode)).toEqual(['EN', 'ES', 'FR', 'IT', 'DE']);
  });
});

describe('LANGUAGE_NAMES', () => {
  it('names every language in itself', () => {
    expect(Object.keys(LANGUAGE_NAMES).sort()).toEqual([...LANGUAGES].sort());
  });
});
