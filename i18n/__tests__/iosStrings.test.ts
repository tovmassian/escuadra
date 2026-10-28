// i18n/__tests__/iosStrings.test.ts
// iOS's own prompts speak each supported language too (#228): app.json's `locales`
// point at i18n/ios/<lang>.json, whose `ios` block becomes that language's
// InfoPlist.strings. Without NSPhotoLibraryAddUsageDescription, iOS leaves Save Image
// out of the share sheet.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../resolveLanguage';

const KEY = 'NSPhotoLibraryAddUsageDescription';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
}

const app = readJson<{
  expo: { ios: { infoPlist: Record<string, unknown> }; locales: Record<string, string> };
}>('../../app.json');

function usage(language: string): unknown {
  return readJson<{ ios: Record<string, unknown> }>(`../ios/${language}.json`).ios[KEY];
}

describe('iOS prompts', () => {
  it('has a strings file for every supported language, and no other', () => {
    expect(app.expo.locales).toEqual(
      Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l, `./i18n/ios/${l}.json`])),
    );
  });

  it("falls back to the English prompt in a language Escuadra doesn't speak", () => {
    expect(app.expo.ios.infoPlist[KEY]).toBe(usage('en'));
  });

  it.each(SUPPORTED_LANGUAGES.filter((l) => l !== 'en'))(
    'words the Photos prompt in %s, naming Escuadra',
    (language) => {
      const text = usage(language);
      expect(typeof text).toBe('string');
      expect(text).toContain('Escuadra');
      expect(text).not.toBe(usage('en'));
    },
  );
});
