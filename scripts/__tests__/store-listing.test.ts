// The store listings (scripts/store-listing.ts): the format, the checks, and the real
// files in store/, which npm run check holds to them.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGUAGE_NAMES } from '@/i18n/names';
import { SUPPORTED_LANGUAGES } from '@/i18n/resolveLanguage';
import { pageUrl } from '../privacy-pages';
import {
  charCount,
  declaredPrivacyUrl,
  FIELDS,
  heading,
  LANGUAGES,
  listingProblems,
  parseListing,
  readListing,
  screenshotProblems,
  STORE_LOCALES,
  translationProblems,
  type Listing,
} from '../store-listing';

const ROOT = new URL('../../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, ROOT), 'utf8');
const exists = (file: string) => existsSync(new URL(file, ROOT));

const ENGLISH: Listing = {
  subtitle: 'Learn every football squad',
  promotionalText: 'Five languages, every squad.',
  keywords: 'football,squad,quiz,shirt numbers',
  shortDescription: 'Learn a football squad by its shirt numbers, in short rounds.',
  description: 'Escuadra teaches a squad by repetition.\n\nA flawless round is a la escuadra.',
  whatsNew: 'Photos of every player.',
};

const SPANISH: Listing = {
  subtitle: 'Aprende todas las plantillas',
  promotionalText: 'Cinco idiomas, todas las plantillas.',
  keywords: 'fútbol,plantilla,quiz,dorsales',
  shortDescription: 'Aprende una plantilla por sus dorsales, en rondas cortas.',
  description: 'Escuadra enseña una plantilla repitiendo.\n\nUna ronda perfecta es a la escuadra.',
  whatsNew: 'Fotos de cada jugador.',
};

/** A listing file holding `listing` under the headings FIELDS names. */
function file(listing: Listing, title = 'English'): string {
  return [
    `# ${title}`,
    '',
    ...FIELDS.flatMap((field) => [`## ${heading(field)}`, '', listing[field.id], '']),
  ].join('\n');
}

describe('the fields and languages', () => {
  it('cover the supported languages, each with a locale in both consoles', () => {
    expect([...LANGUAGES].sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    expect(Object.keys(STORE_LOCALES).sort()).toEqual([...LANGUAGES].sort());
  });

  it('head each field with its name, store and limit', () => {
    expect(FIELDS.map(heading)).toEqual([
      'Subtitle (App Store, 30)',
      'Promotional text (App Store, 170)',
      'Keywords (App Store, 100)',
      'Short description (Google Play, 80)',
      'Description (both, 4000)',
      "What's new (both, 500)",
    ]);
  });

  it('count characters, not UTF-16 units', () => {
    expect(charCount('ßé')).toBe(2);
    expect(charCount('⚽️')).toBe(2); // the ball and its presentation selector
  });
});

describe('parseListing', () => {
  it('reads the title and each field, trimmed, keeping line breaks inside a field', () => {
    const parsed = parseListing(file(ENGLISH));
    expect(parsed.title).toBe('English');
    expect(parsed.stray).toBe(false);
    expect(parsed.sections).toHaveLength(6);
    expect(parsed.sections[0]).toEqual({
      heading: 'Subtitle (App Store, 30)',
      body: ENGLISH.subtitle,
    });
    expect(parsed.sections[4]?.body).toBe(ENGLISH.description);
  });

  it('reads Windows line endings', () => {
    expect(parseListing(file(ENGLISH).replaceAll('\n', '\r\n')).sections[0]?.body).toBe(
      ENGLISH.subtitle,
    );
  });

  it('flags text outside any field', () => {
    expect(parseListing('# English\nstray\n## Subtitle (App Store, 30)\nx').stray).toBe(true);
  });
});

describe('listingProblems', () => {
  it('finds nothing wrong with a good file', () => {
    expect(listingProblems(file(ENGLISH))).toEqual([]);
  });

  it('wants exactly the fields, in order', () => {
    const swapped = file(ENGLISH).replace(
      '## Subtitle (App Store, 30)',
      '## Subtitle (App Store, 31)',
    );
    expect(listingProblems(swapped)[0]).toMatch(/exactly, in order/);
  });

  it('flags stray text and an empty field', () => {
    expect(listingProblems(file(ENGLISH).replace('# English', '# English\nhello'))).toContain(
      'text before the first field: every line belongs under a ## heading',
    );
    expect(listingProblems(file({ ...ENGLISH, subtitle: '' }))).toContain('Subtitle is empty');
  });

  it('holds each field to its limit in characters', () => {
    expect(listingProblems(file({ ...ENGLISH, subtitle: 'é'.repeat(30) }))).toEqual([]);
    expect(listingProblems(file({ ...ENGLISH, subtitle: 'é'.repeat(31) }))).toContain(
      'Subtitle is 31 characters, over its 30',
    );
  });

  it('flags another product name, but not category words (guardrail 6)', () => {
    expect(listingProblems(file({ ...ENGLISH, description: 'Squad Trainer helps.' }))).toContain(
      'Description calls the product something other than Escuadra (guardrail 6)',
    );
    expect(listingProblems(file({ ...ENGLISH, description: 'A football squad quiz.' }))).toEqual(
      [],
    );
  });

  it('wants keywords with no spaces around commas, no empty entry and no repeat', () => {
    expect(listingProblems(file({ ...ENGLISH, keywords: 'football, squad' }))).toContain(
      'Keywords have spaces around a comma, which spend the limit on nothing',
    );
    expect(listingProblems(file({ ...ENGLISH, keywords: 'football,,squad' }))).toContain(
      'Keywords have an empty entry between commas',
    );
    expect(listingProblems(file({ ...ENGLISH, keywords: 'football,Football' }))).toContain(
      'Keywords repeat "football"',
    );
  });
});

describe('readListing', () => {
  it('returns the fields by id', () => {
    expect(readListing(file(ENGLISH))).toEqual(ENGLISH);
  });

  it('throws what is wrong', () => {
    expect(() => readListing('# English')).toThrow(/exactly, in order/);
  });
});

describe('translationProblems', () => {
  it('passes a translation that keeps the names', () => {
    expect(translationProblems(SPANISH, ENGLISH)).toEqual([]);
  });

  it('flags a field left in English', () => {
    expect(translationProblems({ ...SPANISH, whatsNew: ENGLISH.whatsNew }, ENGLISH)).toEqual([
      "What's new is still the English text",
    ]);
  });

  it('flags a translated name', () => {
    expect(
      translationProblems({ ...SPANISH, description: 'Una ronda perfecta: Escuadra.' }, ENGLISH),
    ).toEqual(['Description must keep "a la escuadra" as it is']);
    expect(
      translationProblems({ ...SPANISH, description: 'La plantilla, a la escuadra.' }, ENGLISH),
    ).toEqual(['Description must keep the name Escuadra']);
  });
});

describe('screenshotProblems', () => {
  it('passes a short list of distinct names', () => {
    expect(screenshotProblems(['01-home', '05-study'])).toEqual([]);
  });

  it('wants a list of names, at least one, at most 8, each once', () => {
    expect(screenshotProblems({ shots: [] })).toEqual([
      'store/screenshots.json must be a list of capture names',
    ]);
    expect(screenshotProblems([])).toEqual(['store/screenshots.json lists no shots']);
    expect(screenshotProblems(Array.from({ length: 9 }, (_, i) => `shot-${i}`))).toEqual([
      'store/screenshots.json lists 9 shots; Play takes at most 8',
    ]);
    expect(screenshotProblems(['01-home', '01-home'])).toEqual([
      'store/screenshots.json lists a shot twice',
    ]);
  });
});

describe('declaredPrivacyUrl', () => {
  it('reads the privacy policy URL line', () => {
    expect(
      declaredPrivacyUrl('- Name: Escuadra\n- Privacy policy URL: https://x/privacy/2/\n'),
    ).toBe('https://x/privacy/2/');
    expect(declaredPrivacyUrl('- Name: Escuadra\n')).toBeNull();
  });
});

describe('the files in store/', () => {
  const present = LANGUAGES.filter((language) => exists(`store/listing/${language}.md`));

  it('hold English whenever they hold a translation', () => {
    if (present.length > 0) expect(present).toContain('en');
  });

  it('are each titled in their language, with every field within its limit', () => {
    const problems = present.flatMap((language) => {
      const text = read(`store/listing/${language}.md`);
      const title = parseListing(text).title;
      const titled =
        title === LANGUAGE_NAMES[language]
          ? []
          : [`title "${title}" is not "${LANGUAGE_NAMES[language]}"`];
      return [...titled, ...listingProblems(text)].map((problem) => `${language}.md: ${problem}`);
    });
    expect(problems).toEqual([]);
  });

  it('are translated from the English', () => {
    if (!present.includes('en')) return;
    const english = readListing(read('store/listing/en.md'));
    const problems = present
      .filter((language) => language !== 'en')
      .flatMap((language) =>
        translationProblems(readListing(read(`store/listing/${language}.md`)), english).map(
          (problem) => `${language}.md: ${problem}`,
        ),
      );
    expect(problems).toEqual([]);
  });

  it('list screenshots that design/screens/ holds', () => {
    const shots: unknown = JSON.parse(read('store/screenshots.json'));
    expect(screenshotProblems(shots)).toEqual([]);
    const missing = (shots as string[]).filter((shot) => !exists(`design/screens/${shot}.png`));
    expect(missing).toEqual([]);
  });

  it('declare the current privacy policy', () => {
    expect(declaredPrivacyUrl(read('store/declarations.md'))).toBe(pageUrl('en'));
  });
});
