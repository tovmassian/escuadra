# i18n Translations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escuadra speaks Español, Français, Italiano and Deutsch. Each language joins `SUPPORTED_LANGUAGES` only after a native speaker signs it off (#145).

**Architecture:**

- **One groundwork PR** builds the checks every language must pass:
  - a parity test against `en.ts`;
  - length budgets as a test;
  - an "untranslated text" test;
  - translated slot labels on `SlotChip`;
  - a `--lang` flag for the screen capture;
  - a CLDR seed script for country names;
  - a review sheet for the native reviewer.
- **One PR per language** then follows the same procedure (Task 7): German first, because it runs longest, then French, Spanish and Italian. Each language PR adds that language to `SUPPORTED_LANGUAGES` on its branch, so its shots show the real app. The PR merges only after the reviewer signs off, so `main` never carries an unreviewed language.

**Tech Stack:** TypeScript 6 strict (`noUncheckedIndexedAccess`), Vitest 5 (node), Expo SDK 57 / React Native 0.86, Playwright (screen capture), Node 24 `Intl.DisplayNames` (authoring only).

**Spec:**

- Issue #145 is the work list.
- Issue #141 is the design reference: "Translation", "Text expansion", "Data stays English".
- Previous plans: `docs/superpowers/plans/2026-10-17-i18n-foundation.md` and `docs/superpowers/plans/2026-10-17-i18n-football-vocabulary.md`.
- No separate spec file: the issues are the spec.

**Delivery:** five PRs, opened only after the owner says so.

| PR  | Branch                        | Merges when                    |
| --- | ----------------------------- | ------------------------------ |
| 1   | `feat/145-i18n-groundwork`    | review, as usual               |
| 2   | `feat/145-i18n-de` (Deutsch)  | the German reviewer signs off  |
| 3   | `feat/145-i18n-fr` (Français) | the French reviewer signs off  |
| 4   | `feat/145-i18n-es` (Español)  | the Spanish reviewer signs off |
| 5   | `feat/145-i18n-it` (Italiano) | the Italian reviewer signs off |

PRs 2–5 each start from `main` after PR 1 has merged. They are independent of each other, so a slow review does not hold up another language.

## Global Constraints

