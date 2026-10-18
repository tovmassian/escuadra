# i18n Football Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Position codes, country names and team names become translatable, keyed by code, and the team picker sorts and searches by the name it displays. English output is unchanged (#144), with one flagged exception: the picker's order (see Decision 1).

**Architecture:**

- `i18n/countries.ts` holds FIFA code → country name per supported language. `i18n/displayNames.ts` turns a nationality, or a nation squad's name, into the displayed name through `lib/flags.ts`'s name → code table.
- The squad data, `lib/questionEngine.ts` and the `Slot` / `QuestionPart` models stay English and code-keyed. Translation happens at the last step before a string is drawn, so the flag lookup and the distractor choice still run on the English key.
- Position codes (`GK`…) move into the catalog as `positionCodes`, next to the existing `positions` words.

**Tech Stack:** TypeScript 5 strict (`noUncheckedIndexedAccess`), Vitest (node), Expo SDK 57 / React Native 0.86, Zustand.

**Spec:**

- Issue #144 is the work list: "feat(i18n): football vocabulary — position codes, country names, team names, picker search".
- Issue #141 is the design reference ("Data stays English").
- Previous plan: `docs/superpowers/plans/2026-10-17-i18n-foundation.md`.
- No separate spec file, because the issues are the spec.
- #145 fills in the other languages. This plan adds none.

**Delivery:** one PR, branch `feat/144-i18n-vocabulary` from `main`. Open the PR only after the owner says so.

## Global Constraints

- **Supported languages today:** `SUPPORTED_LANGUAGES = ['en']`. Tables and catalogs are keyed by `SupportedLanguage`, so #145 adding a language fails the typecheck until its country names and position codes exist.
- **Data stays English:** squad files, `data/index.json`, `data/players.json`, `Position` (`'GK' | 'DF' | 'MF' | 'FW'`), `Player.nationality`, `Squad.name` and `QuestionPart.options` are not changed. `lib/questionEngine.ts` is **untouched**.
- **Club names, player names and league names** are proper nouns: never translated.
- **`lib/` signature rule (CLAUDE.md):** a function that builds text takes `messages: Messages` as its **last** parameter. A function that also needs country names takes `language: SupportedLanguage` immediately **before** `messages`.
- **Unmapped nationality:** a nationality missing from `FLAG_BY_NATIONALITY` shows its English string. It never throws (same rule as `flagFor`).
- **Flags and distractors key on the English string:** `flagFor(...)` is always called with the raw English value, never with a displayed name.
- **No `Intl` beyond `localeCompare`** (CLAUDE.md). Accent folding uses `String.prototype.normalize('NFD')` and a combining-mark range, not `Intl`.
- **Length budgets:** `positionCodes` carries a `/** ≤ N chars: where */` comment. Never `adjustsFontSizeToFit`.
- **Tests:** new `i18n/` tests live in `i18n/__tests__/`. The `lib/*.test.ts` files stay beside their code.
- **TypeScript:** no `!`, no `any`. A cast needs a reason in a comment.
- **Tokens only** (guardrail 5): this plan adds no colour, size or spacing value.
- **Verification:**
  - `nvm use` first (Node 24);
  - `npm run check` passes before every commit;
  - `npm run shots` starts its own server on 8082, so never stop the user's server on 8081.
- **Fingerprint:** no dependency, `app.json` or script change. Nothing here moves it.

## Decisions to confirm with the owner

**Decision 1: the picker's English order changes.** Today the picker lists squads in `data/index.json` order, which is **squad id order**, not name order. Real Betis sits between Barcelona and Brighton, AC Milan between Marseille and Manchester United, Spain between England and France. The issue asks for `localeCompare(lang)` on the displayed name, and also for English screens to show exactly what they show today. Both cannot hold in the picker. This plan sorts by displayed name in every language, English included, because a sort that applies only to other languages would make the list order depend on a setting, and id order is meaningless once names are translated. Consequence: the two picker screenshots in `design/screens/` change, and Task 5 says so in the PR. If the owner wants English left in id order, the only change is dropping the `.sort(...)` call for `language === 'en'` in Task 4 Step 4.

**Out of scope, noticed:** `SlotChip` draws the slot key (`NAME`, `POS`, `AGE`, `NAT`, `CLUB`) as its eyebrow with `{slot.key}`. That is English text the lint rule cannot see, and #144 does not list it. It belongs in #145's list (translators choose `POS`/`NAT` equivalents). This plan leaves it.

## File map

| File                                                   | Responsibility                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `i18n/countries.ts` (new)                              | `COUNTRY_NAMES`: FIFA code → name, per supported language                                  |
| `i18n/displayNames.ts` (new)                           | `countryName`, `nationalityName`, `squadDisplayName`                                       |
| `i18n/__tests__/countries.test.ts` (new)               | Every code has a name in every language; English reproduces today's names                  |
| `i18n/__tests__/displayNames.test.ts` (new)            | The three lookups, their fallbacks, every nation squad name                                |
| `i18n/en.ts`                                           | `positionCodes`                                                                            |
| `lib/roundView.ts`                                     | `positionCode`, `optionText`, `slotValueText`; `slotSpoken` takes `language`               |
| `lib/resultsView.ts`                                   | `missedLine` takes `language`, shows translated option text                                |
| `lib/studyView.ts`                                     | `studyAffiliation` takes `language`                                                        |
| `lib/pickerView.ts`                                    | `visibleSquads` sorts by displayed name, searches displayed or English name, folds accents |
| `lib/questionEngine.test.ts`                           | Pins that the engine is language-free                                                      |
| `components/AnswerGrid.tsx`, `components/SlotChip.tsx` | Draw translated option and slot text                                                       |
| `app/team/[squadId]/study.tsx`                         | Position codes, nationality and team name                                                  |
| `app/team-picker.tsx`                                  | Passes names and locale to `visibleSquads`; shows displayed names                          |
| `app/index.tsx`, `app/team/[squadId]/difficulty.tsx`   | Displayed team name                                                                        |
| `app/play/[squadId]/[level]/index.tsx`, `results.tsx`  | Displayed team name (round header, results context, share card and text)                   |
| `CLAUDE.md`                                            | The i18n bullet names `displayNames.ts` and `countries.ts`                                 |

