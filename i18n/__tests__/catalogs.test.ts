// Every catalog against the English one (#145). The typecheck catches a
// missing or extra key; this catches what it cannot: a function that drops a
// trailing parameter, an array of a different length, keys in another order,
// and a text left in English.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../catalogs';
import { en } from '../en';
import { catalogLeaves, isLater } from '../leaves';
import { SUPPORTED_LANGUAGES, type Language } from '../resolveLanguage';

// Texts that are rightly the same as in English, by language, each with a
// comment saying why ("Name" is German too). Every other text must differ.
const SAME_AS_ENGLISH: Partial<Record<Exclude<Language, 'en'>, readonly string[]>> = {
  de: [
    // German players say "Level 2" too.
    'common.level',
    // MF is German's code too: Mittelfeld.
    'positionCodes.MF',
    // Name and Position are German words, spelled the same.
    'slots.NAME',
    'slots.POS',
    // The chip codes of those words, and NAT for Nationalität.
    'slotCodes.NAME',
    'slotCodes.POS',
    'slotCodes.NAT',
    // "{1}: {2}" has no words.
    'round.slotSpoken.given',
    // "Text" is the German word for a share as text.
    'share.text',
    // "Version {1}": German writes it the same.
    'about.version',
    // "Vibration" is the German word, and the setting's name on iOS and Android.
    'about.vibration',
    // "Software" is the German word too.
    'about.licences.software',
  ],
  fr: [
    // Club is the French word too, and CLUB its chip code.
    'slots.CLUB',
    'slotCodes.CLUB',
    // NAT for Nationalité.
    'slotCodes.NAT',
    // "Image" is the French word for a share as a picture.
    'share.image',
    // "Clubs" is French too.
    'picker.clubs',
    // "Version {1}": French writes it the same.
    'about.version',
    // "Licences" is the French word too.
    'about.licences.label',
  ],
  es: [
    // Club is the Spanish word too, and CLUB its chip code.
    'slots.CLUB',
    'slotCodes.CLUB',
    // POS for Posición.
    'slotCodes.POS',
    // "{1}: {2}" has no words.
    'round.slotSpoken.given',
    // "Software" is the word Spanish uses.
    'about.licences.software',
  ],
  it: [
    // Club is the Italian word too, and CLUB its chip code.
    'slots.CLUB',
    'slotCodes.CLUB',
    // "{1}: {2}" has no words.
    'round.slotSpoken.given',
    // "Home" is what Italian apps call the start screen.
    'picker.home',
    // "Privacy" is the Italian word, as in "informativa sulla privacy".
    'about.privacy.heading',
    // "Home", as the picker says: what Italian websites call the home page.
    'about.site.nav.home',
    // "Software" is the word Italian uses.
    'about.licences.software',
  ],
};

const english = catalogLeaves(en);
const englishText = new Map(english.map((leaf) => [leaf.path, leaf.text]));
const shape = (leaves: typeof english) => leaves.map(({ path, arity }) => ({ path, arity }));

// The English About governs; de/fr/es/it translate it (#146). When this
// fails, en.about changed: change each translation's `about` to match in the
// same PR, send them through review, then update the hash.
it('pins the English About the translations were made from', () => {
  const text = catalogLeaves(en)
    .filter((leaf) => leaf.path.startsWith('about.'))
    .map((leaf) => `${leaf.path}\t${leaf.text}`)
    .join('\n');
  expect(createHash('sha256').update(text).digest('hex').slice(0, 16)).toBe('7bc46f8b3b4c8b41');
});

describe.each(SUPPORTED_LANGUAGES)('the %s catalog', (language) => {
  const messages = CATALOGS[language];
  const leaves = catalogLeaves(messages);
  const allowed: readonly string[] = language === 'en' ? [] : (SAME_AS_ENGLISH[language] ?? []);

  it("has English's texts, in English's order, with the same parameters", () => {
    expect(shape(leaves)).toEqual(shape(english));
  });

  it('is empty exactly where English is', () => {
    const wrong = leaves.filter(
      (leaf) => (leaf.text === '') !== (englishText.get(leaf.path) === ''),
    );
    expect(wrong.map((leaf) => leaf.path)).toEqual([]);
  });

  it('prints exactly the placeholders English does, at every path', () => {
    const tokens = (text: string) => (text.match(/\{\d\}/g) ?? []).sort();
    const wrong = leaves.filter(
      (leaf) => tokens(leaf.text).join() !== tokens(englishText.get(leaf.path) ?? '').join(),
    );
    expect(wrong.map((leaf) => leaf.path)).toEqual([]);
  });

  // Placeholders survive a case change ("{1}".toLowerCase() is "{1}"), so this
  // calls each function with mixed-case values: a code like DEF or a club's
  // name must reach the screen exactly as given.
  it('prints every value it is given unchanged', () => {
    const wrong = leaves.filter((leaf) => {
      if (!leaf.call || leaf.path === 'formats.date' || leaf.path === 'formats.longDate') {
        return false;
      }
      const values = Array.from({ length: leaf.arity }, (_, i) => `Qx${i}`);
      const text = leaf.call(...values);
      return values.some((value) => !text.includes(value));
    });
    expect(wrong.map((leaf) => leaf.path)).toEqual([]);
  });

  it('names its own position codes in the level-2 description', () => {
    const description = messages.ladder.levels[2].description;
    for (const code of Object.values(messages.positionCodes)) {
      expect(description).toContain(code);
    }
  });

  it.skipIf(language === 'en')('translates every text it does not share on purpose', () => {
    const untranslated = leaves.filter(
      (leaf) =>
        !isLater(leaf.path, language) &&
        leaf.text !== '' &&
        leaf.text === englishText.get(leaf.path) &&
        !allowed.includes(leaf.path),
    );
    expect(untranslated.map((leaf) => leaf.path)).toEqual([]);
  });

  it.skipIf(language === 'en')('shares with English only texts that are still the same', () => {
    const text = new Map(leaves.map((leaf) => [leaf.path, leaf.text]));
    const stale = allowed.filter((p) => !englishText.has(p) || text.get(p) !== englishText.get(p));
    expect(stale).toEqual([]);
  });
});
