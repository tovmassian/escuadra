import { describe, expect, it } from 'vitest';
import { LANGUAGES, resolveLanguage, SUPPORTED_LANGUAGES } from '../resolveLanguage';

describe('resolveLanguage', () => {
  describe('following the phone', () => {
    it('takes the language of a regional tag', () => {
      expect(resolveLanguage('system', ['es-MX'], LANGUAGES)).toBe('es');
      expect(resolveLanguage('system', ['de-CH'], LANGUAGES)).toBe('de');
    });

    it('falls back to English when no phone language is supported', () => {
      expect(resolveLanguage('system', ['pt-BR'], LANGUAGES)).toBe('en');
      expect(resolveLanguage('system', [], LANGUAGES)).toBe('en');
    });

    it("takes the first supported language in the phone's order", () => {
      expect(resolveLanguage('system', ['pt-BR', 'fr-CA', 'es-ES'], LANGUAGES)).toBe('fr');
    });

    it('reads tags case-insensitively, with either separator and with a script', () => {
      expect(resolveLanguage('system', ['IT-it'], LANGUAGES)).toBe('it');
      expect(resolveLanguage('system', ['de_AT'], LANGUAGES)).toBe('de');
      expect(resolveLanguage('system', ['zh-Hans-CN', 'fr-Latn-FR'], LANGUAGES)).toBe('fr');
    });

    it('never picks a language that has no reviewed catalog', () => {
      expect(resolveLanguage('system', ['es-MX'], ['en', 'de'])).toBe('en');
    });
  });

  describe('a language picked in the app', () => {
    it('beats the phone', () => {
      expect(resolveLanguage('it', ['es-ES', 'de-DE'], LANGUAGES)).toBe('it');
    });

    it('keeps English when picked, whatever the phone', () => {
      expect(resolveLanguage('en', ['es-ES'], LANGUAGES)).toBe('en');
    });

    it('is ignored while its language is unsupported', () => {
      expect(resolveLanguage('es', ['de-DE'], ['en', 'de'])).toBe('de');
    });
  });

  it('ships English only until #145 adds a reviewed language', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en']);
    expect(resolveLanguage('system', ['es-MX'], SUPPORTED_LANGUAGES)).toBe('en');
  });
});