---

### Task 1: country names and display names

**Files:**

- Create: `i18n/countries.ts`, `i18n/displayNames.ts`, `i18n/__tests__/countries.test.ts`, `i18n/__tests__/displayNames.test.ts`

**Interfaces:**

- Consumes: `FLAG_BY_NATIONALITY`, `flagFor` from `lib/flags.ts`; `SupportedLanguage` from `i18n/resolveLanguage.ts`; `FlagCode` (type only) from `assets/flags/generated.ts`.
- Produces:
  - `type CountryNames = Record<FlagCode, string>`;
  - `COUNTRY_NAMES: Record<SupportedLanguage, CountryNames>`;
  - `countryName(code: FlagCode, language: SupportedLanguage): string`;
  - `nationalityName(nationality: string, language: SupportedLanguage): string`;
  - `squadDisplayName(squad: Pick<Squad, 'kind' | 'name'>, language: SupportedLanguage): string`.

- [ ] **Step 1: Branch**

```bash
nvm use && git switch main && git pull --ff-only && git switch -c feat/144-i18n-vocabulary
```

This plan was written on `main`, uncommitted. The branch carries it over and it lands with the PR.

- [ ] **Step 2: Write the failing country-table test**

`i18n/__tests__/countries.test.ts`:

```ts
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
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run i18n/__tests__/countries.test.ts`
Expected: FAIL, because `../countries` cannot be resolved.

- [ ] **Step 4: Generate `i18n/countries.ts` from the flag table**

The English table is the inverse of `FLAG_BY_NATIONALITY`. Generate it rather than typing 108 lines. Write this script to the scratchpad (not the repo) as `gen-countries.mjs`, then run it from the repo root:

```js
// Writes i18n/countries.ts: the English table is FLAG_BY_NATIONALITY inverted.
import { writeFileSync } from 'node:fs';
import { FLAG_BY_NATIONALITY } from './lib/flags.ts';

const rows = Object.entries(FLAG_BY_NATIONALITY)
  .map(([name, code]) => [code, name])
  .sort(([a], [b]) => a.localeCompare(b));

const body = rows.map(([code, name]) => `    ${code}: ${JSON.stringify(name)},`).join('\n');

const file = `// Country names by FIFA code, per language (#144). The codes are the ones
// lib/flags.ts maps a nationality to, so a squad's nationality strings stay
// English in the data and are translated only when drawn: i18n/displayNames.ts
// does the lookup. Committed data, not Intl: no reliance on Hermes for names.
//
// A language joins SUPPORTED_LANGUAGES (#145) only with a table here, because
// the record below is keyed by it. England, Scotland, Wales and Northern Ireland
// are FIFA members, so they are names in their own right, not "United Kingdom".
// i18n/__tests__/countries.test.ts checks every code has a name in every language.
import type { FlagCode } from '@/assets/flags/generated';
import type { SupportedLanguage } from './resolveLanguage';

export type CountryNames = Record<FlagCode, string>;

export const COUNTRY_NAMES: Record<SupportedLanguage, CountryNames> = {
  en: {
${body}
  },
};
`;
writeFileSync('i18n/countries.ts', file);
```

Run (replace `<scratchpad>` with the session scratchpad directory):

```bash
node --input-type=module < <scratchpad>/gen-countries.mjs
npx prettier --write i18n/countries.ts
grep -c '^    [A-Z]\{3\}:' i18n/countries.ts
```

Expected: `108`. If Node cannot find `./lib/flags.ts` relative to stdin, copy the script to the repo root as `gen-countries.mjs`, run `node gen-countries.mjs`, then delete it before committing.

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run i18n/__tests__/countries.test.ts`
Expected: PASS, 5 tests. This proves the English table equals today's names, "China PR" included.

- [ ] **Step 6: Write the failing display-name test**

`i18n/__tests__/displayNames.test.ts`:

```ts
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
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `npx vitest run i18n/__tests__/displayNames.test.ts`
Expected: FAIL, because `../displayNames` cannot be resolved.

- [ ] **Step 8: Write `i18n/displayNames.ts`**