- **Never translated:** _Escuadra_ and _a la escuadra_, from `i18n/names.ts`. Club names, player names, photo-credit authors and licence names are never translated either.
- **Data stays English.** Squad files, `Position` (`'GK' | 'DF' | 'MF' | 'FW'`), `SlotKey` and `lib/questionEngine.ts` are untouched. Translation happens by code at display time.
- **About, privacy and the store tagline stay English in this issue.** Each new catalog sets `about: en.about` and `store: en.store`, with a comment. #146 translates About and privacy, and #147 the tagline, because those texts are reviewed with their legal and listing copy.
- **Text expansion, in this order (#141):**
  1. Write to fit the budget.
  2. Body text, headings and button labels may wrap to two lines.
  3. Only data truncates (team and player names). UI copy is never truncated.
  4. On fixed canvases (`ShareCard`, position tiles, `SlotChip`), rewrite the copy until it fits.
- **Never** use `adjustsFontSizeToFit`, and never change a token's size to make one language fit. If copy cannot fit, that is a design question for the owner.
- **No `Intl` at runtime beyond `localeCompare`.** Plurals are hand-written in each catalog. Country names are committed data. `Intl.DisplayNames` runs only in the seed script, on Node.
- **Plurals:** es, it and de use singular for exactly 1. French uses singular for 0 and 1 (`n <= 1`).
- **Placement of names:** a team or country name comes from data, with no known gender, article or case. A sentence must never put a name where it needs an article, a contraction or a declension ("du Brésil", "dell'Italia", "des Kaders von …"). Put the name before a colon, or alone as an apposition.
- **French typography:** a no-break space (U+00A0) goes before `? ! : ;` and inside `« »`. Use U+00A0, not the narrow U+202F, because the shipped fonts were checked for U+00A0's role only.
- **Apostrophe:** French and Italian use `’` (U+2019).
- **Tests:** new `i18n/` tests go in `i18n/__tests__/`. New `scripts/` tests sit beside their code, like `scripts/screenshot-profiles.test.ts`.
- **TypeScript:** no `!`, no `any`. A cast needs a reason in a comment.
- **Tokens only** (guardrail 5). This plan adds no colour, size or spacing value.
- **Fingerprint:** no dependency, npm script, `app.json` or `.gitignore` change. `app.json` already declares all five locales (#142).
- **Verification:**
  - run `nvm use` first;
  - run `npx prettier --write` on every new or changed file before `npm run check`. The code blocks here are not guaranteed to be Prettier-exact, and `check` includes `format:check`;
  - `npm run check` passes before every commit;
  - the shots start their own server on 8082, so never stop the user's server on 8081.

## Decisions to confirm with the owner

1. **One PR per language, merged on sign-off.** A language's shots need it in `SUPPORTED_LANGUAGES`, but the gate says it joins only after review. Doing the work on the language's branch, and merging only after sign-off, satisfies both.
2. **About and the store tagline stay English** in the four catalogs until #146 and #147. Nothing ships before the 2.0.0 store build, and #146 lands before that. The English About text stays true (guardrail 7).
3. **The plan does not contain the finished translations.** The deliverable of Task 7 is the draft. The plan fixes everything that decides consistency:
   - the glossary (Task 7);
   - the per-language facts as a test (Task 1);
   - the rules above;
   - automated checks: parity, budgets, untranslated text, French spacing.
4. **Length budgets become a failing test** (`i18n/budgets.ts`), not just comments. The comments in `en.ts` stay, for translators, and a drift test keeps the two in step.
5. **Review shots use the Play profile, 360×640, in `design/play/<lang>/`.** That viewport is the acceptance criterion's, the folder is already gitignored, and it is the layout #147 asks for. `design/screens/` stays English, and `--lang` with the design profile is an error.
6. **The review sheet is written by a Vitest run** behind an environment variable (`REVIEW_SHEET=de`). Node alone cannot load the catalogs: they import `./names` without an extension, which Metro and Vitest resolve but Node's ESM loader does not.
7. **New slot-label budget: ≤ 6 characters** (`VEREIN`, `RUOLO`). English uses at most 4. The shots prove whether three chips still fit on one row. If they don't, the reviewer picks a shorter code.

## File map

| File                                               | Responsibility                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `i18n/catalogs.ts` (new)                           | `CATALOGS`, moved out of `useT.ts` so tests and tools can read it               |
| `i18n/leaves.ts` (new)                             | `catalogLeaves()`: a catalog flattened to path, text and parameter count        |
| `i18n/budgets.ts` (new)                            | `LENGTH_BUDGETS`: the `≤ N chars` comments as data                              |
| `i18n/en.ts`                                       | `slotCodes`, a budget on `positions`, header text                               |
| `i18n/useT.ts`                                     | Reads `CATALOGS` from `./catalogs`                                              |
| `i18n/__tests__/catalogs.test.ts` (new)            | Parity, empty texts, level-2 codes, untranslated texts                          |
| `i18n/__tests__/budgets.test.ts` (new)             | Every catalog fits every budget; the table matches `en.ts`'s comments           |
| `i18n/__tests__/translations.test.ts` (new)        | Per-language facts: date, plural, codes, hand-written countries, phone language |
| `i18n/__tests__/resolveLanguage.test.ts`           | The "English only" test becomes "unreviewed falls back to English"              |
| `i18n/__tests__/languageOptions.test.ts`           | The "just English" test becomes "each reviewed language"                        |
| `components/SlotChip.tsx`                          | Draws `t.slotCodes[slot.key]`                                                   |
| `components/SegmentedControl.tsx`                  | `testID` per segment                                                            |
| `components/AnswerTile.tsx`, `AnswerGrid.tsx`      | `testID` on position tiles                                                      |
| `scripts/screenshot-profiles.ts` (+ test)          | `resolveLanguageArg`, `outDirFor`                                               |
| `scripts/capture-screens.mjs`                      | `--lang`: seeds `languagePreference` and taps by `testID`                       |
| `scripts/seed-country-names.ts` (new)              | Prints one language's country table from CLDR plus hand-written names           |
| `scripts/i18n-review-sheet.ts` (+ test, new)       | The reviewer's side-by-side sheet; the test writes it on request                |
| `CLAUDE.md`                                        | The i18n bullet and the shots commands                                          |
| `i18n/{de,fr,es,it}.ts` (new, one per language PR) | The catalogs                                                                    |
| `i18n/countries.ts`                                | One table per language                                                          |
| `i18n/resolveLanguage.ts`                          | `SUPPORTED_LANGUAGES` grows by one per language PR                              |

---

### Task 1: catalogs as data, and the parity tests

**Files:**

- Create: `i18n/catalogs.ts`, `i18n/leaves.ts`, `i18n/__tests__/catalogs.test.ts`, `i18n/__tests__/translations.test.ts`
- Modify: `i18n/useT.ts`, `i18n/__tests__/resolveLanguage.test.ts:45-48`, `i18n/__tests__/languageOptions.test.ts:28-31`

**Interfaces:**

- Consumes:
  - `en`, `Messages` from `i18n/en.ts`;
  - `SUPPORTED_LANGUAGES`, `SupportedLanguage`, `Language`, `LANGUAGES`, `resolveLanguage` from `i18n/resolveLanguage.ts`;
  - `countryName` from `i18n/displayNames.ts`.
- Produces:
  - `CATALOGS: Record<SupportedLanguage, Messages>`;
  - `interface Leaf { path: string; text: string; arity: number; call?: (...args: unknown[]) => string }`;
  - `catalogLeaves(messages: Messages): Leaf[]`.

- [ ] **Step 1: Branch**

```bash
nvm use && git switch main && git pull --ff-only && git switch -c feat/145-i18n-groundwork
```

This plan was written on `main`, uncommitted. The branch carries it over, and it lands with PR 1.

- [ ] **Step 2: Write the failing parity test**

`i18n/__tests__/catalogs.test.ts`:

```ts
// Every catalog against the English one (#145). The typecheck catches a
// missing or extra key; this catches what it cannot: a function that drops a
// trailing parameter, an array of a different length, keys in another order,
// and a text left in English.
import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../catalogs';
import { en } from '../en';
import { catalogLeaves } from '../leaves';
import { SUPPORTED_LANGUAGES, type Language } from '../resolveLanguage';

// Texts that are rightly the same as in English, by language, each with a
// comment saying why ("Name" is German too). Every other text must differ.
const SAME_AS_ENGLISH: Partial<Record<Exclude<Language, 'en'>, readonly string[]>> = {};

/** Translated by #146 (About and privacy) and #147 (store listing), not #145. */
const LATER = ['about.', 'store.'];

const english = catalogLeaves(en);
const englishText = new Map(english.map((leaf) => [leaf.path, leaf.text]));
const shape = (leaves: typeof english) => leaves.map(({ path, arity }) => ({ path, arity }));

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

  it('names its own position codes in the level-2 description', () => {
    const description = messages.ladder.levels[2].description;
    for (const code of Object.values(messages.positionCodes)) {
      expect(description).toContain(code);
    }
  });

  it.skipIf(language === 'en')('translates every text it does not share on purpose', () => {
    const untranslated = leaves.filter(
      (leaf) =>
        !LATER.some((prefix) => leaf.path.startsWith(prefix)) &&
        leaf.text !== '' &&
        leaf.text === englishText.get(leaf.path) &&
        !allowed.includes(leaf.path),
    );
    expect(untranslated.map((leaf) => leaf.path)).toEqual([]);
  });

  it.skipIf(language === 'en')('shares with English only texts that are still the same', () => {
    const text = new Map(leaves.map((leaf) => [leaf.path, leaf.text]));
    const stale = allowed.filter((path) => text.get(path) !== englishText.get(path));
    expect(stale).toEqual([]);
  });
});
```

- [ ] **Step 3: Write the failing per-language facts test**

These are the glossary's checkable facts for all five languages. Only supported languages run, so the four drafts wait here until their PR adds them. A reviewer's change to any of these values changes this table in the same commit.

`i18n/__tests__/translations.test.ts`:

```ts
// What each language must say, written down before its catalog exists (#145).
// Only supported languages run, so a language's facts wait here until its PR
// adds it. A native reviewer's correction changes the table in the same commit.
import { describe, expect, it } from 'vitest';
import type { FlagCode } from '@/assets/flags/generated';
import type { Position } from '@/types/squad';
import { CATALOGS } from '../catalogs';
import { countryName } from '../displayNames';
import { catalogLeaves } from '../leaves';
import { resolveLanguage, SUPPORTED_LANGUAGES, type Language } from '../resolveLanguage';

interface Facts {
  /** `formats.date` for 21 August 2026. */
  date: string;
  /** `study.players` for 0, 1 and 2. French treats 0 as singular. */
  players: readonly [string, string, string];
  positionCodes: Readonly<Record<Position, string>>;
  /** The hand-written names (the four home nations, FIFA-style ones) and the language's own country. */
  countries: Readonly<Partial<Record<FlagCode, string>>>;
  /** A phone set to this tag resolves to the language on first launch. */
  phoneTag: string;
  /** A no-break space before ? ! : ; and inside « ». */
  frenchSpacing: boolean;
}

const FACTS: Record<Language, Facts> = {
  en: {
    date: '21 Aug 2026',
    players: ['0 players', '1 player', '2 players'],
    positionCodes: { GK: 'GK', DF: 'DF', MF: 'MF', FW: 'FW' },
    countries: { ENG: 'England', ESP: 'Spain' },
    phoneTag: 'en-GB',
    frenchSpacing: false,
  },
  de: {
    date: '21. Aug. 2026',
    players: ['0 Spieler', '1 Spieler', '2 Spieler'],
    positionCodes: { GK: 'TW', DF: 'AB', MF: 'MF', FW: 'ST' },
    countries: {
      GER: 'Deutschland',
      ENG: 'England',
      SCO: 'Schottland',
      WAL: 'Wales',
      NIR: 'Nordirland',
      CIV: 'Elfenbeinküste',
      COD: 'DR Kongo',
      CGO: 'Kongo',
      CPV: 'Kap Verde',
      USA: 'USA',
    },
    phoneTag: 'de-AT',
    frenchSpacing: false,
  },
  fr: {
    date: '21 août 2026',
    players: ['0 joueur', '1 joueur', '2 joueurs'],
    positionCodes: { GK: 'GB', DF: 'DÉF', MF: 'MIL', FW: 'ATT' },
    countries: {
      FRA: 'France',
      ENG: 'Angleterre',
      SCO: 'Écosse',
      WAL: 'Pays de Galles',
      NIR: 'Irlande du Nord',
      COD: 'RD Congo',
      CGO: 'Congo',
    },
    phoneTag: 'fr-CA',
    frenchSpacing: true,
  },
  es: {
    date: '21 ago 2026',
    players: ['0 jugadores', '1 jugador', '2 jugadores'],
    positionCodes: { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' },
    countries: {
      ESP: 'España',
      ENG: 'Inglaterra',
      SCO: 'Escocia',
      WAL: 'Gales',
      NIR: 'Irlanda del Norte',
      CIV: 'Costa de Marfil',
      COD: 'RD Congo',
    },
    phoneTag: 'es-MX',
    frenchSpacing: false,
  },
  it: {
    date: '21 ago 2026',
    players: ['0 giocatori', '1 giocatore', '2 giocatori'],
    positionCodes: { GK: 'POR', DF: 'DIF', MF: 'CEN', FW: 'ATT' },
    countries: {
      ITA: 'Italia',
      ENG: 'Inghilterra',
      SCO: 'Scozia',
      WAL: 'Galles',
      NIR: 'Irlanda del Nord',
      COD: 'RD del Congo',
      CGO: 'Congo',
    },
    phoneTag: 'it-CH',
    frenchSpacing: false,
  },
};

/** Translated by #146 and #147, so not held to this issue's rules. */
const LATER = ['about.', 'store.'];

describe.each(SUPPORTED_LANGUAGES)('%s', (language) => {
  const facts = FACTS[language];
  const messages = CATALOGS[language];

  it('writes the date its own way', () => {
    expect(messages.formats.date({ day: 21, month: 8, year: 2026 })).toBe(facts.date);
  });

  it('writes its own singular and plural', () => {
    expect([0, 1, 2].map((n) => messages.study.players(n))).toEqual(facts.players);
  });

  it('uses the position codes its fans use', () => {
    expect(messages.positionCodes).toEqual(facts.positionCodes);
  });

  it('names the hand-written countries as decided', () => {
    for (const [code, name] of Object.entries(facts.countries)) {
      // Object.entries widens the key to string; the keys come from a
      // Partial<Record<FlagCode, string>>, so each is a FlagCode.
      expect(countryName(code as FlagCode, language)).toBe(name);
    }
  });

  it('is what a phone set to it opens in, on first launch', () => {
    expect(resolveLanguage('system', [facts.phoneTag, 'en-US'], SUPPORTED_LANGUAGES)).toBe(
      language,
    );
  });

  it.runIf(facts.frenchSpacing)('puts a no-break space before ? ! : ; and inside « »', () => {
    const wrong = catalogLeaves(messages).filter(
      (leaf) =>
        !LATER.some((prefix) => leaf.path.startsWith(prefix)) &&
        (/[^\u00a0][?!:;»]/.test(leaf.text) || /«[^\u00a0]/.test(leaf.text)),
    );
    expect(wrong.map((leaf) => `${leaf.path}: ${leaf.text}`)).toEqual([]);
  });
});
```

- [ ] **Step 4: Run both and watch them fail**

Run: `npx vitest run i18n/__tests__/catalogs.test.ts i18n/__tests__/translations.test.ts`
Expected: FAIL, "Failed to resolve import ../catalogs" and "../leaves".

- [ ] **Step 5: Write `i18n/catalogs.ts`**

```ts
// Every reviewed catalog, by language (#145). React-free, so the catalog tests
// and the review sheet read the same table the app does. ./useT.ts picks one.
import { en, type Messages } from './en';
import type { SupportedLanguage } from './resolveLanguage';

/** Adding a language to `SUPPORTED_LANGUAGES` without its catalog fails the typecheck. */
export const CATALOGS: Record<SupportedLanguage, Messages> = { en };
```

- [ ] **Step 6: Write `i18n/leaves.ts`**

```ts
// A catalog flattened to its texts (#145), for the catalog tests and the
// review sheet. A function is called with placeholders ("{1}", "{2}"…), so
// "Who wears {1}?" shows where its value goes. React-free.
import type { Messages } from './en';

export interface Leaf {
  /** "round.whoWears", "ladder.levels.2.title", "about.intro.0". */
  path: string;
  /** The text, or a function's text with "{1}"… in place of its arguments. */
  text: string;
  /** A function's parameter count; 0 for a plain string. */
  arity: number;
  /** A function's own call, for the review sheet's singular and zero forms. */
  call?: (...args: unknown[]) => string;
}

const PLACEHOLDERS = ['{1}', '{2}', '{3}', '{4}', '{5}'];

/** Functions whose argument is not a value to write into the text. */
const SAMPLE_ARGS: Readonly<Record<string, readonly unknown[]>> = {
  'formats.date': [{ day: 21, month: 8, year: 2026 }],
};

export function catalogLeaves(messages: Messages): Leaf[] {
  const leaves: Leaf[] = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      leaves.push({ path, text: value, arity: 0 });
    } else if (typeof value === 'function') {
      // A catalog function takes values and returns a string; `Function` has
      // no call signature this file can use without saying so.
      const fn = value as (...args: unknown[]) => unknown;
      const call = (...args: unknown[]) => String(fn(...args));
      const args = SAMPLE_ARGS[path] ?? PLACEHOLDERS.slice(0, fn.length);
      leaves.push({ path, text: call(...args), arity: fn.length, call });
    } else if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        walk(child, path === '' ? key : `${path}.${key}`);
      }
    }
  };
  walk(messages, '');
  return leaves;
}
```

- [ ] **Step 7: Point `useT.ts` at it**

In `i18n/useT.ts`, replace

```ts
import { en, type Messages } from './en';
import { resolveLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from './resolveLanguage';

/** One catalog per supported language: adding a language to
 *  `SUPPORTED_LANGUAGES` without its catalog fails the typecheck. */
const CATALOGS: Record<SupportedLanguage, Messages> = { en };
```

with

```ts
import { CATALOGS } from './catalogs';
import type { Messages } from './en';
import { resolveLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from './resolveLanguage';
```

- [ ] **Step 8: Replace the two "English only" tests**

They pin `SUPPORTED_LANGUAGES` to `['en']` and would fail on every language PR.

In `i18n/__tests__/resolveLanguage.test.ts`, replace

```ts
it('ships English only until #145 adds a reviewed language', () => {
  expect(SUPPORTED_LANGUAGES).toEqual(['en']);
  expect(resolveLanguage('system', ['es-MX'], SUPPORTED_LANGUAGES)).toBe('en');
});
```

with

```ts
it('opens a language not yet reviewed in English (#145)', () => {
  const supported: readonly Language[] = SUPPORTED_LANGUAGES;
  for (const language of LANGUAGES.filter((l) => !supported.includes(l))) {
    expect(resolveLanguage('system', [`${language}-XX`], SUPPORTED_LANGUAGES)).toBe('en');
  }
});
```

and add `type Language` to that file's import from `'../resolveLanguage'`.

In `i18n/__tests__/languageOptions.test.ts`, replace

```ts
it('offers just English while English is the only reviewed catalog', () => {
  const rows = languageRows(SUPPORTED_LANGUAGES, 'en');
  expect(rows.map((row) => row.preference)).toEqual(['system', 'en']);
});
```

with

```ts
it('offers "Match phone", then each reviewed language and no other', () => {
  const [first, ...rest] = languageRows(SUPPORTED_LANGUAGES, 'en');
  expect(first?.preference).toBe('system');
  expect(rest.map((row) => row.preference).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
});
```

- [ ] **Step 9: Run the i18n tests**

Run: `npx vitest run i18n`
Expected: PASS. Only `en` runs in the two new files. The `skipIf`/`runIf` tests show as skipped.

- [ ] **Step 10: Typecheck, lint, commit**

```bash
npm run typecheck && npm run lint
git add i18n docs/superpowers/plans/2026-10-18-i18n-translations.md
git commit -m "test(i18n): catalog parity and per-language facts (#145)"
```

---

### Task 2: slot labels, and length budgets as a test

**Files:**

- Create: `i18n/budgets.ts`, `i18n/__tests__/budgets.test.ts`
- Modify: `i18n/en.ts:72-75`, `components/SlotChip.tsx:103`

**Interfaces:**

- Consumes: `Messages` from `i18n/en.ts`; `CATALOGS` (Task 1); `LANGUAGE_NAMES` from `i18n/names.ts`.
- Produces:
  - `en.slotCodes: Record<SlotKey, string>`, with keys `NAME POS AGE CLUB NAT`;
  - `interface LengthBudget { budget: number; texts: Readonly<Record<string, (m: Messages) => string>> }`;
  - `LENGTH_BUDGETS: readonly LengthBudget[]`. A `texts` key is a catalog path, optionally followed by ` (sample)`. The review sheet strips that suffix.

- [ ] **Step 1: Write the failing budget test**

`i18n/__tests__/budgets.test.ts`:

```ts
// The length budgets (#141, Text expansion) as a test: every catalog's short
// labels fit the characters their space holds. i18n/en.ts carries the same
// budgets as comments for translators; the first test keeps the two in step.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LENGTH_BUDGETS } from '../budgets';
import { CATALOGS } from '../catalogs';
import { SUPPORTED_LANGUAGES } from '../resolveLanguage';

const source = readFileSync(path.join(process.cwd(), 'i18n/en.ts'), 'utf8');

describe('LENGTH_BUDGETS', () => {
  it('has one group per "≤ N chars" comment in en.ts, in the same order', () => {
    const commented = [...source.matchAll(/≤ (\d+) chars/g)].map((match) => Number(match[1]));
    expect(LENGTH_BUDGETS.map((group) => group.budget)).toEqual(commented);
  });

  it.each(SUPPORTED_LANGUAGES)('%s fits every budget', (language) => {
    const over = LENGTH_BUDGETS.flatMap(({ budget, texts }) =>
      Object.entries(texts)
        .map(([name, text]) => ({ name, budget, text: text(CATALOGS[language]) }))
        // Characters as a reader counts them: "É" is one, whatever its encoding.
        .filter(({ text }) => [...text.normalize('NFC')].length > budget),
    );
    expect(over).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run i18n/__tests__/budgets.test.ts`
Expected: FAIL, "Failed to resolve import ../budgets".

- [ ] **Step 3: Add `slotCodes` and a budget for `positions` in `en.ts`**

Replace

```ts
  /** The word under a position tile's code, and in Study's spoken label. */
  positions: { GK: 'Keeper', DF: 'Defender', MF: 'Midfield', FW: 'Forward' },
  /** Slot names, spoken before a slot's value. */
  slots: { NAME: 'Name', POS: 'Position', AGE: 'Age', CLUB: 'Club', NAT: 'Nationality' },
```

with

```ts
  /** ≤ 11 chars: the word under a position tile's code, and in Study's spoken label. */
  positions: { GK: 'Keeper', DF: 'Defender', MF: 'Midfield', FW: 'Forward' },
  /** Slot names, spoken before a slot's value. */
  slots: { NAME: 'Name', POS: 'Position', AGE: 'Age', CLUB: 'Club', NAT: 'Nationality' },
  /** ≤ 6 chars: a slot chip's label above its value, in capitals. */
  slotCodes: { NAME: 'NAME', POS: 'POS', AGE: 'AGE', CLUB: 'CLUB', NAT: 'NAT' },
```

- [ ] **Step 4: Draw it on the chip**

In `components/SlotChip.tsx`, replace

```tsx
<Text style={styles.label}>{slot.key}</Text>
```

with

```tsx
<Text style={styles.label}>{t.slotCodes[slot.key]}</Text>
```

`t` is already in scope (it feeds `slotValueText`).

- [ ] **Step 5: Write `i18n/budgets.ts`**

One group per `≤ N chars` comment in `en.ts`, in file order. A function is measured at its longest realistic call: two-digit scores, level 3, the longest language name.

```ts
// The `≤ N chars` comments in ./en.ts as data (#141, Text expansion), so
// i18n/__tests__/budgets.test.ts can hold every catalog to them. One group per
// comment, in file order; the test fails if the two drift. A function is
// measured at its longest realistic call. A key is the catalog path, with the
// sample in brackets when one path is measured twice.
import type { Messages } from './en';
import { LANGUAGE_NAMES } from './names';

export interface LengthBudget {
  budget: number;
  texts: Readonly<Record<string, (m: Messages) => string>>;
}

/** "Match phone · Italiano": the longest name the row can show. */
const LONGEST_LANGUAGE_NAME = Object.values(LANGUAGE_NAMES).reduce((a, b) =>
  b.length > a.length ? b : a,
);

export const LENGTH_BUDGETS: readonly LengthBudget[] = [
  { budget: 8, texts: { 'common.back': (m) => m.common.back } },
  { budget: 8, texts: { 'home.aboutLink': (m) => m.home.aboutLink } },
  { budget: 24, texts: { 'home.continueMeta': (m) => m.home.continueMeta(3, 10, 10) } },
  { budget: 18, texts: { 'home.startTraining': (m) => m.home.startTraining } },
  { budget: 20, texts: { 'home.browseAllTeams': (m) => m.home.browseAllTeams } },
  { budget: 16, texts: { 'languageSheet.title': (m) => m.languageSheet.title } },
  {
    budget: 28,
    texts: { 'languageSheet.matchPhone': (m) => m.languageSheet.matchPhone(LONGEST_LANGUAGE_NAME) },
  },
  {
    budget: 3,
    texts: {
      'positionCodes.GK': (m) => m.positionCodes.GK,
      'positionCodes.DF': (m) => m.positionCodes.DF,
      'positionCodes.MF': (m) => m.positionCodes.MF,
      'positionCodes.FW': (m) => m.positionCodes.FW,
    },
  },
  {
    budget: 11,
    texts: {
      'positions.GK': (m) => m.positions.GK,
      'positions.DF': (m) => m.positions.DF,
      'positions.MF': (m) => m.positions.MF,
      'positions.FW': (m) => m.positions.FW,
    },
  },
  {
    budget: 6,
    texts: {
      'slotCodes.NAME': (m) => m.slotCodes.NAME,
      'slotCodes.POS': (m) => m.slotCodes.POS,
      'slotCodes.AGE': (m) => m.slotCodes.AGE,
      'slotCodes.CLUB': (m) => m.slotCodes.CLUB,
      'slotCodes.NAT': (m) => m.slotCodes.NAT,
    },
  },
  { budget: 12, texts: { 'round.correct': (m) => m.round.correct } },
  { budget: 12, texts: { 'round.missed': (m) => m.round.missed } },
  { budget: 14, texts: { 'round.seeResults': (m) => m.round.seeResults } },
  { budget: 8, texts: { 'round.next': (m) => m.round.next } },
  { budget: 18, texts: { 'round.nextQuestion': (m) => m.round.nextQuestion } },
  { budget: 18, texts: { 'round.gotItNext': (m) => m.round.gotItNext } },
  {
    budget: 26,
    texts: {
      'round.tapToSkip (next)': (m) => m.round.tapToSkip(m.round.next),
      'round.tapToSkip (seeResults)': (m) => m.round.tapToSkip(m.round.seeResults),
    },
  },
  { budget: 20, texts: { 'round.tapYourAnswer': (m) => m.round.tapYourAnswer } },
  { budget: 8, texts: { 'round.answerTag': (m) => m.round.answerTag } },
  {
    budget: 12,
    texts: {
      'study.hideNames': (m) => m.study.hideNames,
      'study.showNames': (m) => m.study.showNames,
    },
  },
  { budget: 6, texts: { 'study.all': (m) => m.study.all } },
  { budget: 14, texts: { 'study.tapToReveal': (m) => m.study.tapToReveal } },
  { budget: 8, texts: { 'credits.photo': (m) => m.credits.photo } },
  { budget: 20, texts: { 'credits.button': (m) => m.credits.button(10) } },
  { budget: 22, texts: { 'results.studySquad': (m) => m.results.studySquad } },
  { budget: 22, texts: { 'results.retry': (m) => m.results.retry } },
  { budget: 22, texts: { 'results.playLevel': (m) => m.results.playLevel(3) } },
  { budget: 22, texts: { 'results.chooseTeam': (m) => m.results.chooseTeam } },
  {
    budget: 24,
    texts: {
      'results.missedCount (1)': (m) => m.results.missedCount(1),
      'results.missedCount (10)': (m) => m.results.missedCount(10),
    },
  },
  { budget: 14, texts: { 'results.swipeForAll': (m) => m.results.swipeForAll } },
  { budget: 24, texts: { 'results.nothingMissed': (m) => m.results.nothingMissed(10) } },
  { budget: 8, texts: { 'share.image': (m) => m.share.image, 'share.text': (m) => m.share.text } },
  { budget: 10, texts: { 'share.preview': (m) => m.share.preview } },
  {
    budget: 16,
    texts: {
      'share.shareImage': (m) => m.share.shareImage,
      'share.shareText': (m) => m.share.shareText,
    },
  },
  { budget: 14, texts: { 'ladder.play': (m) => m.ladder.play } },
  { budget: 14, texts: { 'ladder.playAgain': (m) => m.ladder.playAgain } },
  {
    budget: 18,
    texts: {
      'ladder.levels.1.title': (m) => m.ladder.levels[1].title,
      'ladder.levels.2.title': (m) => m.ladder.levels[2].title,
      'ladder.levels.3.title': (m) => m.ladder.levels[3].title,
    },
  },
  { budget: 20, texts: { 'ladder.studySquad': (m) => m.ladder.studySquad } },
  { budget: 12, texts: { 'ladder.best': (m) => m.ladder.best(10, 10) } },
  { budget: 6, texts: { 'picker.allLeagues': (m) => m.picker.allLeagues } },
  { budget: 8, texts: { 'picker.home': (m) => m.picker.home } },
  {
    budget: 14,
    texts: {
      'picker.clubs': (m) => m.picker.clubs,
      'picker.nationalTeams': (m) => m.picker.nationalTeams,
    },
  },
];
```

- [ ] **Step 6: Run the budget and catalog tests**

Run: `npx vitest run i18n`
Expected: PASS: 42 groups, matching 42 comments, and English fits them all.

If the drift test fails, compare the two arrays it prints. A comment and a group are out of order or missing. Fix the table, not the comments.

- [ ] **Step 7: Check, then commit**

Run: `npm run check`
Expected: exit 0.

```bash
git add i18n components/SlotChip.tsx
git commit -m "feat(i18n): slot labels in the catalog, length budgets as a test (#145)"
```

---

### Task 3: shots in one language

**Files:**

- Modify:
  - `scripts/screenshot-profiles.ts`, `scripts/screenshot-profiles.test.ts`;
  - `scripts/capture-screens.mjs`;
  - `components/SegmentedControl.tsx`, `components/AnswerTile.tsx`, `components/AnswerGrid.tsx`.

**Interfaces:**

- Consumes: nothing from `i18n/`. Importing a `.ts` file from there makes every `npm run shots*` print Node's MODULE_TYPELESS_PACKAGE_JSON warning (the root `package.json` has no "type" and is fingerprint-locked), so `resolveLanguageArg` checks only the shape of the code.
- Produces:
  - `resolveLanguageArg(argv: readonly string[]): string | null`;
  - `outDirFor(profile: Profile, language: string | null): string`;
  - testIDs `segment-<key>` (e.g. `segment-nation`) and `answer-position-<GK|DF|MF|FW>`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/screenshot-profiles.test.ts`, and add `outDirFor` and `resolveLanguageArg` to its import:

```ts
describe('resolveLanguageArg', () => {
  it('is null with no flag: the app picks its own language', () => {
    expect(resolveLanguageArg(['--profile=play'])).toBeNull();
  });

  it('reads a supported language', () => {
    expect(resolveLanguageArg(['--profile=play', '--lang=en'])).toBe('en');
  });

  it('throws on a code that is not two lowercase letters', () => {
    for (const code of ['xx1', 'DE', 'deu', '']) {
      expect(() => resolveLanguageArg([`--lang=${code}`])).toThrow(
        `unknown --lang "${code}": pass a two-letter language code`,
      );
    }
  });

  it('throws on a bare --lang token instead of ignoring it', () => {
    expect(() => resolveLanguageArg(['--lang', 'de'])).toThrow(/--lang=<code>/);
  });
});

describe('outDirFor', () => {
  it("is the profile's folder with no language", () => {
    expect(outDirFor(PROFILES.play, null)).toBe('design/play');
  });

  it("is a language's subfolder with one", () => {
    expect(outDirFor(PROFILES.play, 'en')).toBe('design/play/en');
    expect(outDirFor(PROFILES.store, 'en')).toBe('design/store/en');
  });

  it('keeps design/screens/ English: the design profile refuses a language', () => {
    expect(() => outDirFor(PROFILES.design, 'en')).toThrow(/design\/screens\/ stays English/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/screenshot-profiles.test.ts`
Expected: FAIL, "resolveLanguageArg is not a function" (or not exported).

- [ ] **Step 3: Implement both in `scripts/screenshot-profiles.ts`**

Add no import. Append:

```ts
/**
 * Reads `--lang=<code>` (#145): the language to capture in, or null to leave
 * the app's own. It checks only that the code is two letters. A language
 * without a reviewed catalog is rejected by capture-screens.mjs instead: its
 * Home-chip assertion throws when the chip does not show the requested code.
 */
export function resolveLanguageArg(argv: readonly string[]): string | null {
  if (argv.includes('--lang')) {
    throw new Error('pass the language as --lang=<code> (a single token), not a separate argument');
  }
  const flag = argv.find((arg) => arg.startsWith('--lang='));
  if (!flag) return null;
  const code = flag.slice('--lang='.length);
  if (!/^[a-z]{2}$/.test(code)) {
    throw new Error(`unknown --lang "${code}": pass a two-letter language code`);
  }
  return code;
}

/**
 * Where a run writes: the profile's folder, or its `<lang>/` subfolder.
 * design/screens/ is the English handoff set (#147), so a language goes to the
 * play or store profile instead.
 */
export function outDirFor(profile: Profile, language: string | null): string {
  if (language === null) return profile.outDir;
  if (profile.name === 'design') {
    throw new Error(
      'design/screens/ stays English: capture a language with --profile=play (or store)',
    );
  }
  return `${profile.outDir}/${language}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/screenshot-profiles.test.ts`
Expected: PASS.

- [ ] **Step 5: Give the capture's taps testIDs**

The capture taps two controls by their English text. Both need an ID instead.

`components/SegmentedControl.tsx`: on the segment's `Pressable`, after `key={s.key}`, add

```tsx
            testID={`segment-${s.key}`}
```

`components/AnswerTile.tsx`: add to `AnswerTileProps`

```ts
  /** For the screen capture, which taps a position tile by its code, not its translated label. */
  testID?: string;
```

Destructure `testID` in the component's parameter list, and pass `testID={testID}` on its `Pressable`.

`components/AnswerGrid.tsx`:

- Add `testID: string | undefined;` to `TileModel`.
- In the position branch, add `testID: \`answer-position-${option}\`,`.
- In the other branch, add `testID: undefined,`.
- Pass `testID={tile.testID}` to `<AnswerTile … />`.

- [ ] **Step 6: Wire `--lang` into `scripts/capture-screens.mjs`**

1. Extend the import from `./screenshot-profiles.ts` with `outDirFor` and `resolveLanguageArg`.

2. After `const PROFILE = …`, add:

```js
// `--lang=de` (#145) captures in one language, into `<profile dir>/de/`. The
// app reads `languagePreference` from its persisted store, so each page seeds
// it before the app loads; without the flag the app follows the browser.
const LANGUAGE = resolveLanguageArg(process.argv.slice(2));
const OUT_DIR = outDirFor(PROFILE, LANGUAGE);
```

3. Replace both `PROFILE.outDir` uses (in `shoot` and in the `mkdir` call) with `OUT_DIR`.

4. In `openCapture`, after the `page.on('pageerror', …)` block, add:

```js
if (LANGUAGE) {
  // Merged into whatever the store already holds, so a best score written
  // by an earlier round on this page survives the next navigation.
  await page.addInitScript((language) => {
    const key = 'escuadra-progress';
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      stored = null;
    }
    const next = stored ?? { state: {}, version: 0 };
    next.state = { ...next.state, languagePreference: language };
    localStorage.setItem(key, JSON.stringify(next));
  }, LANGUAGE);
}
```

5. In `captureTheme`, after `await capture.open('/');`, add:

```js
if (LANGUAGE) {
  const chip = await capture.page.getByTestId('language-chip').innerText();
  if (chip.trim() !== LANGUAGE.toUpperCase()) {
    throw new Error(`--lang=${LANGUAGE}: Home's language chip says "${chip}"`);
  }
}
```

6. Replace

```js
await capture.tap('National Teams', { exact: false, wait: SWAP_MS });
```

with

```js
await capture.tapId('segment-nation', { wait: SWAP_MS });
```

7. In `captureLevel3ThirdPart`, replace `await capture.tap(shot.position);` with

```js
await capture.tapId(`answer-position-${shot.position}`);
```

Update the `L3_THIRD_PART_SHOTS` comment: `position` is now the position's data code, tapped by `testID`.

- [ ] **Step 7: Prove English is unchanged**

Run: `npm run shots`
Expected: completes with no "page error". `git status --short design/screens` shows nothing: the testIDs render nothing.

Run: `npm run shots:play -- --lang=en`
Expected: completes. `ls design/play/en` lists the shots. Open `01-home.jpg` and confirm the chip says `EN`.

- [ ] **Step 8: Check, then commit**

Run: `npm run check`
Expected: exit 0.

```bash
git add scripts components
git commit -m "feat(shots): capture in one language with --lang, tapping by testID (#145)"
```

---

### Task 4: the country-name seed

**Files:**

- Create: `scripts/seed-country-names.ts`

**Interfaces:**

- Consumes: `FlagCode` (type) from `assets/flags/generated.ts` and `Language` (type) from `i18n/resolveLanguage.ts`, both erased by Node. It imports nothing else at run time: the codes are `ISO_REGION`'s keys plus the `HOME_NATIONS` const.
- Produces: `node scripts/seed-country-names.ts <es|fr|it|de>` prints the body of a `COUNTRY_NAMES` entry to stdout.

- [ ] **Step 1: Write the script**

`scripts/seed-country-names.ts`:

```ts
// Seeds one language's country names for i18n/countries.ts (#145): CLDR's
// names through Node's Intl.DisplayNames, with the hand-written ones laid
// over them. Run it once per language and paste the output into
// COUNTRY_NAMES. From then on the committed table is the truth, and a
// reviewer's change goes there. The app never calls Intl for names (#141):
// Hermes may not carry the data.
//
//   node scripts/seed-country-names.ts de
import type { FlagCode } from '../assets/flags/generated.ts';
import type { Language } from '../i18n/resolveLanguage.ts';

/** FIFA members that are not ISO countries, so CLDR has no name for them. */
const HOME_NATIONS = ['ENG', 'SCO', 'WAL', 'NIR'] as const;
type HomeNation = (typeof HOME_NATIONS)[number];
type SeedLanguage = Exclude<Language, 'en'>;

/** FIFA code → ISO 3166-1 alpha-2 region, the key CLDR names countries by. Kosovo is CLDR's XK. */
const ISO_REGION: Record<Exclude<FlagCode, HomeNation>, string> = {
  ALB: 'AL',
  ALG: 'DZ',
  ANG: 'AO',
  ARG: 'AR',
  ARM: 'AM',
  AUS: 'AU',
  AUT: 'AT',
  BDI: 'BI',
  BEL: 'BE',
  BEN: 'BJ',
  BFA: 'BF',
  BIH: 'BA',
  BRA: 'BR',
  BUL: 'BG',
  CAN: 'CA',
  CGO: 'CG',
  CHI: 'CL',
  CHN: 'CN',
  CIV: 'CI',
  CMR: 'CM',
  COD: 'CD',
  COL: 'CO',
  COM: 'KM',
  CPV: 'CV',
  CRC: 'CR',
  CRO: 'HR',
  CTA: 'CF',
  CYP: 'CY',
  CZE: 'CZ',
  DEN: 'DK',
  DOM: 'DO',
  ECU: 'EC',
  EGY: 'EG',
  EQG: 'GQ',
  ESP: 'ES',
  EST: 'EE',
  FIN: 'FI',
  FRA: 'FR',
  FRO: 'FO',
  GAB: 'GA',
  GAM: 'GM',
  GEO: 'GE',
  GER: 'DE',
  GHA: 'GH',
  GLP: 'GP',
  GNB: 'GW',
  GRE: 'GR',
  GUI: 'GN',
  HAI: 'HT',
  HUN: 'HU',
  IDN: 'ID',
  IRL: 'IE',
  IRN: 'IR',
  ISL: 'IS',
  ISR: 'IL',
  ITA: 'IT',
  JAM: 'JM',
  JOR: 'JO',
  JPN: 'JP',
  KAZ: 'KZ',
  KEN: 'KE',
  KOR: 'KR',
  KOS: 'XK',
  KSA: 'SA',
  LTU: 'LT',
  LUX: 'LU',
  MAR: 'MA',
  MEX: 'MX',
  MKD: 'MK',
  MLI: 'ML',
  MNE: 'ME',
  MOZ: 'MZ',
  MTN: 'MR',
  NED: 'NL',
  NGA: 'NG',
  NIG: 'NE',
  NOR: 'NO',
  NZL: 'NZ',
  PAN: 'PA',
  PAR: 'PY',
  PER: 'PE',
  POL: 'PL',
  POR: 'PT',
  ROU: 'RO',
  RUS: 'RU',
  SEN: 'SN',
  SLE: 'SL',
  SRB: 'RS',
  SUI: 'CH',
  SUR: 'SR',
  SVK: 'SK',
  SVN: 'SI',
  SWE: 'SE',
  TAN: 'TZ',
  TOG: 'TG',
  TUN: 'TN',
  TUR: 'TR',
  UKR: 'UA',
  URU: 'UY',
  USA: 'US',
  UZB: 'UZ',
  VEN: 'VE',
  ZAM: 'ZM',
  ZIM: 'ZW',
};

/**
 * Names CLDR cannot give, or gives in a form football does not use: the four
 * home nations, and the FIFA-style names fans read ("RD Congo", not
 * "Congo-Kinshasa"). Drafts for the native reviewer, who has the last word.
 */
const HAND_WRITTEN: Record<
  SeedLanguage,
  Record<HomeNation, string> & Partial<Record<FlagCode, string>>
> = {
  es: {
    ENG: 'Inglaterra',
    SCO: 'Escocia',
    WAL: 'Gales',
    NIR: 'Irlanda del Norte',
    CIV: 'Costa de Marfil',
    COD: 'RD Congo',
  },
  fr: {
    ENG: 'Angleterre',
    SCO: 'Écosse',
    WAL: 'Pays de Galles',
    NIR: 'Irlande du Nord',
    CGO: 'Congo',
    COD: 'RD Congo',
  },
  it: {
    ENG: 'Inghilterra',
    SCO: 'Scozia',
    WAL: 'Galles',
    NIR: 'Irlanda del Nord',
    CGO: 'Congo',
    COD: 'RD del Congo',
  },
  de: {
    ENG: 'England',
    SCO: 'Schottland',
    WAL: 'Wales',
    NIR: 'Nordirland',
    CGO: 'Kongo',
    COD: 'DR Kongo',
    CIV: 'Elfenbeinküste',
    CPV: 'Kap Verde',
    USA: 'USA',
  },
};

const language = process.argv[2];
if (language !== 'es' && language !== 'fr' && language !== 'it' && language !== 'de') {
  throw new Error('usage: node scripts/seed-country-names.ts <es|fr|it|de>');
}

const regions = new Intl.DisplayNames([language], { type: 'region', fallback: 'none' });
const hand: Partial<Record<FlagCode, string>> = HAND_WRITTEN[language];
const isoRegion: Partial<Record<FlagCode, string>> = ISO_REGION;
// Object.keys widens to string. ISO_REGION's Record type makes its keys exactly the non-home FlagCodes, so the cast only narrows to that set.
const isoCodes = Object.keys(ISO_REGION) as (keyof typeof ISO_REGION)[];
const codes = [...isoCodes, ...HOME_NATIONS].sort();

const lines = codes.map((code) => {
  const iso = isoRegion[code];
  const name = hand[code] ?? (iso === undefined ? undefined : regions.of(iso));
  if (name === undefined) throw new Error(`${code}: no CLDR name and no hand-written one`);
  return `    ${code}: '${name.replaceAll("'", "\\'")}',`;
});

process.stdout.write(`  ${language}: {\n${lines.join('\n')}\n  },\n`);
```

Run `npx prettier --write scripts/seed-country-names.ts`. It spreads the two dense tables one entry per line. That is fine.

- [ ] **Step 2: Run it for every language**

```bash
for l in es fr it de; do node scripts/seed-country-names.ts $l | head -5; done
node scripts/seed-country-names.ts de | grep -cE "^    [A-Z]{3}:"
```

Expected: each prints `  <lang>: {` and then names. The count is `108`. A thrown "no CLDR name" means a code is missing from `ISO_REGION`. The typecheck should already have caught it.

- [ ] **Step 3: Check, then commit**

Run: `npm run check`
Expected: exit 0 (the typecheck covers the script).

```bash
git add scripts/seed-country-names.ts
git commit -m "feat(i18n): seed a language's country names from CLDR (#145)"
```

---

### Task 5: the review sheet

**Files:**

- Create: `scripts/i18n-review-sheet.ts`, `scripts/i18n-review-sheet.test.ts`

**Interfaces:**

- Consumes:
  - `CATALOGS`, `catalogLeaves`, `Leaf` (Task 1);
  - `LENGTH_BUDGETS` (Task 2);
  - `COUNTRY_NAMES` from `i18n/countries.ts`;
  - `LANGUAGE_NAMES` from `i18n/names.ts`;
  - `en`.
- Produces: `reviewSheet(language: SupportedLanguage): string` (Markdown). `REVIEW_SHEET=<lang> npx vitest run scripts/i18n-review-sheet.test.ts` writes it to `design/play/<lang>/review.md`.

- [ ] **Step 1: Write the failing test**

`scripts/i18n-review-sheet.test.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '@/i18n/resolveLanguage';
import { reviewSheet } from './i18n-review-sheet';

describe('reviewSheet', () => {
  const sheet = reviewSheet('en');

  it('shows each text beside English, with its placeholders and its limit', () => {
    expect(sheet).toContain('| round.whoWears | Who wears {1}? | Who wears {1}? |  |');
    expect(sheet).toContain('| home.startTraining | Start Training | Start Training | 18 |');
  });

  it('shows the singular where the wording changes', () => {
    expect(sheet).toMatch(/\| study\.players \| \{1\} players<br>1: 1 player/);
  });

  it('leaves About and the store tagline to #146 and #147', () => {
    expect(sheet).not.toContain('| about.');
    expect(sheet).not.toContain('| store.');
  });

  it('lists the country names', () => {
    expect(sheet).toContain('| ENG | England | England |');
  });
});

// `REVIEW_SHEET=de npx vitest run scripts/i18n-review-sheet.test.ts` writes the
// sheet next to that language's shots. Skipped in a normal run.
const requested = process.env.REVIEW_SHEET;
it.runIf(requested !== undefined)('writes design/play/<lang>/review.md', () => {
  const language = SUPPORTED_LANGUAGES.find((supported) => supported === requested);
  if (!language) {
    throw new Error(`REVIEW_SHEET=${requested}: supported are ${SUPPORTED_LANGUAGES.join(', ')}`);
  }
  const dir = path.join(process.cwd(), 'design/play', language);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'review.md'), reviewSheet(language));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/i18n-review-sheet.test.ts`
Expected: FAIL, "Failed to resolve import ./i18n-review-sheet".

- [ ] **Step 3: Write `scripts/i18n-review-sheet.ts`**

```ts
// The sheet a native reviewer signs off (#145): every catalog text beside its
// English and its length limit, then the country names. Written next to that
// language's shots by `REVIEW_SHEET=de npx vitest run
// scripts/i18n-review-sheet.test.ts` — a Vitest run, because Node alone cannot
// load the catalogs' extensionless imports.
import type { FlagCode } from '@/assets/flags/generated';
import { LENGTH_BUDGETS } from '@/i18n/budgets';
import { CATALOGS } from '@/i18n/catalogs';
import { COUNTRY_NAMES } from '@/i18n/countries';
import { en } from '@/i18n/en';
import { catalogLeaves, type Leaf } from '@/i18n/leaves';
import { LANGUAGE_NAMES } from '@/i18n/names';
import type { SupportedLanguage } from '@/i18n/resolveLanguage';

/** Reviewed with #146 (About and privacy) and #147 (store listing). */
const LATER = ['about.', 'store.'];

const budgetByPath = new Map<string, number>(
  LENGTH_BUDGETS.flatMap(({ budget, texts }) =>
    Object.keys(texts).map((name) => [name.replace(/ \(.*\)$/, ''), budget] as const),
  ),
);

function cell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

/** A text, then a function's wording for 1 and for 0 where it changes. */
function forms(leaf: Leaf): string {
  const { call } = leaf;
  if (!call || !/\{\d\}/.test(leaf.text)) return leaf.text;
  const extra = [1, 0].flatMap((n) => {
    try {
      const text = call(...Array<number>(leaf.arity).fill(n));
      return text === leaf.text.replace(/\{\d\}/g, String(n)) ? [] : [`${n}: ${text}`];
    } catch {
      return []; // A text parameter, not a count: a number has no `.endsWith`.
    }
  });
  return [leaf.text, ...extra].join('\n');
}

export function reviewSheet(language: SupportedLanguage): string {
  const name = LANGUAGE_NAMES[language];
  const theirs = new Map(catalogLeaves(CATALOGS[language]).map((leaf) => [leaf.path, leaf]));
  const rows = catalogLeaves(en)
    .filter((leaf) => !LATER.some((prefix) => leaf.path.startsWith(prefix)))
    .map((leaf) => {
      const translated = theirs.get(leaf.path);
      const limit = budgetByPath.get(leaf.path) ?? '';
      return `| ${leaf.path} | ${cell(forms(leaf))} | ${cell(translated ? forms(translated) : '')} | ${limit} |`;
    });
  // The English table's keys are exactly the FlagCodes (countries.test.ts).
  const codes = Object.keys(COUNTRY_NAMES.en) as FlagCode[];
  const countries = codes.map(
    (code) =>
      `| ${code} | ${cell(COUNTRY_NAMES.en[code])} | ${cell(COUNTRY_NAMES[language][code])} |`,
  );
  return [
    `# ${name}: review sheet (#145)`,
    '',
    'Reviewer: ______________ Signed off on: ______________',
    '',
    '- `{1}`, `{2}`… are filled in by the app: a number, a name or a label. "1:" and "0:" show the wording for one and for none, where it changes.',
    '- Limit is the most characters the space holds. A text that does not fit is rewritten, never shrunk.',
    '- Never translated: Escuadra, a la escuadra. Team and player names come from the data, so a sentence must not need an article or a case ending around one.',
    '- The screenshots in this folder show each text in place, in dark and in light.',
    '',
    '## Interface',
    '',
    `| Key | English | ${name} | Limit |`,
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '## Countries',
    '',
    `| Code | English | ${name} |`,
    '| --- | --- | --- |',
    ...countries,
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/i18n-review-sheet.test.ts`
Expected: PASS: 4 tests, and the writer skipped.

Run: `REVIEW_SHEET=en npx vitest run scripts/i18n-review-sheet.test.ts && head -20 design/play/en/review.md`
Expected: the sheet's header and its first rows.

- [ ] **Step 5: Check, then commit**

Run: `npm run check`
Expected: exit 0.

```bash
git add scripts/i18n-review-sheet.ts scripts/i18n-review-sheet.test.ts
git commit -m "feat(i18n): a review sheet for each language's native reviewer (#145)"
```

---

### Task 6: docs, full check, PR 1

**Files:**

- Modify: `CLAUDE.md`, `i18n/en.ts:1-11` (header)

- [ ] **Step 1: Say the parity test exists**

In `CLAUDE.md`'s **User-visible text lives in `i18n/`** bullet, replace

```
  extra key fails the typecheck (a function that drops a trailing parameter still
  compiles; a parity test lands with the first translation, #145). About's words
```

with

```
  extra key fails the typecheck, and `i18n/__tests__/catalogs.test.ts` fails a
  dropped parameter, a key out of order or a text left in English. The `≤ N chars`
  comments in `en.ts` are `i18n/budgets.ts`, a test every catalog must fit; the
  per-language facts (date, plurals, position codes, hand-written country names)
  are `i18n/__tests__/translations.test.ts`. About's words
```

In `i18n/en.ts`'s header, replace

```
// key, or a parameter of the wrong type, fails `npm run typecheck`. A function
// that drops a trailing parameter still compiles (a parity test lands with the
// first translation, #145).
```

with

```
// key, or a parameter of the wrong type, fails `npm run typecheck`; a dropped
// trailing parameter fails i18n/__tests__/catalogs.test.ts. Each "≤ N chars"
// budget below is also in ./budgets.ts, which the tests hold every catalog to.
```

Read the header first, so the replaced lines match exactly.

- [ ] **Step 2: Add the shots command**

In `CLAUDE.md`'s command block, after the `npm run shots:play` line, add:

```
npm run shots:play -- --lang=de   # the same, in one language, to design/play/de/ (#145 review)
```

- [ ] **Step 3: Full check**

Run: `nvm use && npm run check`
Expected: exit 0. Keep the tail for the PR.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md i18n/en.ts
git commit -m "docs: the catalog tests and per-language shots (#145)"
```

- [ ] **Step 5: Ask the owner, then open PR 1**

Ask: "#145's groundwork is ready: push and open the PR?" Only on a yes:

```bash
git push -u origin feat/145-i18n-groundwork
gh pr create --title "feat(i18n): groundwork for the four translations — parity, budgets, slot labels, shots per language (#145, part 1)" --body-file <scratchpad>/pr.md
```

The PR body covers:

- what changed, in the file map's terms;
- `SlotChip`'s labels now come from the catalog (`slotCodes`), which closes the gap #144 noted;
- English output is unchanged: `npm run shots` left `design/screens/` untouched;
- no guardrail-7 flag: nothing leaves the device and nothing new is stored;
- no fingerprint change;
- the Decisions above, for the owner to confirm, especially 1, 2 and 7;
- the `npm run check` tail.

End with the session's attribution line.

---

### Task 7: one language (run four times: de, fr, es, it)

Run this whole task once per language, in that order. Each run is its own PR. `<lang>` is the code and `<Name>` the language's own name (Deutsch, Français, Español, Italiano).

**Files:**

- Create: `i18n/<lang>.ts`
- Modify:
  - `i18n/countries.ts`;
  - `i18n/catalogs.ts`;
  - `i18n/resolveLanguage.ts:14`;
  - `i18n/__tests__/catalogs.test.ts` (`SAME_AS_ENGLISH`), only if needed;
  - `i18n/__tests__/translations.test.ts` (`FACTS`), only on a reviewer's change.

**Interfaces:**

- Consumes:
  - `en`, `Messages`, `CalendarDate` from `i18n/en.ts`;
  - `A_LA_ESCUADRA`, `ESCUADRA` from `i18n/names.ts`, if the catalog's text uses them;
  - the seed script (Task 4), the shots (Task 3) and the review sheet (Task 5).
- Produces: `export const <lang>: Messages`. `'<lang>'` joins `SUPPORTED_LANGUAGES`.

#### Glossary (drafts; the reviewer has the last word)

| Term                                    | Español                                          | Français                                                       | Italiano                                        | Deutsch                                                     |
| --------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Address the player as                   | tú                                               | tu                                                             | tu                                              | du                                                          |
| `positionCodes` GK DF MF FW             | POR DEF MED DEL                                  | GB DÉF MIL ATT                                                 | POR DIF CEN ATT                                 | TW AB MF ST                                                 |
| `positions` (≤ 11)                      | Portero, Defensa, Medio, Delantero               | Gardien, Défenseur, Milieu, Attaquant                          | Portiere, Difensore, Centrocampo, Attaccante    | Torwart, Abwehr, Mittelfeld, Sturm                          |
| `slotCodes` NAME POS AGE CLUB NAT (≤ 6) | NOM POS EDAD CLUB NAC                            | NOM POS ÂGE CLUB NAT                                           | NOME RUOLO ETÀ CLUB NAZ                         | NAME POS ALTER VEREIN NAT                                   |
| `slots` (spoken)                        | Nombre, Posición, Edad, Club, Nacionalidad       | Nom, Poste, Âge, Club, Nationalité                             | Nome, Ruolo, Età, Club, Nazionalità             | Name, Position, Alter, Verein, Nationalität                 |
| Level 2                                 | Nivel 2                                          | Niveau 2                                                       | Livello 2                                       | Level 2                                                     |
| Squad (Study's title)                   | Plantilla                                        | Effectif                                                       | Rosa                                            | Kader                                                       |
| Round                                   | ronda                                            | manche                                                         | partita                                         | Runde                                                       |
| Start Training (≤ 18)                   | Entrenar                                         | S’entraîner                                                    | Allenati                                        | Training starten                                            |
| Who wears {n}?                          | ¿Quién lleva el {n}?                             | Qui porte le {n} ?                                             | Chi ha il numero {n}?                           | Wer trägt die {n}?                                          |
| Clubs / National Teams (≤ 14)           | Clubes / Selecciones                             | Clubs / Sélections                                             | Club / Nazionali                                | Vereine / Nationalteams                                     |
| Months (`formats.date`)                 | ene feb mar abr may jun jul ago sept oct nov dic | janv. févr. mars avr. mai juin juil. août sept. oct. nov. déc. | gen feb mar apr mag giu lug ago set ott nov dic | Jan. Feb. März Apr. Mai Juni Juli Aug. Sept. Okt. Nov. Dez. |
| Date shape                              | 21 ago 2026                                      | 21 août 2026                                                   | 21 ago 2026                                     | 21. Aug. 2026                                               |
| Quotes (`picker.noResults`)             | “…”                                              | « … » (no-break spaces)                                        | “…”                                             | „…“                                                         |
| Plural                                  | 1 singular                                       | 0 and 1 singular                                               | 1 singular                                      | 1 singular                                                  |
| Capitals                                | sentence case                                    | sentence case                                                  | sentence case                                   | nouns capitalised, sentence case                            |

Notes:

- **Italian elision:** Italian elides "il" before 8, 11 and 80–89 (l’8, l’11), so never put "il" directly before a number.
- The mono labels in capitals (`continueMeta`, `missedCount`, `nothingMissed`, `ladder.best`, `picker.played`) stay in capitals in every language.
- **Name placement:** follow the Global Constraints rule. For `share.question`, write the name first: `` `${team}: ¿te sabes la plantilla?` `` in Spanish, `` `${team} : sauras-tu nommer tout l’effectif ?` `` in French, `` `${team}: conosci tutta la rosa?` `` in Italian, `` `${team}: Kennst du den ganzen Kader?` `` in German.
- **Level-2 description:** it must spell out the four position codes of its own catalog. The catalog test checks this.

- [ ] **Step 1: Branch**

```bash
nvm use && git switch main && git pull --ff-only && git switch -c feat/145-i18n-<lang>
```

- [ ] **Step 2: Run the facts test for the language, and watch it fail**

Add `'<lang>'` to `SUPPORTED_LANGUAGES` in `i18n/resolveLanguage.ts`, keeping `'en'` first, then the languages in the order they landed:

```ts
export const SUPPORTED_LANGUAGES = ['en', '<lang>'] as const satisfies readonly Language[];
```

Run: `npm run typecheck`
Expected: FAIL. `CATALOGS` and `COUNTRY_NAMES` are missing the property `<lang>`. This is the gate that keeps a language from shipping half-done.

- [ ] **Step 3: Seed the country names**

```bash
node scripts/seed-country-names.ts <lang>
```

Paste the output into `COUNTRY_NAMES` in `i18n/countries.ts`, after the last language entry. Then run `npx prettier --write i18n/countries.ts`.

Check the hand-written names against the language's row in `FACTS` (`i18n/__tests__/translations.test.ts`). The seed and the facts were written from the same glossary, so they should agree.

- [ ] **Step 4: Draft `i18n/<lang>.ts`**

Copy the file's skeleton from `en.ts`: same keys, same order, same parameters. Then translate every text outside `about` and `store`. The file starts:

```ts
// The <Name> catalog (#145), typed against ./en.ts: same keys, same order,
// same parameters. Drafted by Claude and reviewed by a native speaker before
// '<lang>' joined SUPPORTED_LANGUAGES. About and the store tagline are English
// until #146 and #147 translate them with their legal and listing copy.
// Escuadra and a la escuadra come from ./names and are never translated.
import { en, type CalendarDate, type Messages } from './en';

const MONTHS = [/* the glossary's twelve months for <lang> */];

export const <lang>: Messages = {
  common: {
    level: (level: number) => /* glossary "Level 2" */,
    // …every key of en.common, in en's order
  },
  // …every section, in en's order
  store: en.store,
  about: en.about,
};
```

Rules while drafting:

- **Fit the budget** in each `en.ts` comment. Write "Entrenar", not "Comenzar el entrenamiento".
- **Drop the length-budget comments.** They live in `en.ts`. Keep a comment only where the language needed a decision a reviewer should see, such as why German keeps "Level".
- **Plurals:** write each function's own (`count === 1` for es, it and de; `count <= 1` for fr).
- **Name placement and French spacing:** follow the Global Constraints.
- **Spoken texts** (`…Spoken`, `close`, `leave`, hints) are translated like everything else. A screen reader reads them aloud.

- [ ] **Step 5: Register the catalog**

In `i18n/catalogs.ts`:

```ts
import { <lang> } from './<lang>';
// …
export const CATALOGS: Record<SupportedLanguage, Messages> = { en, <lang> };
```

Keep the earlier languages' imports and entries.

- [ ] **Step 6: Run the tests and fix what they find**

Run: `npm run typecheck && npx vitest run i18n scripts`

Expected: PASS. The usual failures, and what to do about each:

- **parity:** a key out of order, or a function with the wrong parameter count. Fix `<lang>.ts`.
- **budgets:** rewrite the text shorter. Never raise a budget to fit.
- **untranslated:** a text equal to English. Translate it. If it is rightly the same (German `Name`, `Position`, `Level {1}`, `MF`), add the path to `SAME_AS_ENGLISH.<lang>` with a comment saying why.
- **facts:** the catalog or the country table disagrees with the glossary. Make them agree.
- **expect several `SAME_AS_ENGLISH` entries per language**, each with its reason: `round.slotSpoken.given` ("{1}: {2}"), `slotCodes.CLUB`, `slotCodes.POS`, `slotCodes.NAT`, `slots.CLUB`, and in German `positionCodes.MF` and `common.level`.

- [ ] **Step 7: Check, then commit the draft**

Run: `npm run check`
Expected: exit 0.

```bash
git add i18n
git commit -m "feat(i18n): <Name> draft, for native review (#145)"
```

- [ ] **Step 8: Capture the shots and check the fit yourself first**

```bash
npm run shots:play -- --lang=<lang>
REVIEW_SHEET=<lang> npx vitest run scripts/i18n-review-sheet.test.ts
ls design/play/<lang>
```

Expected: every shot in dark and light, plus `review.md`. Open each shot at 360×640 and check these places, where the copy is longest or the space is fixed:

| Shot                  | Check                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `01-home`             | The main button: one line, or two cleanly. The continue card's mono meta line                                                   |
| `01b-home-language`   | "Match phone · …" row                                                                                                           |
| `02/03-team-picker-*` | Both segment labels whole; the count line                                                                                       |
| `04-difficulty`       | Rung titles; descriptions wrap rather than cut; unlock hints; Study link                                                        |
| `05-study*`           | Filter pills with the codes; Hide names; "Tap to reveal" pill                                                                   |
| `06/07/08-question-*` | Three slot chips on one row; position tiles (code and word); footer; prompt; credit line's "Photo:"                             |
| `09-results*`         | Title and verdict; the three buttons; the missed cards' lines (two lines at most, and **UI copy must not be cut**); the eyebrow |
| `09-results-share*`   | The picture's title and question inside the card; the two hints within two lines; the format switch                             |
| `09-results-credits`  | Sheet title, button                                                                                                             |

Fix in the order the Global Constraints give. If a fixed canvas cannot take any wording the language accepts, stop and ask the owner. Do not change tokens or layout to make one language fit.

Commit any copy fixes. Then re-run the shots and the sheet.

- [ ] **Step 9: Ask the owner, then open the PR for review**

Ask: "<Name> is drafted and fits: push and open it as a draft PR for the native reviewer?" Only on a yes:

```bash
git push -u origin feat/145-i18n-<lang>
gh pr create --draft --title "feat(i18n): <Name> (#145)" --body-file <scratchpad>/pr.md
```

The PR body:

- says the PR **merges only after native sign-off** (#145's gate);
- gives the glossary row for `<lang>` and every `SAME_AS_ENGLISH` entry with its reason;
- names `design/play/<lang>/` (shots and `review.md`) as the review packet, which the owner sends to the reviewer, since the JPEGs are not committed;
- says About and the store tagline stay English until #146 and #147;
- includes the `npm run check` tail.

End with the session's attribution line.

- [ ] **Step 10: Apply the reviewer's changes**

For each change:

- Edit `i18n/<lang>.ts` or `i18n/countries.ts`.
- When a change touches a fact (a position code, a hand-written country, the date or the plural), update that language's row in `FACTS` too. When it touches a code, update the glossary row in this plan.
- Re-run `npm run check`, the shots and the sheet. A changed position code means a changed level-2 description; the catalog test catches a mismatch.
- Commit: `fix(i18n): <Name> review — <what changed> (#145)`.

Repeat until the reviewer signs off.

- [ ] **Step 11: On sign-off**

The owner ticks "<Name>, reviewed by: <name>" in #145, marks the PR ready, and merges it. Do not merge it yourself.

---

### Task 8: close #145

Run this after all four language PRs have merged.

- [ ] **Step 1: First launch on a phone, per language**

On a development build containing the four languages, for each of es, fr, it and de:

1. Delete the app.
2. Set the phone's language: iOS Settings → General → Language & Region, or on Android 13+ Settings → System → Languages.
3. Install and open the app.

Expected: Home opens in that language, and the chip shows its code.

Also check the per-app setting (iOS Settings → Escuadra → Language) once, with the phone left in English. This is the owner's check. Record the result in #145.

- [ ] **Step 2: Acceptance**

Run: `nvm use && npm run check`
Expected: exit 0.

Tick #145's acceptance criteria with links to each language PR's shots review.

---

## Self-review

**Spec coverage** (issue #145):

| Requirement                                                                                                       | Where                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `es.ts`, `fr.ts`, `it.ts`, `de.ts` written to the budgets in `en.ts`                                              | Task 7 Step 4; budgets enforced by Task 2                                                                                                           |
| Position words and codes per language, the reviewer's pick                                                        | Glossary; `FACTS.positionCodes`; budgets on `positionCodes` and `positions`; Task 7 Step 10                                                         |
| Country names seeded from CLDR via `Intl.DisplayNames`, committed; home nations and FIFA-style names hand-written | Task 4; Task 7 Step 3; `FACTS.countries`                                                                                                            |
| Share text and `ShareCard` per language                                                                           | Both read the catalog already (`shareResult.ts`, `ShareCard.tsx`). Translated in Task 7 Step 4; the fit is checked on `09-results-share*` in Step 8 |
| `capture-screens.mjs` takes a language and sets `languagePreference`; shots per language, German first            | Task 3; Task 7 Step 8; the order is de, fr, es, it                                                                                                  |
| Native review is the gate; each sign-off covers UI text, positions, countries and fit                             | Delivery table; Task 7 Steps 8–11; `review.md` covers text and countries, the shots cover fit                                                       |
| AC: text-expansion rules at 360×640 in both themes                                                                | Play profile (360×640), both themes; Task 7 Step 8 checklist                                                                                        |
| AC: a phone set to each language follows it on first launch                                                       | `FACTS.phoneTag` test (Task 1); device check in Task 8 Step 1                                                                                       |
| AC: `npm run check` passes                                                                                        | Every task                                                                                                                                          |
| Gap left by #144: `SlotChip` labels in English                                                                    | Task 2 Steps 3–4                                                                                                                                    |
| Parity test promised by `en.ts` and CLAUDE.md                                                                     | Task 1; docs in Task 6                                                                                                                              |

**Placeholder scan:** the only open content is the translated text itself, which is Task 7's deliverable (Decision 3). Its consistency is fixed by the glossary, `FACTS`, and the parity, budget, untranslated and French-spacing tests.

**Type consistency:**

- `catalogLeaves(messages): Leaf[]` with `Leaf { path, text, arity, call? }` is used by `catalogs.test.ts`, `translations.test.ts` and `i18n-review-sheet.ts`.
- `LENGTH_BUDGETS: LengthBudget[]`, with keys optionally suffixed ` (sample)`, is stripped by the sheet's `budgetByPath`.
- `resolveLanguageArg` and `outDirFor(profile, language)` match between the tests and the script.
- `CATALOGS: Record<SupportedLanguage, Messages>` is the only catalog table. `useT.ts` imports it.

**Risks to watch while executing:**

- `AsyncStorage` on web stores under the key as given (`escuadra-progress`). If Task 3 Step 7's chip assertion fails with the chip saying `EN`, inspect `localStorage` in the page for the real key, and fix the init script.
- `Intl.DisplayNames` output follows Node's ICU version. Different Node 24 minors may name a country differently. That is fine, because the seed runs once and its output is committed and reviewed.
- Three slot chips with `VEREIN`/`RUOLO` and a long value may not fit one row at 360 dp. The shots decide (Decision 7).
- `toEqual(shape(english))` makes key order part of parity. That is deliberate, so the review sheet and a side-by-side diff line up. If it becomes a nuisance, sorting both sides is a one-line change.
