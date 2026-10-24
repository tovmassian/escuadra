// The store listings (scripts/store-listing.ts): the format, the checks, and the real
// files in store/, which npm run check holds to them.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGUAGE_NAMES } from '@/i18n/names';
import { SUPPORTED_LANGUAGES } from '@/i18n/resolveLanguage';
import { pageUrl } from '../privacy-pages';
import {
  baselineTag,
  charCount,
  declaredPrivacyUrl,
  fieldStatuses,
  FIELDS,
  heading,
  imageCopies,
  isReleaseBranch,
  LANGUAGES,
  listingProblems,
  pasteSheet,
  parseListing,
  readBaseline,
  readListing,
  reviewSheet,
  screenshotProblems,
  STORE_LOCALES,
  translationProblems,
  type FieldId,
  type Listing,
  type ListingLanguage,
  type SheetInput,
  type Status,
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

const ALL_PASTE = fieldStatuses(ENGLISH, null, true);

describe('baselineTag', () => {
  it('is null before any version is tagged', () => {
    expect(baselineTag([], '2.0.0')).toBeNull();
  });

  it('is the previous version while the next one is prepared', () => {
    expect(baselineTag(['v2.0.0', 'v2.0.1'], '2.1.0')).toBe('v2.0.1');
  });

  it('is the live version itself between versions', () => {
    expect(baselineTag(['v2.0.0'], '2.0.0')).toBe('v2.0.0');
  });

  it('compares versions as numbers', () => {
    expect(baselineTag(['v2.9.0', 'v2.10.0'], '3.0.0')).toBe('v2.10.0');
  });

  it('ignores later versions and other tags', () => {
    expect(baselineTag(['v3.0.0', 'v2.0.0-rc1', 'release', 'v2.0.0'], '2.5.0')).toBe('v2.0.0');
  });

  it('throws on a version that is not X.Y.Z', () => {
    expect(() => baselineTag([], '2.0')).toThrow(/not X\.Y\.Z/);
  });
});

describe('readBaseline', () => {
  it('reads a listing, and is null with none or with one that no longer parses', () => {
    expect(readBaseline(file(ENGLISH))).toEqual(ENGLISH);
    expect(readBaseline(null)).toBeNull();
    expect(readBaseline('# English')).toBeNull();
  });
});

describe('fieldStatuses', () => {
  it('pastes everything with no baseline', () => {
    expect(Object.values(ALL_PASTE)).toEqual(Array(6).fill('paste'));
  });

  it('skips a field the baseline already holds, and pastes a changed one', () => {
    const statuses = fieldStatuses({ ...ENGLISH, subtitle: 'New' }, ENGLISH, true);
    expect(statuses.subtitle).toBe('paste');
    expect(statuses.description).toBe('skip');
  });

  it("pastes What's new for every new version, and never between versions", () => {
    expect(fieldStatuses(ENGLISH, ENGLISH, true).whatsNew).toBe('paste');
    expect(fieldStatuses({ ...ENGLISH, whatsNew: 'Changed' }, ENGLISH, false).whatsNew).toBe(
      'skip',
    );
  });
});

describe('isReleaseBranch', () => {
  it('is true only for release/X.Y.Z', () => {
    expect(isReleaseBranch('release/2.0.0')).toBe(true);
    expect(isReleaseBranch('main')).toBe(false);
    expect(isReleaseBranch('release/2.0.0-fix')).toBe(false);
  });
});

describe('imageCopies', () => {
  const copies = imageCopies(['01-home', '05-study']);

  it("numbers each language's shots in order, per store, with its feature graphic", () => {
    expect(copies).toContainEqual({
      from: 'design/store/it/05-study.png',
      to: 'app-store/it/02.png',
    });
    expect(copies).toContainEqual({ from: 'design/play/es/01-home.jpg', to: 'play/es-ES/01.jpg' });
    expect(copies).toContainEqual({
      from: 'design/play/de/feature-graphic.jpg',
      to: 'play/de-DE/feature-graphic.jpg',
    });
  });

  it('hands over the icon once, last', () => {
    expect(copies).toHaveLength(5 * (2 * 2 + 1) + 1);
    expect(copies.at(-1)).toEqual({ from: 'design/play/icon-512.png', to: 'play/icon-512.png' });
  });
});

describe('pasteSheet', () => {
  const each = <T>(value: T) =>
    Object.fromEntries(LANGUAGES.map((language) => [language, value])) as Record<
      ListingLanguage,
      T
    >;
  const input: SheetInput = {
    version: '2.0.0',
    baseline: null,
    listings: each(ENGLISH),
    statuses: each(ALL_PASTE),
    images: 'paste',
    shotCount: 6,
    declarations: 'paste',
  };

  it('says what it compares with', () => {
    const sheet = pasteSheet(input);
    expect(sheet.startsWith('# Paste sheet: 2.0.0\n')).toBe(true);
    expect(sheet).toContain('No earlier version is tagged, so everything is **paste**.');
    expect(pasteSheet({ ...input, baseline: 'v1.0.0' })).toContain('Compared with v1.0.0');
  });

  it('gives each paste field a fenced block with its count, in console order', () => {
    const sheet = pasteSheet(input);
    expect(sheet).toContain(
      '#### Subtitle · paste · 26/30\n\n~~~~text\nLearn every football squad\n~~~~',
    );
    expect(sheet.indexOf('### it\n')).toBeLessThan(sheet.indexOf('## Google Play Console'));
    expect(sheet.indexOf('Short description')).toBeGreaterThan(
      sheet.indexOf('## Google Play Console'),
    );
    expect(sheet).toContain("#### What's New in This Version · paste");
    expect(sheet).toContain('#### Full description · paste');
  });

  it('gives a skipped field one line', () => {
    const statuses: Record<FieldId, Status> = { ...ALL_PASTE, subtitle: 'skip' };
    const sheet = pasteSheet({ ...input, statuses: each(statuses) });
    expect(sheet).toContain('- Subtitle: skip, unchanged');
    expect(sheet).not.toContain('#### Subtitle');
  });

  it("puts Play's release notes for every language in one block", () => {
    expect(pasteSheet(input)).toContain('<it-IT>\nPhotos of every player.\n</it-IT>');
  });

  it('lists the images only when they are entered', () => {
    const sheet = pasteSheet(input);
    expect(sheet).toContain('`app-store/en-US/01.png` to `06.png`');
    expect(sheet).toContain('`play/icon-512.png`');
    const elsewhere = pasteSheet({ ...input, images: 'release-only' });
    expect(elsewhere).toContain('come only from a release branch');
    expect(elsewhere).not.toContain('app-store/');
  });

  it('points at the declarations when they changed', () => {
    expect(pasteSheet(input)).toContain('`store/declarations.md`');
    expect(pasteSheet({ ...input, declarations: 'skip' })).toContain(
      '## Declarations: skip, unchanged',
    );
  });
});

describe('reviewSheet', () => {
  const onlyWhatsNew: Record<FieldId, Status> = {
    ...fieldStatuses(SPANISH, SPANISH, false),
    whatsNew: 'paste',
  };

  it('is null when nothing changed', () => {
    expect(
      reviewSheet('Español', SPANISH, ENGLISH, fieldStatuses(SPANISH, SPANISH, false), 'v2.0.0'),
    ).toBeNull();
  });

  it('holds only the changed fields, English first, with the count', () => {
    const sheet = reviewSheet('Español', SPANISH, ENGLISH, onlyWhatsNew, 'v2.0.0') ?? '';
    expect(sheet).toContain("## What's new (both, 500)");
    expect(sheet).toContain('English:\n\n> Photos of every player.');
    expect(sheet).toContain('Español, 22/500:\n\n> Fotos de cada jugador.');
    expect(sheet).not.toContain('Subtitle');
    expect(sheet).toContain('changed since v2.0.0');
  });

  it('quotes a text over several lines', () => {
    const sheet =
      reviewSheet('Español', SPANISH, ENGLISH, fieldStatuses(SPANISH, null, true), null) ?? '';
    expect(sheet).toContain('> Escuadra enseña una plantilla repitiendo.\n>\n> Una ronda');
    expect(sheet).toContain('this is the first listing');
  });
});