```ts
// How a team or a country is named on screen (#144). Pure, like
// ./resolveLanguage.ts. The data keeps the English string ("Spain",
// "Ivory Coast"); this turns it into the language's name through the FIFA code
// lib/flags.ts already maps it to. Club names are proper nouns and pass
// through untouched.
import type { FlagCode } from '@/assets/flags/generated';
import { flagFor } from '@/lib/flags';
import type { Squad } from '@/types/squad';
import { COUNTRY_NAMES } from './countries';
import type { SupportedLanguage } from './resolveLanguage';

/** A country's name by FIFA code. */
export function countryName(code: FlagCode, language: SupportedLanguage): string {
  return COUNTRY_NAMES[language][code];
}

/** A player's nationality (the data's English string) in a language. A name
 *  the flag table does not know is shown as it is: a screen must never fail
 *  on one. */
export function nationalityName(nationality: string, language: SupportedLanguage): string {
  const code = flagFor(nationality);
  return code === null ? nationality : countryName(code, language);
}

/** The one way any screen shows a team name: a nation by its country name, a
 *  club as `squad.name`. A nation squad's `name` is its nationality string. */
export function squadDisplayName(
  squad: Pick<Squad, 'kind' | 'name'>,
  language: SupportedLanguage,
): string {
  return squad.kind === 'nation' ? nationalityName(squad.name, language) : squad.name;
}
```

- [ ] **Step 9: Run the tests and typecheck**

Run: `npx vitest run i18n && npm run typecheck`
Expected: PASS; typecheck exits 0.

- [ ] **Step 10: Commit**

```bash
npx prettier --write i18n
git add i18n docs/superpowers/plans/2026-10-17-i18n-football-vocabulary.md
git commit -m "feat(i18n): country names by FIFA code and squadDisplayName (#144)"
```

---

### Task 2: position codes and nationality names in the round

**Files:**

- Modify: `i18n/en.ts`, `lib/roundView.ts`, `lib/resultsView.ts`, `components/AnswerGrid.tsx`, `components/SlotChip.tsx`, `app/play/[squadId]/[level]/results.tsx`
- Test: `lib/roundView.test.ts`, `lib/resultsView.test.ts`, `lib/questionEngine.test.ts`

**Interfaces:**

- Consumes: Task 1's `nationalityName`; `SupportedLanguage`; `useLanguage()` from `i18n/useT.ts`.
- Produces:
  - catalog group `positionCodes: Record<Position, string>`;
  - `positionCode(position: Position, messages: Messages): string`;
  - `optionText(part: QuestionPart, index: number, language: SupportedLanguage, messages: Messages): string`;
  - `slotValueText(slot: Slot, language: SupportedLanguage, messages: Messages): string | null`;
  - `slotSpoken(slot: Slot, language: SupportedLanguage, messages: Messages): string` (was `(slot, messages)`);
  - `missedLine(result: QuestionResult, language: SupportedLanguage, messages: Messages): string` (was `(result, messages)`).

- [ ] **Step 1: Add the codes to the catalog**

In `i18n/en.ts`, directly above the `positions` entry:

```ts
  /** ≤ 3 chars: a position's code on an answer tile, a slot chip, a Study filter pill and a card badge. */
  positionCodes: { GK: 'GK', DF: 'DF', MF: 'MF', FW: 'FW' },
```

- [ ] **Step 2: Write the failing tests**

In `lib/roundView.test.ts`:

1. Add `optionText`, `positionCode`, `slotValueText` to the import from `./roundView`, and `import type { Messages } from '@/i18n/en';` beside the existing `en` import.
2. Change the five `slotSpoken(...)` calls (around lines 518–535) to pass `'en'` before `en`: `slotSpoken({ key: 'POS', state: 'given', value: 'FW' }, 'en', en)`. Expectations stay.
3. Append:

```ts
// A catalog that spells the codes differently, as Spanish will (#145).
const spanishCodes: Messages = {
  ...en,
  positionCodes: { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' },
};

describe('positionCode', () => {
  it('is the English code today', () => {
    expect((['GK', 'DF', 'MF', 'FW'] as const).map((p) => positionCode(p, en))).toEqual([
      'GK',
      'DF',
      'MF',
      'FW',
    ]);
  });

  it('follows the catalog, never the data', () => {
    expect(positionCode('GK', spanishCodes)).toBe('POR');
  });
});

describe('optionText', () => {
  const position: QuestionPart = {
    kind: 'position',
    options: ['GK', 'DF', 'MF', 'FW'],
    correctIndex: 2,
  };
  const nationality: QuestionPart = {
    kind: 'nationality',
    options: ['China PR', 'Spain', 'Atlantis'],
    correctIndex: 1,
  };
  const name: QuestionPart = { kind: 'name', options: ['Pedri', 'Rodri'], correctIndex: 0 };
  const club: QuestionPart = { kind: 'club', options: ['Arsenal'], correctIndex: 0 };

  it('draws a position as its catalog code', () => {
    expect(optionText(position, 3, 'en', en)).toBe('FW');
    expect(optionText(position, 3, 'en', spanishCodes)).toBe('DEL');
  });

  it('draws a nationality as its country name, or as it is when unmapped', () => {
    expect(optionText(nationality, 0, 'en', en)).toBe('China PR');
    expect(optionText(nationality, 2, 'en', en)).toBe('Atlantis');
  });

  it('leaves names and clubs alone', () => {
    expect(optionText(name, 1, 'en', en)).toBe('Rodri');
    expect(optionText(club, 0, 'en', en)).toBe('Arsenal');
  });

  it('shows a dash for an index past the options', () => {
    expect(optionText(name, 9, 'en', en)).toBe('—');
  });
});

describe('slotValueText', () => {
  it('draws POS as a code and NAT as a country name', () => {
    expect(slotValueText({ key: 'POS', state: 'given', value: 'FW' }, 'en', spanishCodes)).toBe(
      'DEL',
    );
    expect(slotValueText({ key: 'NAT', state: 'given', value: 'China PR' }, 'en', en)).toBe(
      'China PR',
    );
  });

  it('leaves NAME, AGE and CLUB as they are', () => {
    expect(slotValueText({ key: 'CLUB', state: 'given', value: 'Arsenal' }, 'en', en)).toBe(
      'Arsenal',
    );
    expect(slotValueText({ key: 'AGE', state: 'given', value: '26' }, 'en', en)).toBe('26');
  });

  it('is null while the slot is being asked, so nothing leaks', () => {
    expect(slotValueText({ key: 'NAT', state: 'active', value: null }, 'en', en)).toBeNull();
  });

  it('speaks the translated value', () => {
    expect(slotSpoken({ key: 'POS', state: 'given', value: 'FW' }, 'en', spanishCodes)).toBe(
      'Position: DEL',
    );
  });
});
```

In `lib/resultsView.test.ts`, change every `missedLine(…, en)` call (lines 115–134) to `missedLine(…, 'en', en)`. Expectations stay. Then add inside the `missedLine` describe, after the `nat` test:

```ts
it('draws the position codes from the catalog', () => {
  const spanish = { ...en, positionCodes: { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' } };
  expect(missedLine(missed([name, pos], [1, 3]), 'en', spanish)).toBe(
    'Name right · position is MED, you said DEL',
  );
});
```

In `lib/questionEngine.test.ts`, add these imports at the top:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FLAG_BY_NATIONALITY } from './flags';
```

and append at the end of the file. It reuses the file's `buildClubRoster()` and `squad()` helpers. Every player there is English, so level 3's nationality distractors all come from the engine's fallback list, which is the case that must stay on English keys:

```ts
describe('the engine is language-free (#144)', () => {
  it('imports nothing from i18n', () => {
    const source = readFileSync(path.resolve(import.meta.dirname, 'questionEngine.ts'), 'utf-8');
    expect(source).not.toMatch(/from ['"]@\/i18n|from ['"]\.\.?\/i18n/);
  });

  it('asks nationalities by the English key the flag table is keyed by', () => {
    const round = buildRound({
      squad: squad(),
      roster: buildClubRoster(),
      level: 3,
      seed: 7,
      now: new Date('2026-01-01'),
    });
    const options = round.flatMap((q) =>
      q.parts.flatMap((part) => (part.kind === 'nationality' ? part.options : [])),
    );
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(FLAG_BY_NATIONALITY[option]).toBeDefined();
    }
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `npm run typecheck`
Expected: FAIL: `positionCode`, `optionText` and `slotValueText` are not exported, and `slotSpoken` / `missedLine` have the wrong argument counts.

- [ ] **Step 4: Change `lib/roundView.ts`**

Add to the imports:

```ts
import { nationalityName } from '@/i18n/displayNames';
import type { SupportedLanguage } from '@/i18n/resolveLanguage';
```

Add below `positionLabel`:

```ts
const POSITION_CODES: readonly string[] = ['GK', 'DF', 'MF', 'FW'];

/** A slot's value is a string, so a position in it needs narrowing back. */
function isPosition(value: string): value is Position {
  return POSITION_CODES.includes(value);
}

/** A position's short code on a tile, chip or badge: GK, DF, MF, FW in English. */
export function positionCode(position: Position, messages: Messages): string {
  return messages.positionCodes[position];
}

/** The text of one answer option. The part keeps the English key (a
 *  nationality, a position code), so the flag and the choice of distractors
 *  never see a translation. */
export function optionText(
  part: QuestionPart,
  index: number,
  language: SupportedLanguage,
  messages: Messages,
): string {
  const value = part.options[index] ?? '—';
  if (part.kind === 'position') return isPosition(value) ? positionCode(value, messages) : value;
  if (part.kind === 'nationality') return nationalityName(value, language);
  return value;
}

/** What a slot chip prints, or null while its part is being asked. The slot
 *  keeps the English value so the chip can look up its flag. */
export function slotValueText(
  slot: Slot,
  language: SupportedLanguage,
  messages: Messages,
): string | null {
  if (slot.value === null) return null;
  if (slot.key === 'POS' && isPosition(slot.value)) return positionCode(slot.value, messages);
  if (slot.key === 'NAT') return nationalityName(slot.value, language);
  return slot.value;
}
```

Replace `slotSpoken`:

```ts
/** A slot chip's screen-reader label. A slot still being asked carries no
 *  value, so its label cannot read out the answer. */
export function slotSpoken(slot: Slot, language: SupportedLanguage, messages: Messages): string {
  const value = slotValueText(slot, language, messages) ?? '';
  return messages.round.slotSpoken[slot.state](messages.slots[slot.key], value);
}
```

- [ ] **Step 5: Change `lib/resultsView.ts`**

Add imports:

```ts
import type { SupportedLanguage } from '@/i18n/resolveLanguage';
import { optionText } from '@/lib/roundView';
```

Replace `missedLine`:

```ts
export function missedLine(
  result: QuestionResult,
  language: SupportedLanguage,
  messages: Messages,
): string {
  const { results } = messages;
  for (let i = 0; i < result.parts.length; i++) {
    const answered = result.parts[i];
    const part = result.question.parts[i];
    if (!answered || !part || answered.correct) continue;
    const picked = optionText(part, answered.pickedIndex, language, messages);
    if (part.kind === 'name') return results.youPicked(picked);
    const right = optionText(part, part.correctIndex, language, messages);
    const before = i === 1 ? results.nameRight : results.nameAndPositionRight;
    return `${before} · ${results.wrongPart[part.kind](right, picked)}`;
  }
  return '';
}
```

- [ ] **Step 6: Change the components**

`components/AnswerGrid.tsx`: change the import to `import { useLanguage, useT } from '@/i18n/useT';` and the `roundView` import to `import { optionText, positionLabel, tileVerdict, type AnswerLayout } from '@/lib/roundView';`. After `const t = useT();` add `const language = useLanguage();`. Replace the `tiles` definition:

```tsx
const tiles: TileModel[] =
  part.kind === 'position'
    ? part.options.map((option, index) => ({
        index,
        label: optionText(part, index, language, t),
        sub: positionLabel(option, t),
        flag: undefined,
      }))
    : part.options.map((option, index) => ({
        index,
        label: optionText(part, index, language, t),
        sub: undefined,
        flag: part.kind === 'nationality' ? flagFor(option) : undefined,
      }));
```

`flagFor(option)` still receives the English option, as the Global Constraints require.

`components/SlotChip.tsx`: change the import to `import { useLanguage, useT } from '@/i18n/useT';` and the roundView import to `import { slotSpoken, slotValueText, type Slot, type SlotState } from '@/lib/roundView';`. After `const t = useT();` add `const language = useLanguage();`. Replace the `shown` line:

```tsx
const text = slotValueText(slot, language, t);
const shown = text ?? (slot.state === 'active' ? '?' : '—');
```

Leave `const flag = slot.key === 'NAT' && slot.value !== null ? flagFor(slot.value) : null;` as it is (it reads the English value). Then in the JSX: `accessibilityLabel={slotSpoken(slot, language, t)}` and `label={text ?? ''}` on the `Flag`.

`app/play/[squadId]/[level]/results.tsx`: in the missed-list component (the one with `line={missedLine(item, t)}`, around line 553), add `const language = useLanguage();` beside its `const t = useT();`, import `useLanguage` with `useT`, and pass `line={missedLine(item, language, t)}`.

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npx vitest run lib i18n`
Expected: PASS. Every pre-existing expectation is unchanged; only argument lists changed.

- [ ] **Step 8: Commit**

```bash
npx prettier --write i18n lib components app
git add -A i18n lib components app
git commit -m "feat(i18n): position codes and nationality names in the round (#144)"
```

---

### Task 3: position codes and nationality names in Study

**Files:**

- Modify: `lib/studyView.ts`, `app/team/[squadId]/study.tsx`
- Test: `lib/studyView.test.ts`

**Interfaces:**

- Consumes: Task 1's `nationalityName`; Task 2's `positionCode`.
- Produces: `studyAffiliation(player: Player, kind: Squad['kind'], language: SupportedLanguage): string` (was `(player, kind)`).

- [ ] **Step 1: Update the tests first**

In `lib/studyView.test.ts`, change the three `studyAffiliation` calls (lines 102, 103, 108) to pass `'en'` as the last argument, and add one case to the `studyAffiliation` describe:

```ts
it('shows an unmapped nationality as it is', () => {
  const p = entry(7, 'Torres', 'FW', { nationality: 'Atlantis' }).player;
  expect(studyAffiliation(p, 'club', 'en')).toBe('Atlantis');
});
```

`studyAffiliation(p, 'club', 'en')` still returns `'Spain'` for the first test; `studyAffiliation(p, 'nation', 'en')` still returns `'Barcelona'`.

- [ ] **Step 2: Run to confirm failure**

Run: `npm run typecheck`
Expected: FAIL with "Expected 2 arguments, but got 3".

- [ ] **Step 3: Change `lib/studyView.ts`**

Add the imports:

```ts
import { nationalityName } from '@/i18n/displayNames';
import type { SupportedLanguage } from '@/i18n/resolveLanguage';
```

Replace `studyAffiliation`:

```ts
/** The line under a name: a club squad's players show their nationality
 *  (with its flag), a nation squad's their club. */
export function studyAffiliation(
  player: Player,
  kind: Squad['kind'],
  language: SupportedLanguage,
): string {
  return kind === 'club' ? nationalityName(player.nationality, language) : (player.club ?? '—');
}
```

`studyLabel` is unchanged: it already receives the affiliation as a finished string, and speaks the position as a word (`positionLabel`).

- [ ] **Step 4: Change `app/team/[squadId]/study.tsx`**

Change the import to `import { useLanguage, useT } from '@/i18n/useT';`, add `positionCode` to the `@/lib/roundView` import (add the import if the file has none: `import { positionCode } from '@/lib/roundView';`), and add `const language = useLanguage();` beside `const t = useT();`.

- `studyAffiliation(player, squad.kind)` becomes `studyAffiliation(player, squad.kind, language)`.
- The list row: `position={positionCode(player.position, t)}`.
- The card: `badge={positionCode(player.position, t)}`.
- The filter pills: `label={f === 'ALL' ? t.study.all : positionCode(f, t)}`.

`flagFor(player.nationality)` stays on the English nationality.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npx vitest run lib/studyView.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npx prettier --write lib app
git add -A lib app
git commit -m "feat(i18n): position codes and nationality names in Study (#144)"
```

---

### Task 4: team names, picker sort and picker search

**Files:**

- Modify: `lib/pickerView.ts`, `app/team-picker.tsx`, `app/index.tsx`, `app/team/[squadId]/difficulty.tsx`, `app/team/[squadId]/study.tsx`, `app/play/[squadId]/[level]/index.tsx`, `app/play/[squadId]/[level]/results.tsx`
- Test: `lib/pickerView.test.ts`

**Interfaces:**

- Consumes: Task 1's `squadDisplayName`; `useLanguage()`.
- Produces:
  - `interface SquadNames { nameOf: (squad: SquadManifestEntry) => string; locale: string }`;
  - `visibleSquads(squads, kind, league, names: SquadNames, query = '')`: the same filters as before, now sorted by displayed name with `localeCompare(locale)`, and `query` matching the displayed name or the English `squad.name`, ignoring case and accents. The previous signature was `(squads, kind, league, query = '')`.

`nameOf` is injected, not computed inside, so the tests can use fixture names today while only English is supported, and the same function serves every language later.

- [ ] **Step 1: Rewrite the `visibleSquads` tests**

In `lib/pickerView.test.ts`, replace the whole `describe('visibleSquads', …)` block with the following. The fixture `MANIFEST` and `entry()` above it are reused. Add `SquadNames` to the import from `./pickerView`.

```ts
// The English name of each fixture entry is its id (see `entry`). These tables
// stand in for a language the app does not ship yet.
const ID_NAMES: SquadNames = { nameOf: (s) => s.id, locale: 'en' };

describe('visibleSquads', () => {
  const show = (
    kind: 'club' | 'nation',
    league: Parameters<typeof visibleSquads>[2],
    query = '',
    names: SquadNames = ID_NAMES,
    squads: SquadManifestEntry[] = MANIFEST,
  ) => visibleSquads(squads, kind, league, names, query).map((s) => s.id);

  it('shows every club under ALL, sorted by name', () => {
    expect(show('club', 'ALL')).toEqual(['ars', 'bar', 'juv', 'rma']);
  });

  it('narrows clubs to one league', () => {
    expect(show('club', 'la-liga')).toEqual(['bar', 'rma']);
  });

  it('never mixes nations into the clubs tab', () => {
    expect(show('club', 'ALL')).not.toContain('arg');
  });

  it('ignores the league on the nations tab', () => {
    // A stale league must not empty the nations list, since nation entries
    // carry no league at all.
    expect(show('nation', 'la-liga')).toEqual(['arg', 'bra']);
  });

  it('returns an empty list for a league with no clubs', () => {
    expect(show('club', 'bundesliga')).toEqual([]);
  });

  it('filters by a case-insensitive substring of the name', () => {
    expect(show('club', 'ALL', 'AR')).toEqual(['ars', 'bar']);
  });

  it('trims surrounding whitespace from the query', () => {
    expect(show('club', 'ALL', '  ar  ')).toEqual(['ars', 'bar']);
  });

  it('treats an empty query as no filter', () => {
    expect(show('club', 'ALL', '')).toEqual(['ars', 'bar', 'juv', 'rma']);
  });

  it('composes the query with the league filter', () => {
    expect(show('club', 'la-liga', 'ba')).toEqual(['bar']);
  });

  it('filters nations by name too', () => {
    expect(show('nation', 'ALL', 'ar')).toEqual(['arg']);
  });

  it('returns an empty list when nothing matches the query', () => {
    expect(show('club', 'ALL', 'zzz')).toEqual([]);
  });

  describe('with displayed names', () => {
    // Three nations as a Spanish-speaking player would see them. The English
    // name stays on the entry, as it does in data/index.json.
    const nations = [
      { ...entry('esp', 'nation'), name: 'Spain' },
      { ...entry('ger', 'nation'), name: 'Germany' },
      { ...entry('aus', 'nation'), name: 'Austria' },
    ] as SquadManifestEntry[];
    const spanish: Record<string, string> = {
      esp: 'España',
      ger: 'Alemania',
      aus: 'Austria',
    };
    const es: SquadNames = { nameOf: (s) => spanish[s.id] ?? s.name, locale: 'es' };

    it('sorts by the displayed name, not by the English one', () => {
      expect(show('nation', 'ALL', '', es, nations)).toEqual(['ger', 'aus', 'esp']);
      expect(show('nation', 'ALL', '', { ...es, nameOf: (s) => s.name }, nations)).toEqual([
        'aus',
        'ger',
        'esp',
      ]);
    });

    it('sorts an accented name among its unaccented neighbours', () => {
      const accented: Record<string, string> = { esp: 'Álava', ger: 'Zaragoza', aus: 'Barcelona' };
      const names: SquadNames = { nameOf: (s) => accented[s.id] ?? s.name, locale: 'es' };
      expect(show('nation', 'ALL', '', names, nations)).toEqual(['esp', 'aus', 'ger']);
    });

    it('finds the same team by "espana", "España" and "Spain"', () => {
      expect(show('nation', 'ALL', 'espana', es, nations)).toEqual(['esp']);
      expect(show('nation', 'ALL', 'España', es, nations)).toEqual(['esp']);
      expect(show('nation', 'ALL', 'Spain', es, nations)).toEqual(['esp']);
    });

    it('ignores accents and case in the typed query and in the name', () => {
      expect(show('nation', 'ALL', 'ESPAÑA', es, nations)).toEqual(['esp']);
      expect(show('nation', 'ALL', 'alemanía', es, nations)).toEqual(['ger']);
    });

    it('matches the English name even when another is displayed', () => {
      expect(show('nation', 'ALL', 'germ', es, nations)).toEqual(['ger']);
    });

    it('does not match a name that appears in neither', () => {
      expect(show('nation', 'ALL', 'francia', es, nations)).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run lib/pickerView.test.ts`
Expected: FAIL (a type error, or every `visibleSquads` case failing, because the signature has no `names` parameter).

- [ ] **Step 3: Change `lib/pickerView.ts`**

Replace the final `visibleSquads` and its doc comment with:

```ts
/** How the picker names and orders its rows. `nameOf` is the displayed name
 *  (`squadDisplayName`), injected so this module stays language-free. */
export interface SquadNames {
  nameOf: (squad: SquadManifestEntry) => string;
  /** The language the list is sorted in: `localeCompare`'s locale. */
  locale: string;
}

/** Lowercase, accents removed: "España" and "espana" fold to the same text.
 *  `normalize('NFD')` splits an accented letter into the letter and a combining
 *  mark (U+0300–U+036F), which the replace drops. No `Intl`. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The rows the picker shows, sorted by the displayed name. `kind` always
 *  applies; `league` narrows clubs only — nation entries carry no league, so it
 *  is ignored on that tab. `query` narrows further by a substring of the
 *  displayed name or of the English one, ignoring case and accents, composing
 *  with `kind` and `league` rather than replacing them. */
export function visibleSquads(
  squads: SquadManifestEntry[],
  kind: 'club' | 'nation',
  league: LeagueFilter,
  names: SquadNames,
  query = '',
): SquadManifestEntry[] {
  const q = fold(query.trim());
  return squads
    .filter(
      (s) =>
        s.kind === kind &&
        (kind !== 'club' || league === 'ALL' || s.league === league) &&
        (q === '' || fold(names.nameOf(s)).includes(q) || fold(s.name).includes(q)),
    )
    .sort((a, b) => names.nameOf(a).localeCompare(names.nameOf(b), names.locale));
}
```

- [ ] **Step 4: Run the picker tests**

Run: `npx vitest run lib/pickerView.test.ts`
Expected: PASS.

`Array.prototype.filter` returns a new array, so the `.sort` does not reorder the manifest in place. The `.sort` is the one change to English behaviour (Decision 1).

- [ ] **Step 5: Use displayed names in the screens**

Each screen below imports `useLanguage` from `@/i18n/useT` (beside the existing `useT` import) and `squadDisplayName` from `@/i18n/displayNames`, and adds `const language = useLanguage();` beside `const t = useT();`.

`app/team-picker.tsx`:

```tsx
const language = useLanguage();
const squads = listSquads();
const leagues = useMemo(() => leagueFilters(squads), [squads]);
const filtered = useMemo(
  () =>
    visibleSquads(
      squads,
      filter,
      league,
      { nameOf: (s) => squadDisplayName(s, language), locale: language },
      query,
    ),
  [squads, filter, league, query, language],
);
```

and in `renderItem`: `name={squadDisplayName(item, language)}`. Keep `flag={item.kind === 'nation' ? flagFor(item.name) : undefined}` as it is: the flag keys on the English name.

`app/index.tsx`: `<Text style={styles.continueName}>{squadDisplayName(continueSquad, language)}</Text>`.

`app/team/[squadId]/difficulty.tsx`: `<Text style={styles.eyebrow}>{squadDisplayName(squad, language).toUpperCase()}</Text>`.

`app/team/[squadId]/study.tsx` (it already has `language` from Task 3): `{[squadDisplayName(squad, language), squad.season].join(' · ')}`.

`app/play/[squadId]/[level]/index.tsx`: in the header, `{squadDisplayName(squad, language)}` in place of `{squad.name}`.

`app/play/[squadId]/[level]/results.tsx`, in the `Results` component (not the missed-list one):

- define `const teamName = squadDisplayName(squad, language);` once, right after `squad` is resolved (below the early return for a missing squad, as `squad` is used at lines 165 onward);
- `resultCopy({ tier, level, teamName, season: squad.season }, t)`;
- `{[teamName, t.common.level(level)].join(' · ')}`;
- `card={{ teamName, season: squad.season, level, items: strip, marker: squad.marker }}`;
- `text={{ teamName, level, outcomes: session.results.map((r) => r.correct) }}`.

This covers the picker, Home's continue card, the round header, results, Study, the share text and `ShareCard` (which receives `teamName` through `card`).

`stores/session.ts` keeps its `squadName: squad.name`. No screen reads it, and it is not drawn.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npx prettier --write lib app
git add -A lib app
git commit -m "feat(i18n): team names by language, picker sort and accent-blind search (#144)"
```

---

### Task 5: guardrail text, full check and the shots

**Files:**

- Modify: `CLAUDE.md`
- Possibly modify: `design/screens/02-team-picker-clubs.png`, `02-team-picker-clubs-light.png`, `03-team-picker-nations.png`, `03-team-picker-nations-light.png`

- [ ] **Step 1: Say where the names come from in CLAUDE.md**

In the **User-visible text lives in `i18n/`** bullet, replace the sentence

```
Data stays English: squads, players, clubs and position
  codes are translated at display time by code, never by their English string.
```

with

```
Data stays English: squads, players, clubs and position
  codes are translated at display time by code, never by their English string.
  A nation's name and a player's nationality come from `i18n/countries.ts` (FIFA
  code → name, the codes `lib/flags.ts` maps to); every screen shows a team
  through `squadDisplayName()` in `i18n/displayNames.ts`. `lib/` functions that
  also need a country name take `language` just before `messages`.
```

- [ ] **Step 2: Confirm no screen shows a raw team name or nationality**

```bash
grep -rnE "squad\.name|continueSquad\.name|item\.name|player\.nationality|\.affiliation\b" app components | grep -v "flagFor\|squadDisplayName"
```

Expected: no hit that draws text. Acceptable remaining lines are the ones feeding `flagFor(...)`, `squad.kind` checks, and `session`'s stored fields. Fix any other.

- [ ] **Step 3: Full check**

Run: `nvm use && npm run check`
Expected: exit 0. Paste the tail of the output into the PR.

- [ ] **Step 4: Capture the screens**

Run: `npm run shots`

Expected: completes with no "page error". Then `git status design/screens`.

- Expected changes: the four team-picker PNGs, because of the name order (Decision 1). Open the clubs and nations ones and confirm the only difference is order: alphabetical, same rows, same text.
- Any other PNG that differs is a regression (a screen's English text changed). Open it beside the `main` version, find the cause and fix it before going on.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md design/screens
git commit -m "docs: where team and country names come from; picker shots in name order (#144)"
```

- [ ] **Step 6: Ask the owner, then open the PR**

Ask: "#144 is ready: push and open the PR?" Only on a yes:

```bash
git push -u origin feat/144-i18n-vocabulary
gh pr create --title "feat(i18n): football vocabulary — position codes, country names, team names, picker search (#144)" --body-file <scratchpad>/pr.md
```

PR body:

- what changed, in the file map's terms;
- **the picker's English order now follows the name** (Decision 1), with the before/after of the two shots. Say plainly that this is the one place English output changes, and why;
- no guardrail-7 flag: nothing leaves the device and nothing is stored; About stays true;
- no fingerprint change: no dependency, `app.json`, or script touched;
- not done, for #145: the slot-key eyebrows (`POS`, `NAT`…) on `SlotChip` are still English;
- `npm run check` tail.

End with the attribution line from the session.

---

## Self-review

**Spec coverage** (issue #144, line by line):

| Requirement                                                                                           | Where                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Position codes in the catalogs, used by tiles, chips, Study                                           | Task 2 (`positionCodes`, tiles via `optionText`, slot chips via `slotValueText`), Task 3 (pills, badge, list row) |
| `Position` stays GK/DF/MF/FW in data and engine                                                       | Global Constraints; engine untouched; Task 2 Step 2 pins it                                                       |
| `i18n/countries.ts`, English reproduces today's names, "China PR"                                     | Task 1 Steps 2–5                                                                                                  |
| `squadDisplayName(squad, lang)` used by picker, Home, header, results, Study, share text, `ShareCard` | Task 1 Step 8; Task 4 Step 5                                                                                      |
| Level-3 nationality options and `NAT` chip show the country table's name                              | Task 2 Steps 4 and 6                                                                                              |
| Picker sort `localeCompare(lang)` on the displayed name                                               | Task 4 Steps 1–4; the English order change is Decision 1                                                          |
| Picker search: displayed or English name, case- and accent-insensitive                                | Task 4 Steps 1–4                                                                                                  |
| Test: every code in `FLAG_BY_NATIONALITY` named in every supported language                           | Task 1 Step 2                                                                                                     |
| AC: English screens unchanged                                                                         | Identity tests in Tasks 1–3; Task 5 Step 4 compares the shots. Exception: picker order, flagged                   |
| AC: "espana", "España", "Spain" find the same team, with fixture names                                | Task 4 Step 1                                                                                                     |
| AC: level-3 distractors unchanged, codes before labels                                                | Engine untouched; Task 2 Step 2 (no i18n import, options are flag-table keys)                                     |
| AC: `npm run check` passes                                                                            | Task 5 Step 3                                                                                                     |

**Placeholder scan:** none. The one generated file has its generator script, an expected line count, and a test that fails if the output is wrong.

**Type consistency:** `optionText(part, index, language, messages)`, `slotValueText(slot, language, messages)`, `slotSpoken(slot, language, messages)`, `missedLine(result, language, messages)`, `studyAffiliation(player, kind, language)`, `visibleSquads(squads, kind, league, names, query)`, `SquadNames { nameOf, locale }`, `positionCode(position, messages)`: every use in later tasks matches its definition.

**Risks to watch while executing:**

- `String.prototype.normalize` must exist in the app's JS engine (Hermes). It does on the SDK 57 / RN 0.86 builds, but the unit tests run on Node, so Step 4's device check is the only proof. Before opening the PR, type "espana" into the picker on a device or simulator against a name with an accent (`Atlético Madrid`, `Málaga`, `Alavés`) and confirm it matches. If `normalize` throws or is missing there, the fix is local to `fold()`.
- `localeCompare` with a locale argument is honoured by Hermes on iOS and Android, but its ordering of accented letters is the platform's. The tests assert only orderings that agree under ICU; do not add an assertion on a tie-break the platform may order differently.
