# i18n Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user-visible string moves into a typed English catalog, `i18n/en.ts`, behind `useT()`, with the language machinery in place. The app still shows only English, and nothing on screen changes except one About sentence (#142).

**Architecture:**

- `i18n/en.ts` is the source catalog, and `Messages = typeof en`.
- `i18n/resolveLanguage.ts` picks a language without React: the pick, else the phone's first supported language, else English.
- `i18n/useT.ts` reads the store and `expo-localization`.
- `lib/` modules that build text take `messages` and stay React-free.
- ESLint fails any hard-coded string in `app/` and `components/` JSX.

**Tech Stack:** Expo SDK 57 and `expo-localization` 57, React Native 0.86, Zustand persist, Vitest (node, no RN renderer), ESLint 9 flat config (`eslint-config-expo`).

**Spec:**

- Issue #141 is the design reference: Architecture, Text expansion, Data stays English.
- Issue #142 is the work list.
- No separate spec file, because the issues are the spec. Three decisions were taken while brainstorming on 2026-10-17. They are recorded under Global Constraints and override the issue text where the two differ.

**Delivery:** two PRs, like #113 and #114 were split.

- **PR 1, the machinery (Tasks 1–6):** branch `feat/142-i18n-machinery` from `main`.
- **PR 2, the strings (Tasks 7–14):** branch `feat/142-i18n-strings`, cut from `main` after PR 1 merges.
- Open each PR only after the owner says so.

## Global Constraints

- **Languages:**
  - `LANGUAGES = ['en', 'es', 'fr', 'it', 'de']`;
  - `SUPPORTED_LANGUAGES = ['en']` until #145 adds each language after its native review;
  - `languagePreference: 'system' | Language` in `stores/progress.ts`, default `'system'`, which survives `reset()`.
- **Catalogs:**
  - `en.ts` is **not** `as const`, so its strings widen to `string`.
  - Values are strings, or functions when they take parameters, and each function writes its own plural.
  - No `Intl` beyond `localeCompare`.
- **Never translated:** _Escuadra_ and _a la escuadra_ come from `i18n/names.ts` (`ESCUADRA`, `ESCUADRA_WORDMARK`, `A_LA_ESCUADRA`, `A_LA_ESCUADRA_TITLE`). Catalogs interpolate them and never spell them out.
- **Data stays English:**
  - squad files, club and player names, country names (#144), position **codes** (#144), league names, `Wikimedia Commons`, `testID`s, telemetry names and haptic names are not catalog text;
  - `lib/questionEngine.ts` is untouched.
- **`lib/` signature rule:** a function that builds text takes `messages: Messages` as its **last** positional parameter, and its tests pass `en` and expect today's exact output.
- **Decision 1: About moves in #142, verbatim.** It goes into `en.about` as data, which #146's privacy-page generator will walk. The one guardrail-7 sentence change ("eight things" becomes "nine things", adding "your language choice" after the appearance preference) landed in PR 1, which stores `languagePreference`; PR 2 copies that sentence like every other paragraph.
- **Decision 2: lint.**
  - `react/jsx-no-literals` takes `{ noStrings: true, ignoreProps: true, allowedStrings: [punctuation] }`.
  - `no-restricted-syntax` fails a lettered string in any attribute, except on a fixed list of props that are never shown or spoken.
  - Both apply to `app/**/*.tsx` and `components/**/*.tsx`.
- **Decision 3: module shape.**
  - `resolveLanguage(preference, deviceTags, supported)` takes the supported list as a parameter, so tests can use real languages today.
  - `CATALOGS: Record<SupportedLanguage, Messages>`.
- **Length budgets:** short labels in `en.ts` carry a `/** ≤ N chars: where */` comment, for buttons, chips, pills, eyebrows and Home's continue-card meta line. Never use `adjustsFontSizeToFit`.
- **Tests:**
  - new `i18n/` tests live in `i18n/__tests__/` (CLAUDE.md);
  - the `lib/*.test.ts` files stay beside their code.
- **TypeScript:** strict with `noUncheckedIndexedAccess`. No `!` and no `any`.
- **Tokens only** (guardrail 5): no task here adds a colour, size or spacing value.
- **Verification:**
  - `nvm use` first (Node 24);
  - `npm run check` passes before every commit;
  - `npm run shots` starts its own web server on 8082, so never stop the user's server on 8081.
- **Fingerprint:**
  - `expo-localization` and `app.json` move it, which is expected for 2.0.0's store build;
  - `main` is not a release branch, so this is allowed.

## File map

| File                                                      | Responsibility                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `i18n/names.ts` (new)                                     | The untranslated names                                                       |
| `i18n/resolveLanguage.ts` (new)                           | `Language`, `LanguagePreference`, `SUPPORTED_LANGUAGES`, `resolveLanguage()` |
| `i18n/en.ts` (new)                                        | The English catalog, `Messages`, `CalendarDate`                              |
| `i18n/useT.ts` (new)                                      | `useLanguage()`, `useT()`                                                    |
| `i18n/__tests__/resolveLanguage.test.ts`                  | Resolution rules                                                             |
| `i18n/__tests__/jsxLiterals.test.ts`                      | The lint rule catches a hard-coded string (Task 13)                          |
| `stores/progress.ts`                                      | `languagePreference`, `setLanguagePreference`                                |
| `lib/*View.ts`, `shareResult.ts`, `photos.ts`, `share.ts` | Take `messages` (or a title) instead of English                              |
| `app/**`, `components/**`                                 | Read `useT()`                                                                |
| `eslint.config.js`                                        | The two rules                                                                |
| `vitest.config.ts`                                        | Includes `i18n/**/*.test.ts`                                                 |
| `app.json`, `package.json`                                | `expo-localization` and its `supportedLocales`                               |
| `CLAUDE.md`                                               | The strings rule under Architecture rules                                    |

---

# PR 1: the machinery

### Task 1: `resolveLanguage` and the names

**Files:**

- Create: `i18n/names.ts`, `i18n/resolveLanguage.ts`, `i18n/__tests__/resolveLanguage.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**

- Produces:
  - `LANGUAGES`, `type Language = 'en' | 'es' | 'fr' | 'it' | 'de'`;
  - `type LanguagePreference = 'system' | Language`;
  - `SUPPORTED_LANGUAGES`, `type SupportedLanguage`;
  - `resolveLanguage<L extends Language>(preference: LanguagePreference, deviceTags: readonly string[], supported: readonly L[]): L | 'en'`;
  - `ESCUADRA`, `ESCUADRA_WORDMARK`, `A_LA_ESCUADRA`, `A_LA_ESCUADRA_TITLE`.

- [ ] **Step 1: Branch**

```bash
git switch main && git pull --ff-only && git switch -c feat/142-i18n-machinery
```

- [ ] **Step 2: Include `i18n/` tests in Vitest**

In `vitest.config.ts`, add `'i18n/**/*.test.ts'` to `include`, and add `i18n/` to the comment ("i18n/ resolves the language without React"):

```ts
    include: [
      'lib/**/*.test.ts',
      'i18n/**/*.test.ts',
      'scripts/**/*.test.ts',
```

- [ ] **Step 3: Write the failing test**

`i18n/__tests__/resolveLanguage.test.ts`:

```ts
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
      expect(resolveLanguage('system', ['zh-Hans-CN', 'en-GB'], LANGUAGES)).toBe('en');
    });

    it('never picks a language that has no reviewed catalog', () => {
      expect(resolveLanguage('system', ['es-MX'], ['en', 'de'])).toBe('en');
    });
  });

  describe('a language picked in the app', () => {
    it('beats the phone', () => {
      expect(resolveLanguage('it', ['es-ES', 'de-DE'], LANGUAGES)).toBe('it');
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
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npx vitest run i18n/__tests__/resolveLanguage.test.ts`
Expected: FAIL, because `../resolveLanguage` cannot be resolved.

- [ ] **Step 5: Write `i18n/resolveLanguage.ts`**

```ts
// Which language the app speaks (#141, "Which language"). Deliberately free of
// React and react-native so it stays unit-testable — Vitest runs in a node
// environment, like theme/resolveTheme.ts. The hook that wraps this is
// ./useT.ts.

export const LANGUAGES = ['en', 'es', 'fr', 'it', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];

/** `'system'` follows the phone, including its per-app language setting. */
export type LanguagePreference = 'system' | Language;

/** The languages with a reviewed catalog. #145 adds each one only after a
 *  native speaker signs it off; `i18n/useT.ts` needs a catalog for each. */
export const SUPPORTED_LANGUAGES = ['en'] as const satisfies readonly Language[];
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** `es-MX`, `de_AT`, `zh-Hans-CN` → `es`, `de`, `zh`. */
function primarySubtag(tag: string): string {
  return (tag.split(/[-_]/)[0] ?? '').toLowerCase();
}

/**
 * A supported language picked in the app wins; otherwise the first supported
 * language in the phone's list (its order is the user's preference order);
 * otherwise English.
 */
export function resolveLanguage<L extends Language>(
  preference: LanguagePreference,
  deviceTags: readonly string[],
  supported: readonly L[],
): L | 'en' {
  if (preference !== 'system') {
    const picked = supported.find((language) => language === preference);
    if (picked) return picked;
  }
  for (const tag of deviceTags) {
    const code = primarySubtag(tag);
    const match = supported.find((language) => language === code);
    if (match) return match;
  }
  return 'en';
}
```

- [ ] **Step 6: Write `i18n/names.ts`**

```ts
// The names Escuadra never translates (#141, "Never translated"). Every
// catalog interpolates these rather than spelling them out, so no translation
// can reword them.

/** The product, in running text. */
export const ESCUADRA = 'Escuadra';

/** The wordmark's lowercase lettering: Home, the share picture, the feature graphic. */
export const ESCUADRA_WORDMARK = 'escuadra';

/** A flawless round, in running text: "…, a la escuadra". */
export const A_LA_ESCUADRA = 'a la escuadra';

/** A flawless round as a title, sentence-initial. */
export const A_LA_ESCUADRA_TITLE = 'A la escuadra';
```

- [ ] **Step 7: Run the test to confirm it passes**

Run: `npx vitest run i18n/__tests__/resolveLanguage.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 8: Commit**

```bash
npx prettier --write i18n vitest.config.ts
npm run typecheck && npx vitest run i18n
git add i18n vitest.config.ts docs/superpowers/plans/2026-10-17-i18n-foundation.md
git commit -m "feat(i18n): resolveLanguage and the untranslated names (#142)"
```

This plan was written on `main`, uncommitted, and the branch carries it over. It lands with PR 1.

---

### Task 2: the runtime: `expo-localization`, the preference, `en.ts`, `useT()`

**Files:**

- Create: `i18n/en.ts`, `i18n/useT.ts`
- Modify: `stores/progress.ts`, `app.json`, `package.json` and `package-lock.json` (via `npx expo install`)

**Interfaces:**

- Consumes: Task 1's `LanguagePreference`, `SUPPORTED_LANGUAGES`, `SupportedLanguage`, `resolveLanguage`.
- Produces:
  - `en`, `type Messages = typeof en`, `interface CalendarDate { day: number; month: number; year: number }`;
  - `useLanguage(): SupportedLanguage`, `useT(): Messages`;
  - `useProgress` gains `languagePreference` and `setLanguagePreference(preference: LanguagePreference)`.

- [ ] **Step 1: Read the versioned docs**

Read https://docs.expo.dev/versions/v57.0.0/sdk/localization/ and confirm two things:

- `useLocales()` returns `Locale[]` with `languageTag`;
- it re-renders when the OS language changes.

The config plugin's options (`supportedLocales: { ios, android }`, which generates iOS `CFBundleLocalizations` and Android `locales_config.xml` plus `android:localeConfig`) are in `node_modules/expo-localization/plugin/build/withExpoLocalization.js` once installed. Confirm them there.

- [ ] **Step 2: Install**

```bash
npx expo install expo-localization
```

Expected:

- `package.json` gains `"expo-localization": "~57.0.x"`;
- `npx expo install` may also add `"expo-localization"` to `app.json` `plugins`.

- [ ] **Step 3: Configure the plugin**

In `app.json` `expo.plugins`, have exactly one `expo-localization` entry, after `"expo-image"`:

```json
      [
        "expo-localization",
        {
          "supportedLocales": {
            "ios": ["en", "es", "fr", "it", "de"],
            "android": ["en", "es", "fr", "it", "de"]
          }
        }
      ],
```

This declares all five to the OS now, so the fingerprint moves once rather than once per language. An iOS per-app setting of, say, Español resolves to English until #145 makes `es` supported.

- [ ] **Step 4: Add the preference to `stores/progress.ts`**

Import the type:

```ts
import type { LanguagePreference } from '@/i18n/resolveLanguage';
```

In `ProgressState`, after `themePreference`:

```ts
/** The app's language (#141): `'system'` follows the phone, an explicit
 *  language pins it. A preference like `themePreference`, so it survives
 *  `reset()`. Set by the Home language sheet (#143). */
languagePreference: LanguagePreference;
```

After `setThemePreference` in the interface:

```ts
  setLanguagePreference: (preference: LanguagePreference) => void;
```

In the initial state, after `themePreference: 'system',`:

```ts
      languagePreference: 'system',
```

After `setThemePreference: …,` in the actions:

```ts
      setLanguagePreference: (languagePreference) => set({ languagePreference }),
```

`reset()` stays `set({ bestScores: {}, lastPlayed: null })`, which already leaves preferences alone. Persist's default shallow merge fills `'system'` for existing installs, as it did when `studyView` was added.

- [ ] **Step 5: Create `i18n/en.ts` with its first group**

```ts
// The English catalog, the source every other language is typed against:
// `Messages = typeof en`. Deliberately not `as const` — its strings widen to
// `string`, so a translation can hold different words while a missing key, an
// extra key or a wrong parameter list still fails `npm run typecheck`.
// Values are strings, or functions when they take parameters; each function
// writes its own plural. No `Intl`: dates and plurals are written out here.
// Escuadra and a la escuadra come from ./names and are never translated.
// Short labels carry a length budget ("≤ N chars: where") that translators
// write to (#141, Text expansion). Spec: #141.

/** A squad's `lastUpdated`, split so each language orders it its own way. */
export interface CalendarDate {
  day: number;
  /** 1–12. */
  month: number;
  year: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const en = {
  common: {
    /** "Level 2": the round header, results, the share text and picture. */
    level: (level: number) => `Level ${level}`,
  },
  formats: {
    /** "21 Aug 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day} ${MONTHS[month - 1] ?? ''} ${year}`,
  },
};

export type Messages = typeof en;
```

Later tasks add groups to this object. Each group goes inside `en`, before the closing `};`.

- [ ] **Step 6: Create `i18n/useT.ts`**

```ts
// The hooks every screen reads text through (#141). `useLocales()` re-renders
// when the phone's language changes, so `'system'` follows it without a
// restart. The resolution itself is ./resolveLanguage.ts, kept React-free.
import { useLocales } from 'expo-localization';
import { useProgress } from '@/stores/progress';
import { en, type Messages } from './en';
import { resolveLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from './resolveLanguage';

/** One catalog per supported language: adding a language to
 *  `SUPPORTED_LANGUAGES` without its catalog fails the typecheck. */
const CATALOGS: Record<SupportedLanguage, Messages> = { en };

/** The language the app speaks now. */
export function useLanguage(): SupportedLanguage {
  const preference = useProgress((s) => s.languagePreference);
  const locales = useLocales();
  return resolveLanguage(
    preference,
    locales.map((locale) => locale.languageTag),
    SUPPORTED_LANGUAGES,
  );
}

/** The active catalog: `const t = useT();` then `t.round.whoWears(7)`. */
export function useT(): Messages {
  return CATALOGS[useLanguage()];
}
```

- [ ] **Step 7: Typecheck and test**

Run: `npm run typecheck && npx vitest run`
Expected: both pass. Nothing calls `useT()` yet.

- [ ] **Step 8: Commit**

```bash
npx prettier --write i18n stores/progress.ts app.json
git add i18n stores/progress.ts app.json package.json package-lock.json
git commit -m "feat(i18n): expo-localization, languagePreference and useT() (#142)"
```

---

### Task 3: the round and Study models take `messages`

**Files:**

- Modify: `i18n/en.ts`, `lib/roundView.ts`, `lib/studyView.ts`, `lib/photos.ts`
- Test: `lib/roundView.test.ts`, `lib/studyView.test.ts`, `lib/photos.test.ts`
- Call sites: `app/play/[squadId]/[level]/index.tsx`, `components/AnswerGrid.tsx`, `components/SlotChip.tsx`, `components/QuestionFooter.tsx`, `app/team/[squadId]/study.tsx`, `components/PhotoCreditText.tsx`

**Interfaces:**

- Consumes: `en`, `Messages` (Task 2).
- Produces:
  - `promptText(part, memberNo, verdict, messages)`;
  - `nextButtonText(mode, last, messages)`;
  - `positionLabel(position, messages)`;
  - `slotSpoken(slot, messages)`;
  - `studyCount(shown, total, filter, messages)`;
  - `studyLabel(no, player, affiliation, hidden, messages)`;
  - `creditParts(credit, messages)`;
  - catalog groups `positions`, `slots`, `round`, `study`, `credits`.

- [ ] **Step 1: Add the groups to `en.ts`**

Inside `en`, after `formats`:

```ts
  /** The word under a position tile's code, and in Study's spoken label. */
  positions: { GK: 'Keeper', DF: 'Defender', MF: 'Midfield', FW: 'Forward' },
  /** Slot names, spoken before a slot's value. */
  slots: { NAME: 'Name', POS: 'Position', AGE: 'Age', CLUB: 'Club', NAT: 'Nationality' },
  round: {
    /** ≤ 12 chars: the prompt row once a question is scored. */
    correct: 'Correct',
    missed: 'Missed',
    whoWears: (no: number) => `Who wears ${no}?`,
    askPosition: 'Position?',
    askClub: 'Which club?',
    askNationality: 'Nationality?',
    /** ≤ 14 chars: the footer button on the last question. */
    seeResults: 'See results',
    /** ≤ 8 chars: the auto-next bar's label before "· tap to skip". */
    next: 'Next',
    nextQuestion: 'Next question',
    gotItNext: 'Got it — next',
    /** The auto-next bar: one line of `ctaLabel` at 360 dp, ≤ 26 chars in all. */
    tapToSkip: (label: string) => `${label} · tap to skip`,
    /** A slot chip's screen-reader label, by slot state. */
    slotSpoken: {
      given: (slot: string, value: string) => `${slot}: ${value}`,
      active: (slot: string) => `${slot}: being asked`,
      pending: (slot: string) => `${slot}: asked next`,
      correct: (slot: string, value: string) => `${slot}: ${value}, right`,
      wrong: (slot: string, value: string) => `${slot}: ${value}, the right answer`,
      notAsked: (slot: string, value: string) => `${slot}: ${value}, not asked`,
    },
  },
  study: {
    /** The header's count, unfiltered. */
    players: (count: number) => (count === 1 ? `${count} player` : `${count} players`),
    /** The header's count, filtered. */
    shownOf: (shown: number, total: number) => `${shown} of ${total}`,
    /** Spoken for a member with no shirt number yet. */
    noNumber: 'no number',
    /** Spoken in place of a name while Hide names is on. */
    nameHidden: 'name hidden',
  },
  credits: {
    /** The licence's change note, after the author and licence. */
    cropped: 'cropped',
  },
```

- [ ] **Step 2: Update the tests first**

In `lib/roundView.test.ts`, `lib/studyView.test.ts` and `lib/photos.test.ts`:

1. Add `import { en } from '@/i18n/en';` to each file's imports.
2. Pass `en` as the last argument to every call of `promptText`, `nextButtonText`, `positionLabel`, `slotSpoken`, `studyCount`, `studyLabel` and `creditParts`. The calls are listed by line in the inventory below. Expected values do not change.

Inventory: `roundView.test.ts` lines 412–422 (`promptText`), 446 (`positionLabel`, inside a `.map`: `(p) => positionLabel(p as 'GK', en)`), 471–491 (`nextButtonText`), 514–529 (`slotSpoken`). `studyView.test.ts` lines 89–94 (`studyCount`), 115–125 (`studyLabel`). `photos.test.ts` lines 70 and 83 (`creditParts`).

Example of the edit:

```ts
expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, null, en)).toBe('Who wears 7?');
expect(nextButtonText('gotIt', false, en)).toEqual({
expect(slotSpoken({ key: 'POS', state: 'given', value: 'FW' }, en)).toBe('Position: FW');
expect(studyCount(26, 26, 'ALL', en)).toBe('26 players');
expect(studyLabel(7, p, 'Barcelona', false, en)).toBe('7, Torres, Forward, Barcelona');
expect(creditParts(credit, en)).toEqual({
```

- [ ] **Step 3: Run them to confirm they fail**

Run: `npm run typecheck`
Expected: FAIL with "Expected 3 arguments, but got 4" (and similar) in the three test files.

- [ ] **Step 4: Change `lib/roundView.ts`**

Add `import type { Messages } from '@/i18n/en';` to the imports.

Replace `promptText`:

```ts
/** The prompt row's words: the part's question, or the verdict once scored. */
export function promptText(
  part: QuestionPart,
  memberNo: number,
  verdict: boolean | null,
  messages: Messages,
): string {
  if (verdict !== null) return verdict ? messages.round.correct : messages.round.missed;
  switch (part.kind) {
    case 'name':
      return messages.round.whoWears(memberNo);
    case 'position':
      return messages.round.askPosition;
    case 'club':
      return messages.round.askClub;
    case 'nationality':
      return messages.round.askNationality;
  }
}
```

Delete `POSITION_LABELS` and replace `positionLabel`:

```ts
/** The word under a position tile's code. */
export function positionLabel(position: Position, messages: Messages): string {
  return messages.positions[position];
}
```

Replace `nextButtonText`'s signature and body:

```ts
export function nextButtonText(
  mode: Exclude<FooterMode, 'waiting'>,
  last: boolean,
  messages: Messages,
): NextButtonText {
  const { round } = messages;
  const spoken = last ? round.seeResults : mode === 'gotIt' ? round.gotItNext : round.nextQuestion;
  if (mode !== 'autoNext') return { label: spoken, spoken };
  return { label: round.tapToSkip(last ? round.seeResults : round.next), spoken };
}
```

Delete `SLOT_NAMES` and replace `slotSpoken`:

```ts
/** A slot chip's screen-reader label. A slot still being asked carries no
 *  value, so its label cannot read out the answer. */
export function slotSpoken(slot: Slot, messages: Messages): string {
  return messages.round.slotSpoken[slot.state](messages.slots[slot.key], slot.value ?? '');
}
```

- [ ] **Step 5: Change `lib/studyView.ts`**

Add `import type { Messages } from '@/i18n/en';`, then:

```ts
/** The header's count: "26 players" unfiltered, "9 of 26" filtered. */
export function studyCount(
  shown: number,
  total: number,
  filter: StudyFilter,
  messages: Messages,
): string {
  if (filter !== 'ALL') return messages.study.shownOf(shown, total);
  return messages.study.players(total);
}
```

```ts
export function studyLabel(
  no: number | null,
  player: Player,
  affiliation: string,
  hidden: boolean,
  messages: Messages,
): string {
  const name = hidden ? messages.study.nameHidden : player.name;
  const position = positionLabel(player.position, messages);
  return `${no ?? messages.study.noNumber}, ${name}, ${position}, ${affiliation}`;
}
```

- [ ] **Step 6: Change `lib/photos.ts`**

Add `import type { Messages } from '@/i18n/en';`. Then `creditParts(credit: PhotoCredit, messages: Messages)` returns `change: messages.credits.cropped`. Leave `'Wikimedia Commons'` alone: it's a proper name, the author fallback.

- [ ] **Step 7: Update the call sites**

Each component adds `import { useT } from '@/i18n/useT';` and `const t = useT();` at the top of the component body, next to `useThemeColors()`.

- `app/play/[squadId]/[level]/index.tsx:376`: `{promptText(part, question.memberNo, verdict, t)}`
- `components/AnswerGrid.tsx:61`: `sub: positionLabel(option, t),`
- `components/SlotChip.tsx:94`: `accessibilityLabel={slotSpoken(slot, t)}`
- `components/QuestionFooter.tsx:94`: `nextButtonText(mode, last, t).label`. At `:116`, `nextButtonText('autoNext', last, t)`, in the second component, which gets its own `const t = useT();` at `:115`.
- `app/team/[squadId]/study.tsx:188`: `studyLabel(member.no, player, affiliation, covered, t)`. At `:302`, `studyCount(rows.length, roster.length, filter, t)`.
- `components/PhotoCreditText.tsx:18`: `creditParts(credit, t)`

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npx vitest run lib/roundView.test.ts lib/studyView.test.ts lib/photos.test.ts`
Expected: PASS with unchanged expectations.

- [ ] **Step 9: Commit**

```bash
npx prettier --write i18n lib app components
git add -A i18n lib app components
git commit -m "feat(i18n): round and Study models take messages (#142)"
```

---

### Task 4: results and sharing take `messages`

**Files:**

- Modify: `i18n/en.ts`, `lib/resultsView.ts`, `lib/shareResult.ts`, `lib/share.ts`
- Test: `lib/resultsView.test.ts`, `lib/shareResult.test.ts`
- Call sites: `app/play/[squadId]/[level]/results.tsx`, `components/ShareSheet.tsx`

**Interfaces:**

- Produces:
  - `resultCopy(input, messages)`, `missedLine(result, messages)`;
  - `shareTextParts(input, messages)`, `formatShareText(input, messages)`, `shareCardView(input, messages)`;
  - `shareImage(card, dialogTitle: string)`;
  - catalog groups `results`, `share`.

- [ ] **Step 1: Add the groups to `en.ts`**

Add `import { A_LA_ESCUADRA_TITLE } from './names';` at the top of `en.ts`. After `MONTHS`, add:

```ts
/** "Spain's", but "Netherlands'". English only: each catalog writes its own. */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}
```

Inside `en`:

```ts
  results: {
    /** The flawless round's title. */
    flawlessTitle: A_LA_ESCUADRA_TITLE,
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, level ${level}. Nothing missed.`,
    /** Also the share picture's title for a pass. */
    clearedTitle: (level: number) => `Level ${level} cleared`,
    clearedVerdict: 'You knew most of the starting XI.',
    failTitle: 'These are the ones to learn',
    /** `target` is "8/10". */
    toClear: (target: string, level: number) => `Score ${target} to clear level ${level}.`,
    toUnlock: (target: string, level: number) => `Score ${target} to unlock level ${level}.`,
    /** A missed card's line when the name was wrong. */
    youPicked: (picked: string) => `You picked ${picked}`,
    nameRight: 'Name right',
    nameAndPositionRight: 'Name and position right',
    /** A missed card's line after a later part, following "Name right · ". */
    wrongPart: {
      position: (right: string, picked: string) => `position is ${right}, you said ${picked}`,
      club: (right: string, picked: string) => `club is ${right}, you said ${picked}`,
      nationality: (right: string, picked: string) =>
        `nationality is ${right}, you said ${picked}`,
    },
  },
  share: {
    /** The share sheet's title, the results Share button's label, Android's share dialog. */
    title: 'Share your round',
    /** The share picture's title below a pass: it speaks to whoever receives it. */
    stillLearning: 'Still learning',
    /** The share picture's question to its receiver. */
    question: (team: string) => `Can you name ${possessive(team)} squad?`,
  },
```

- [ ] **Step 2: Update the tests first**

Add `import { en } from '@/i18n/en';` to `lib/resultsView.test.ts` and `lib/shareResult.test.ts`. Pass `en` as the last argument to:

- `resultCopy` (lines 53–73): `resultCopy({ ...base, tier: 'fail' }, en)`;
- `missedLine` (114–133): `missedLine(missed([name], [0]), en)`;
- `formatShareText` (15–59), `shareTextParts` (71, 83) and `shareCardView` (99–136): `formatShareText({ teamName: 'Spain', level: 3, outcomes: Array(10).fill(true) }, en)`.

Expectations stay as they are.

- [ ] **Step 3: Run to confirm failure**

Run: `npm run typecheck`
Expected: FAIL on argument counts in both test files.

- [ ] **Step 4: Change `lib/resultsView.ts`**

Add `import type { Messages } from '@/i18n/en';`. Replace `resultCopy` and `missedLine`, and delete `PART_NOUN`:

```ts
/** The tier's title and one line of verdict (spec §3.1). */
export function resultCopy(
  {
    tier,
    level,
    teamName,
    season,
  }: {
    tier: ResultTier;
    level: number;
    teamName: string;
    season: string;
  },
  messages: Messages,
): ResultCopy {
  const { results } = messages;
  if (tier === 'excellent') {
    return {
      title: results.flawlessTitle,
      verdict: results.flawlessVerdict(teamName, season, level),
    };
  }
  if (tier === 'passed') {
    return { title: results.clearedTitle(level), verdict: results.clearedVerdict };
  }
  const target = `${Math.ceil(PASS_RATIO * ROUND_LENGTH)}/${ROUND_LENGTH}`;
  return {
    title: results.failTitle,
    verdict: level >= 3 ? results.toClear(target, level) : results.toUnlock(target, level + 1),
  };
}
```

```ts
export function missedLine(result: QuestionResult, messages: Messages): string {
  const { results } = messages;
  for (let i = 0; i < result.parts.length; i++) {
    const answered = result.parts[i];
    const part = result.question.parts[i];
    if (!answered || !part || answered.correct) continue;
    const picked = part.options[answered.pickedIndex] ?? '—';
    if (part.kind === 'name') return results.youPicked(picked);
    const right = part.options[part.correctIndex] ?? '—';
    const before = i === 1 ? results.nameRight : results.nameAndPositionRight;
    return `${before} · ${results.wrongPart[part.kind](right, picked)}`;
  }
  return '';
}
```

- [ ] **Step 5: Change `lib/shareResult.ts`**

Import `type Messages` from `@/i18n/en` and `{ A_LA_ESCUADRA, A_LA_ESCUADRA_TITLE, ESCUADRA }` from `@/i18n/names`. Delete `possessive` and `TITLES`. Then:

```ts
export function shareTextParts(
  { teamName, level, outcomes }: ShareInput,
  messages: Messages,
): ShareTextParts {
  const squares = outcomes.filter((o): o is boolean => o !== null);
  const correct = squares.filter(Boolean).length;
  return {
    header: [ESCUADRA, teamName, messages.common.level(level)].join(' · '),
    score: `${correct}/${squares.length}`,
    verdict: isFlawless(correct, squares.length) ? A_LA_ESCUADRA : null,
    squares,
    url: SHARE_URL,
  };
}

export function formatShareText(input: ShareInput, messages: Messages): string {
  const { header, score, verdict, squares, url } = shareTextParts(input, messages);
```

The rest of `formatShareText` is unchanged.

```ts
// Results' fail title ("These are the ones to learn") speaks to the player;
// the picture speaks to whoever receives it, so a fail reads "Still learning".
function cardTitle(tier: ResultTier, level: number, messages: Messages): string {
  if (tier === 'excellent') return A_LA_ESCUADRA_TITLE;
  if (tier === 'passed') return messages.results.clearedTitle(level);
  return messages.share.stillLearning;
}

export function shareCardView(
  { teamName, season, level, items }: ShareCardInput,
  messages: Messages,
): ShareCardView {
  const correct = items.filter((i) => i.correct).length;
  const tier = resultTier(correct, items.length);
  return {
    eyebrow: [teamName, season, messages.common.level(level)].join(' · '),
    correct,
    total: items.length,
    tier,
    title: cardTitle(tier, level, messages),
    question: messages.share.question(teamName),
    link: SHARE_URL_DISPLAY,
  };
}
```

- [ ] **Step 6: Change `lib/share.ts`**

`shareImage(card: RefObject<View | null>, dialogTitle: string)` passes `dialogTitle` through to `Sharing.shareAsync`. Update the doc comment: "`dialogTitle` is Android's share-dialog title, in the app's language".

- [ ] **Step 7: Update the call sites**

- `app/play/[squadId]/[level]/results.tsx:163`: `resultCopy({ tier, level, teamName: squad.name, season: squad.season }, t)`, with `const t = useT();` beside `useThemeColors()` at `:69`.
- `results.tsx:544`, inside the missed-list component, which gets its own `const t = useT();` beside its `useThemeColors()` at `:498`: `line={missedLine(item, t)}`.
- `components/ShareSheet.tsx`, with `const t = useT();` beside `useThemeColors()` at `:76`:
  - `:99` `shareCardView(card, t)`;
  - `:100` `shareTextParts(text, t)`;
  - `:197` `await shareImage(cardRef, t.share.title)` and `shareText(formatShareText(text, t))`.

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npx vitest run lib/resultsView.test.ts lib/shareResult.test.ts`
Expected: PASS, with expectations unchanged.

- [ ] **Step 9: Commit**

```bash
npx prettier --write i18n lib app components
git add -A i18n lib app components
git commit -m "feat(i18n): results and sharing take messages (#142)"
```

---

### Task 5: ladder, picker and About models take `messages`

**Files:**

- Modify: `i18n/en.ts`, `lib/ladderView.ts`, `lib/pickerView.ts`, `lib/aboutView.ts`
- Test: `lib/ladderView.test.ts`, `lib/pickerView.test.ts`, `lib/aboutView.test.ts`
- Call sites: `app/team/[squadId]/difficulty.tsx`, `components/DifficultyCard.tsx`, `components/DifficultyRow.tsx`, `components/TeamRow.tsx`, `app/team-picker.tsx`, `app/about.tsx`

**Interfaces:**

- Produces:
  - `playLabel(row, messages)`;
  - `unlockHint(level: Level, messages): string`, which replaces the `LadderRow.unlockHint` field;
  - `rungAccessibilityLabel(row, title, messages)`;
  - `formatLastUpdated(isoDate, messages)`;
  - `teamMetaLine(season, progress, messages)`;
  - `leagueLabel(filter: LeagueFilter, messages): string`, which replaces `LEAGUE_LABELS`;
  - `versionLabel(version, update, messages)`;
  - catalog groups `ladder`, `picker`, `about`.

`LadderRow` loses `unlockHint`. The hint is derived from the level, so carrying English text in the model was redundant. `ladderRows` keeps its signature.

- [ ] **Step 1: Add the groups to `en.ts`**

```ts
  ladder: {
    /** ≤ 14 chars: the Play card's button. */
    play: 'Play',
    /** ≤ 14 chars: the Play card's button once the level has a score. */
    playAgain: 'Play Again',
    /** Under a locked rung. `target` is "8/10". */
    unlockHint: (target: string, level: number) => `Score ${target} on L${level}`,
    rungLocked: (title: string, hint: string) => `${title}, locked, ${hint}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, best ${correct} of ${total}`,
  },
  picker: {
    /** ≤ 6 chars: the league pill that clears the filter. */
    allLeagues: 'ALL',
    /** A team row's mono meta line, never played. */
    notPlayed: (season: string) => `${season} · NOT PLAYED`,
    /** A team row's mono meta line, with its best score. */
    played: (season: string, level: number, correct: number, total: number) =>
      `${season} · LEVEL ${level} · BEST ${correct}/${total}`,
  },
  about: {
    version: (version: string) => `Version ${version}`,
    /** In brackets after the version on a build's own bundle. */
    builtIn: 'built-in',
  },
```

- [ ] **Step 2: Update the tests first**

`lib/ladderView.test.ts`:

- Import `unlockHint` alongside the others, and add `import { en } from '@/i18n/en';`.
- Replace the two `unlockHint` tests (lines 59–69) with:

```ts
it('names the score that unlocks a level', () => {
  expect(unlockHint(2, en)).toBe('Score 8/10 on L1');
  expect(unlockHint(3, en)).toBe('Score 8/10 on L2');
});

it('carries no text in the rows', () => {
  expect(ladderRows('bar', {})[1]).toEqual({ level: 2, status: 'locked' });
});
```

- `formatLastUpdated('2026-08-21', en)` and `('2026-01-05', en)` at lines 84 and 88.
- `playLabel(…, en)` at 116–126.
- `rungAccessibilityLabel(row, 'Name from Number', en)` at 135, and the unlocked case at 146.
- The locked case at 139–143 becomes:

```ts
it('announces a locked rung with what unlocks it', () => {
  const row = { level: 3, status: 'locked' } as const;
  expect(rungAccessibilityLabel(row, 'Full Profile', en)).toBe(
    'Full Profile, locked, Score 8/10 on L2',
  );
});
```

`lib/pickerView.test.ts`: `teamMetaLine('2025/26', undefined, en)` and the other three calls (55–68). Add a test:

```ts
describe('leagueLabel', () => {
  it('names leagues as they are, and the clear pill from the catalog', () => {
    expect(leagueLabel('ALL', en)).toBe('ALL');
    expect(leagueLabel('la-liga', en)).toBe('La Liga');
  });
});
```

`lib/aboutView.test.ts`: every `versionLabel('1.0.0', update)` becomes `versionLabel('1.0.0', update, en)`.

- [ ] **Step 3: Run to confirm failure**

Run: `npm run typecheck`
Expected: FAIL. The three test files have wrong argument counts, and `unlockHint` and `leagueLabel` are not exported.

- [ ] **Step 4: Change `lib/ladderView.ts`**

Add `import type { Messages } from '@/i18n/en';`. Remove `unlockHint?: string` and its comment from `LadderRow`. In `ladderRows`, the locked branch becomes `return { level, status: 'locked' };`. Delete `MONTHS`. Then:

```ts
/** What clears a locked level's gate, so the padlock is not left to imply it. */
export function unlockHint(level: Level, messages: Messages): string {
  return messages.ladder.unlockHint(`${PASS_MARK}/${ROUND_LENGTH}`, level - 1);
}

export function playLabel(row: LadderRow, messages: Messages): string {
  return row.best ? messages.ladder.playAgain : messages.ladder.play;
}

/** What a screen reader announces for a compact rung, whose status is
 *  otherwise carried only by its badge and pill. */
export function rungAccessibilityLabel(row: LadderRow, title: string, messages: Messages): string {
  if (row.status === 'locked') {
    return messages.ladder.rungLocked(title, unlockHint(row.level, messages));
  }
  if (row.best) return messages.ladder.rungBest(title, row.best.correct, row.best.total);
  return title;
}

/** Formats a squad's `lastUpdated` (`YYYY-MM-DD`) for the difficulty
 *  screen's staleness footnote: "21 Aug 2026" in English. */
export function formatLastUpdated(isoDate: string, messages: Messages): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return messages.formats.date({ day: day ?? 1, month: month ?? 1, year: year ?? 0 });
}
```

- [ ] **Step 5: Change `lib/pickerView.ts`**

Add `import type { Messages } from '@/i18n/en';`. Then:

```ts
export function teamMetaLine(
  season: string,
  progress: TeamProgress | null | undefined,
  messages: Messages,
): string {
  if (progress === undefined) return season;
  if (progress === null) return messages.picker.notPlayed(season);
  return messages.picker.played(season, progress.level, progress.correct, progress.total);
}
```

Replace `LEAGUE_LABELS` with:

```ts
/** League names are proper nouns, like club names: data, not catalog text. */
const LEAGUE_NAMES: Record<League, string> = {
  'premier-league': 'Premier League',
  'la-liga': 'La Liga',
  'serie-a': 'Serie A',
  bundesliga: 'Bundesliga',
  'ligue-1': 'Ligue 1',
  ucl: 'UCL',
};

/** A league pill's label. */
export function leagueLabel(filter: LeagueFilter, messages: Messages): string {
  return filter === 'ALL' ? messages.picker.allLeagues : LEAGUE_NAMES[filter];
}
```

- [ ] **Step 6: Change `lib/aboutView.ts`**

Add `import type { Messages } from '@/i18n/en';`. Then:

```ts
export function versionLabel(version: string, update: UpdateState, messages: Messages): string {
  const label = messages.about.version(version);
  if (!update.isEnabled) return label;
  if (update.isEmbeddedLaunch) return `${label} (${messages.about.builtIn})`;

  const id = updateGroupFromManifest(update.manifest) ?? update.updateId;
  if (!id) return label;

  const shortId = id.slice(0, GROUP_ID_LENGTH);
  const channelSuffix =
    update.channel && update.channel !== PRODUCTION_CHANNEL ? ` · ${update.channel}` : '';

  return `${label} (${shortId}${channelSuffix})`;
}
```

- [ ] **Step 7: Update the call sites**

Each file adds `const t = useT();` beside `useThemeColors()`.

- `app/team/[squadId]/difficulty.tsx:118`: `formatLastUpdated(squad.lastUpdated, t)`
- `components/DifficultyCard.tsx:60`: `label={playLabel(row, t)}`
- `components/DifficultyRow.tsx`:
  - `:46` `rungAccessibilityLabel(row, title, t)`;
  - `:60` `{locked && <Text style={styles.hint}>{unlockHint(row.level, t)}</Text>}`, importing `unlockHint`.
- `components/TeamRow.tsx:61`: `{teamMetaLine(season, progress, t)}`
- `app/team-picker.tsx`: import `leagueLabel` in place of `LEAGUE_LABELS`, and use `label={leagueLabel(l, t)}`.
- `app/about.tsx`: `versionLabel(version, { … }, t)`

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npx vitest run lib`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
npx prettier --write i18n lib app components
git add -A i18n lib app components
git commit -m "feat(i18n): ladder, picker and About models take messages (#142)"
```

---

### Task 6: PR 1 verification

- [ ] **Step 1: Confirm no English is left in `lib/` text builders**

```bash
grep -nE "'[A-Z][a-z]+( [a-z]+)*'" lib/*View.ts lib/shareResult.ts lib/share.ts lib/photos.ts
grep -nE '`[A-Z][a-z]+ ' lib/*View.ts lib/shareResult.ts lib/share.ts lib/photos.ts
```

Expected: only comments, `'Wikimedia Commons'` and the league names in `LEAGUE_NAMES`.

- [ ] **Step 2: Full check**

Run: `nvm use && npm run check`
Expected: exit 0. Paste the tail of the output into the PR.

- [ ] **Step 3: Prove the app boots on web with `expo-localization`**

Run: `npm run shots`

Expected:

- it completes with no "page error";
- `git status design/screens` shows no changes, or only PNGs whose pixels are unchanged.

If any PNG differs, open it and the `main` version side by side, and explain the difference in the PR before going on.

- [ ] **Step 4: Ask the owner, then open PR 1**

Ask: "PR 1 of #142 is ready: push and open it?" Only on a yes:

```bash
git push -u origin feat/142-i18n-machinery
gh pr create --title "feat(i18n): the language machinery (#142, part 1)" --body-file <scratchpad>/pr1.md
```

PR body:

- what changed;
- the fingerprint note (`expo-localization` and `app.json`, for the 2.0.0 store build);
- **guardrail 7 flag:** About's stored-data list changes from eight to nine things ("your language choice"), because this branch stores `languagePreference`. This is #146's wording, landed early; `privacy.html` follows in #146 with the build;
- that nothing on screen changes except About's stored-data sentence, and the shots prove it;
- the `npm run check` tail.

End with the attribution line from the session.

---

# PR 2: the strings

Cut `feat/142-i18n-strings` from `main` after PR 1 merges:

```bash
git switch main && git pull --ff-only && git switch -c feat/142-i18n-strings
```

**How Tasks 7–11 work.** Each task adds its keys to `en.ts` with their budget comments, then replaces every string in its files with `t.…`, with `const t = useT();` beside `useThemeColors()` in each component. A task is done when `npm run typecheck` passes, the task's files have no lettered string left in JSX or in an object of UI labels (check them against the inventory lines given), and the screen looks as before.

**JSX patterns:**

- `‹ Back` becomes `‹ {t.common.back}`. The `‹` stays as text, and the lint allowlist covers it.
- A composed line uses `[a, b].join(' · ')`, never a lettered template in JSX.
- `{' · '}`, `{' — '}` and `/` stay as they are.

### Task 7: Home, picker, difficulty and the feature graphic

**Files:**

- `i18n/en.ts`
- `app/index.tsx`, `app/team-picker.tsx`, `app/team/[squadId]/difficulty.tsx`, `app/store/feature-graphic.tsx`
- `components/ThemeToggle.tsx`, `components/Wordmark.tsx`, `components/SearchField.tsx`, `components/BestPill.tsx`

- [ ] **Step 1: Add the keys**

Add the `common` keys below to the existing `common` group. Add the new keys under `picker` and `ladder` to the existing groups from Tasks 5 and 6. `home` and `store` are new groups.

```ts
  common: {
    level: (level: number) => `Level ${level}`, // (exists)
    /** ≤ 8 chars: the back link, after "‹ ". */
    back: 'Back',
    /** A sheet's close button, spoken. */
    close: 'Close',
    /** A score, spoken. */
    scoreSpoken: (correct: number, attempted: number) => `Score: ${correct} of ${attempted}`,
  },
  home: {
    /** ≤ 8 chars: the top-left link. */
    aboutLink: 'About',
    /** Spoken name of the theme switch. */
    darkTheme: 'Dark theme',
    /** ≤ 24 chars: the continue card's meta line, in IBM Plex Mono capitals. */
    continueMeta: (level: number, best: number | undefined) =>
      best === undefined ? `LEVEL ${level}` : `LEVEL ${level} · BEST ${best}/10`,
    /** ≤ 18 chars: the main button. */
    startTraining: 'Start Training',
    /** ≤ 20 chars: the text button. */
    browseAllTeams: 'Browse All Teams',
  },
  picker: {
    // …allLeagues, notPlayed, played (exist)
    title: 'Choose a Team',
    count: (count: number) =>
      count === 1 ? `${count} team · tap to start` : `${count} teams · tap to start`,
    /** ≤ 14 chars each: the segmented control. */
    clubs: 'Clubs',
    nationalTeams: 'National Teams',
    /** The search field's placeholder and spoken name. */
    search: 'Search teams',
    clearSearch: 'Clear search',
    noTeams: 'No teams found',
    noResults: (query: string) => `No results for "${query}"`,
  },
  ladder: {
    // …play, playAgain, unlockHint, rungLocked, rungBest (exist)
    title: 'Choose Difficulty',
    /** Titles ≤ 18 chars: a rung's title. Descriptions wrap. */
    levels: {
      1: {
        title: 'Name from Number',
        description: 'Given a shirt number, pick the player from 4 options.',
      },
      2: {
        title: 'Name + Position',
        description: 'Pick the name, then the position — GK, DF, MF, or FW.',
      },
      3: {
        title: 'Full Profile',
        description: 'Name from 6 options, then position, then club or nationality.',
      },
    },
    /** ≤ 20 chars: the Study button or link. */
    studySquad: 'Study This Squad',
    /** The staleness footnote; `date` from `formatLastUpdated`. */
    updated: (date: string) => `Updated ${date} · Wikipedia`,
    /** ≤ 12 chars: a rung's best-score pill, in capitals. */
    best: (correct: number, total: number) => `BEST ${correct}/${total}`,
  },
  store: {
    /** The Play Store feature graphic's tagline (#147 localises the graphic). */
    tagline: 'Learn every squad',
  },
```

- [ ] **Step 2: Replace the strings**

| File and line (from the 2026-10-17 inventory)          | Becomes                                                                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/index.tsx:95` `About`                             | `{t.home.aboutLink}`                                                                                                                                |
| `app/index.tsx:128-131` `LEVEL … BEST …`               | `{t.home.continueMeta(lastPlayed.level, continueBest)}`                                                                                             |
| `app/index.tsx:144` `label="Start Training"`           | `label={t.home.startTraining}`                                                                                                                      |
| `app/index.tsx:152` `label="Browse All Teams"`         | `label={t.home.browseAllTeams}`                                                                                                                     |
| `app/team-picker.tsx:17-20` `SEGMENTS`                 | Built inside the component: `const segments = [{ key: 'club', label: t.picker.clubs }, { key: 'nation', label: t.picker.nationalTeams }] as const;` |
| `app/team-picker.tsx:78` `‹ Back`                      | `‹ {t.common.back}`                                                                                                                                 |
| `app/team-picker.tsx:80`                               | `{t.picker.title}`                                                                                                                                  |
| `app/team-picker.tsx:81-83` the count line             | `{t.picker.count(filtered.length)}`                                                                                                                 |
| `app/team-picker.tsx:115`                              | `{t.picker.noTeams}`                                                                                                                                |
| `app/team-picker.tsx:117`                              | `{t.picker.noResults(query.trim())}`                                                                                                                |
| `components/SearchField.tsx:107,112,119`               | `placeholder={t.picker.search}`, `accessibilityLabel={t.picker.search}`, `accessibilityLabel={t.picker.clearSearch}`                                |
| `app/team/[squadId]/difficulty.tsx:16-29` `LEVEL_COPY` | Deleted. Use `t.ladder.levels[row.level]`.                                                                                                          |
| `difficulty.tsx:73` `‹ Back`, `:76`                    | `‹ {t.common.back}`, `{t.ladder.title}`                                                                                                             |
| `difficulty.tsx:109` `label="Study This Squad"`        | `label={t.ladder.studySquad}`                                                                                                                       |
| `difficulty.tsx:118`                                   | `{t.ladder.updated(formatLastUpdated(squad.lastUpdated, t))}`                                                                                       |
| `components/BestPill.tsx:32-34` `BEST …`               | `{t.ladder.best(correct, total)}`                                                                                                                   |
| `components/ThemeToggle.tsx:36`                        | `accessibilityLabel={t.home.darkTheme}`                                                                                                             |
| `components/Wordmark.tsx:15,53`                        | `const WORD = ESCUADRA_WORDMARK;`, `accessibilityLabel={ESCUADRA}` (import from `@/i18n/names`)                                                     |
| `app/store/feature-graphic.tsx:20,21`                  | `{ESCUADRA_WORDMARK}`, `{t.store.tagline}`                                                                                                          |

`SegmentedControl`'s `segments` prop type may require a readonly tuple, as `SEGMENTS` was `as const`. Keep `as const` on the in-component array.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both pass. The lint rule is not on yet.

- [ ] **Step 4: Commit**

```bash
npx prettier --write i18n app components
git add -A i18n app components
git commit -m "feat(i18n): Home, picker and difficulty strings in the catalog (#142)"
```

### Task 8: the question screen

**Files:**

- `i18n/en.ts`
- `app/play/[squadId]/[level]/index.tsx`
- `components/AnswerTile.tsx`, `components/QuestionFooter.tsx`, `components/RoundProgress.tsx`, `components/StreakChip.tsx`, `components/PhotoCreditLine.tsx`

- [ ] **Step 1: Add the keys**

These go into the existing `round` and `credits` groups:

```ts
  round: {
    // …(exists)
    /** The close button's spoken name. */
    leave: 'Leave the round',
    shirtNumber: (no: number) => `Shirt number ${no}`,
    /** ≤ 20 chars: the footer before a tap. */
    tapYourAnswer: 'Tap your answer',
    /** The auto-next bar's spoken hint. */
    movesOn: 'Moves on by itself in a moment',
    /** ≤ 8 chars: the tag over the right answer after a miss, in capitals. */
    answerTag: 'Answer',
    /** What a tile adds to its spoken name once answered; '' adds nothing. */
    tileSpoken: {
      idle: '',
      'correct-picked': 'correct',
      'correct-unpicked': 'the right answer',
      'incorrect-picked': 'your pick, wrong',
      'incorrect-other': '',
    },
    questionOf: (n: number, total: number) => `Question ${n} of ${total}`,
    streak: (count: number) => `Streak: ${count} in a row`,
  },
  credits: {
    // …cropped (exists)
    /** ≤ 8 chars: before the credit under the question. */
    photo: 'Photo:',
  },
```

- [ ] **Step 2: Replace the strings**

| Site                                      | Becomes                                                                                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.tsx:295` `label="Leave the round"` | `label={t.round.leave}`                                                                                                                                              |
| `index.tsx:302` `Level {level}`           | `{t.common.level(level)}`                                                                                                                                            |
| `index.tsx:309`                           | `accessibilityLabel={t.common.scoreSpoken(score.correct, score.attempted)}`                                                                                          |
| `index.tsx:346`                           | `accessibilityLabel={t.round.shirtNumber(question.memberNo)}`                                                                                                        |
| `AnswerTile.tsx:83-89` `SPOKEN`           | Deleted.                                                                                                                                                             |
| `AnswerTile.tsx:250`                      | `accessibilityLabel={[label, sub, t.round.tileSpoken[verdict]].filter(Boolean).join(', ')}`. The output is identical: each part is joined by ", " only when present. |
| `AnswerTile.tsx:267` `Answer`             | `{t.round.answerTag}`                                                                                                                                                |
| `QuestionFooter.tsx:77`                   | `{t.round.tapYourAnswer}`                                                                                                                                            |
| `QuestionFooter.tsx:152`                  | `accessibilityHint={t.round.movesOn}`                                                                                                                                |
| `RoundProgress.tsx:32`                    | `accessibilityLabel={t.round.questionOf(currentIndex + 1, outcomes.length)}`                                                                                         |
| `StreakChip.tsx:88`                       | `accessibilityLabel={t.round.streak(count)}`                                                                                                                         |
| `PhotoCreditLine.tsx:42` `Photo: <…>`     | `{t.credits.photo} <PhotoCreditText … />`, keeping the space as `{' '}` before the component                                                                         |

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck && npm run lint
npx prettier --write i18n app components
git add -A i18n app components
git commit -m "feat(i18n): question-screen strings in the catalog (#142)"
```

### Task 9: Results, sharing and credits

**Files:**

- `i18n/en.ts`
- `app/play/[squadId]/[level]/results.tsx`
- `components/ShareSheet.tsx`, `components/ShareCard.tsx`, `components/RoundStrip.tsx`, `components/PhotoCredits.tsx`, `components/PhotoCreditText.tsx`, `components/Sheet.tsx`

- [ ] **Step 1: Add the keys**

These go into the existing `results`, `share` and `credits` groups.

```ts
  results: {
    // …(exists)
    /** The close button's spoken name. */
    close: 'Close, choose a different team',
    /** ≤ 22 chars: the outline button. */
    studySquad: 'Study this squad',
    /** ≤ 22 chars: the main button, and the retry icon's spoken name. */
    retry: 'Retry this round',
    /** ≤ 22 chars: the main button after a pass. */
    playLevel: (level: number) => `Play level ${level}`,
    /** ≤ 22 chars: the main button after level 3. */
    chooseTeam: 'Choose different team',
    /** ≤ 24 chars: the missed list's eyebrow, in capitals. */
    missedCount: (count: number) =>
      count === 1 ? `MISSED · ${count} PLAYER` : `MISSED · ${count} PLAYERS`,
    /** ≤ 14 chars: beside that eyebrow. */
    swipeForAll: 'Swipe for all',
    /** ≤ 24 chars: the flawless roster's eyebrow, in capitals. */
    nothingMissed: (count: number) => `ALL ${count} · NOTHING MISSED`,
    /** The round strip, spoken. */
    roundSpoken: (right: number, total: number) => `Round: ${right} of ${total} right`,
  },
  share: {
    // …title, stillLearning, question (exist)
    /** ≤ 8 chars each: the format switch. */
    image: 'Image',
    text: 'Text',
    /** ≤ 10 chars: under the chat-bubble preview. */
    preview: 'Preview',
    imageHint: 'Story-sized picture. No player photos, no names — friends can still play it.',
    textHint: 'The score grid for group chats, with a link to the app.',
    /** ≤ 16 chars: the submit button. */
    shareImage: 'Share image',
    shareText: 'Share text',
    /** The share picture, spoken. */
    pictureSpoken: (eyebrow: string, correct: number, total: number, title: string) =>
      `Share picture: ${eyebrow}. ${correct} of ${total}. ${title}.`,
  },
  credits: {
    // …cropped, photo (exist)
    /** The credits sheet's title. */
    title: 'Photo credits',
    /** ≤ 20 chars: the button that opens it. */
    button: (count: number) => `Photo credits · ${count}`,
  },
```

Use module-level constants in `en.ts` so the About text (Task 11) quotes exactly the label it names:

```ts
const PHOTO_CREDITS = 'Photo credits';
const CROPPED = 'cropped';
```

Then the `credits` group reads:

```ts
  credits: {
    /** The licence's change note, after the author and licence. */
    cropped: CROPPED,
    /** ≤ 8 chars: before the credit under the question. */
    photo: 'Photo:',
    /** The credits sheet's title. */
    title: PHOTO_CREDITS,
    /** ≤ 20 chars: the button that opens it. */
    button: (count: number) => `${PHOTO_CREDITS} · ${count}`,
  },
```

- [ ] **Step 2: Replace the strings**

| Site                                                               | Becomes                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `results.tsx:195-197` the primary-button labels                    | `t.results.retry`, `t.results.playLevel(level + 1)`, `t.results.chooseTeam`                       |
| `results.tsx:214`                                                  | `accessibilityLabel={t.results.close}`                                                            |
| `results.tsx:220`                                                  | `{[squad.name, t.common.level(level)].join(' · ')}`                                               |
| `results.tsx:226`                                                  | `accessibilityLabel={t.share.title}`                                                              |
| `results.tsx:305`                                                  | `{t.results.studySquad}`                                                                          |
| `results.tsx:312`                                                  | `accessibilityLabel={t.results.retry}`                                                            |
| `results.tsx:459` (the `Score` component; add `const t = useT();`) | `accessibilityLabel={t.common.scoreSpoken(correct, attempted)}`                                   |
| `results.tsx:521-523`                                              | `{t.results.missedCount(missed.length)}`                                                          |
| `results.tsx:524`                                                  | `{t.results.swipeForAll}`                                                                         |
| `results.tsx:597` (its component; add `const t = useT();`)         | `{t.results.nothingMissed(results.length)}`                                                       |
| `ShareSheet.tsx:69`                                                | `title={t.share.title}`                                                                           |
| `ShareSheet.tsx:207-210` `formats`                                 | `label: t.share.image`, `label: t.share.text`                                                     |
| `ShareSheet.tsx:292`                                               | `{t.share.preview}`                                                                               |
| `ShareSheet.tsx:300-303`                                           | `{format === 'image' ? t.share.imageHint : t.share.textHint}`                                     |
| `ShareSheet.tsx:319`                                               | `{format === 'image' ? t.share.shareImage : t.share.shareText}`                                   |
| `ShareCard.tsx:156`                                                | `accessibilityLabel={t.share.pictureSpoken(view.eyebrow, view.correct, view.total, view.title)}`  |
| `ShareCard.tsx:166-168` `escuadra`                                 | `{ESCUADRA_WORDMARK}`                                                                             |
| `RoundStrip.tsx:29`                                                | `accessibilityLabel={t.results.roundSpoken(items.filter((i) => i.correct).length, items.length)}` |
| `PhotoCredits.tsx:49`                                              | `{t.credits.button(rows.length)}`                                                                 |
| `PhotoCredits.tsx:51`                                              | `title={t.credits.title}`                                                                         |
| `PhotoCreditText.tsx:33` ``{` · ${change}`}``                      | `{' · '}{change}` (no template literal in JSX)                                                    |
| `Sheet.tsx:226`                                                    | `accessibilityLabel={t.common.close}`                                                             |

`ShareCard` keeps drawing in `palettes.dark` (guardrail 5's exception). Only its text moves.

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck && npm run lint
npx prettier --write i18n app components
git add -A i18n app components
git commit -m "feat(i18n): results, sharing and credits strings in the catalog (#142)"
```

### Task 10: Study

**Files:**

- `i18n/en.ts`
- `app/team/[squadId]/study.tsx`
- `components/PlayerCard.tsx`, `components/StudyListRow.tsx`

- [ ] **Step 1: Add the keys**

These go into the existing `study` group:

```ts
  study: {
    // …players, shownOf, noNumber, nameHidden (exist)
    /** The screen's title. */
    title: 'Squad',
    /** ≤ 12 chars: the toggle, and the switch's constant spoken name. */
    hideNames: 'Hide names',
    showNames: 'Show names',
    showAsList: 'Show as list',
    showAsCards: 'Show as cards',
    /** ≤ 6 chars: the filter pill for every position. */
    all: 'All',
    /** ≤ 14 chars: the dashed pill over a hidden name. */
    tapToReveal: 'Tap to reveal',
    /** A hidden name's spoken hint. */
    revealsName: 'Reveals the name',
  },
```

- [ ] **Step 2: Replace the strings**

| Site                                         | Becomes                                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `study.tsx:241` `"Back"`                     | `accessibilityLabel={t.common.back}`                                                                                    |
| `study.tsx:257`                              | `accessibilityLabel={t.study.hideNames}`                                                                                |
| `study.tsx:264`                              | `{hidden ? t.study.showNames : t.study.hideNames}`                                                                      |
| `study.tsx:271`                              | `accessibilityLabel={grid ? t.study.showAsList : t.study.showAsCards}`                                                  |
| `study.tsx:291`                              | `{[squad.name, squad.season].join(' · ')}`                                                                              |
| `study.tsx:300` `Squad`                      | `{t.study.title}`                                                                                                       |
| `study.tsx:315`                              | `label={f === 'ALL' ? t.study.all : f}`. Position codes stay until #144.                                                |
| `PlayerCard.tsx:163-166`                     | `'no number'` becomes `t.study.noNumber`, and `name hidden` becomes `${t.study.nameHidden}`, in the same template shape |
| `PlayerCard.tsx:208`, `StudyListRow.tsx:166` | `{t.study.tapToReveal}`                                                                                                 |
| `PlayerCard.tsx:241`, `StudyListRow.tsx:202` | `accessibilityHint={nameHidden ? t.study.revealsName : undefined}`                                                      |

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck && npm run lint
npx prettier --write i18n app components
git add -A i18n app components
git commit -m "feat(i18n): Study strings in the catalog (#142)"
```

### Task 11: About, as data, verbatim

**Files:**

- `i18n/en.ts`, `app/about.tsx`
- Temporary: `i18n/__tests__/aboutVerbatim.test.ts`, deleted before the commit

**Interfaces:**

- Produces: `en.about.{ title, intro, credits, vibration, usageStatistics, privacy }`, plus the existing `version` and `builtIn`. #146's privacy-page generator walks `privacy`.

- [ ] **Step 1: Add the structure to `en.ts`**

Import `ESCUADRA` and `A_LA_ESCUADRA` from `./names`. Add a module constant beside `PHOTO_CREDITS` and `CROPPED`:

```ts
const USAGE_STATISTICS = 'Share anonymous usage statistics';
```

Extend `about`. Copy each paragraph **verbatim** from `app/about.tsx` on `main`, with these conversions:

- join each paragraph's lines with single spaces;
- `&apos;` becomes `'` and `&quot;` becomes `"`;
- every `Escuadra` becomes `${ESCUADRA}` and `a la escuadra` becomes `${A_LA_ESCUADRA}`;
- the quoted labels become `${USAGE_STATISTICS}`, `${PHOTO_CREDITS}` and `${CROPPED}`.

```ts
  about: {
    version: (version: string) => `Version ${version}`, // (exists)
    builtIn: 'built-in', // (exists)
    title: 'About',
    /** Affiliation, then crests. */
    intro: [
      `${ESCUADRA} is an independent, unofficial app. It is not affiliated with, endorsed by, or associated with FIFA, UEFA, any league, any national football association, or any club. Club and national team names are used for identification only and remain the property of their respective owners. ${ESCUADRA} is also not affiliated with or endorsed by the Wikimedia Foundation, or by any player shown in a photo.`,
      /* "Escuadra identifies teams by their names and colours…" */
    ],
    credits: {
      heading: 'Data and image credits',
      sections: [
        { heading: 'Squad data', paragraphs: [/* "Squad data is compiled from Wikipedia…" */] },
        {
          heading: 'Player photos',
          paragraphs: [
            /* "Player photos come from Wikimedia Commons…" */
            /* "The author, the licence and the word "cropped"…": quote ${CROPPED} and ${PHOTO_CREDITS} */
          ],
        },
        { heading: 'Flags and fonts', paragraphs: [/* "Flag images are from flagpedia.net…" */] },
      ],
    },
    /** The setting row's label and the switch's spoken name. */
    vibration: 'Vibration',
    usageStatistics: USAGE_STATISTICS,
    privacy: {
      heading: 'Privacy',
      /** Set in emphasis. */
      lead: `${ESCUADRA} has no account, no sign-in and no advertising, and it never asks for your name, email or any contact details.`,
      paragraphs: [/* "Your scores and settings stay on your device…" */],
      sections: [
        {
          heading: 'Player photos',
          paragraphs: [
            /* "Escuadra does not ship player photos…" */
            /* "Photos already loaded may be kept…" */
            /* "Tapping a photo credit opens…" */
          ],
        },
        { heading: 'Sharing', paragraphs: [/* "Sharing a result creates a picture…" */] },
        {
          heading: 'Anonymous usage statistics',
          paragraphs: [
            /* "Escuadra sends anonymous usage statistics…": quote ${USAGE_STATISTICS} */
            /* "The statistics are: the app was opened…": with ${A_LA_ESCUADRA} */
          ],
        },
        { heading: 'App updates', paragraphs: [/* "When Escuadra starts, it checks…" */] },
        {
          heading: 'What is stored on your device',
          paragraphs: [/* "Escuadra saves nine things locally…" */, /* "This lives in the app's own private storage…" */],
        },
        { heading: 'Crash reports', paragraphs: [/* "If you allow your device to share diagnostics…" */] },
        { heading: 'Children', paragraphs: [/* "Escuadra has no account and asks for no personal information…" */] },
      ],
    },
  },
```

Each `/* "…" */` marker names a paragraph of `app/about.tsx` by its opening words. The executor replaces the marker with that whole paragraph as a template string, and none may remain in the file. The order of markers is the order on screen, and Step 3's check enforces it.

Paragraph counts can differ between languages without failing the typecheck, because arrays aren't tuples. #145 or #146 adds a parity test when the first translation lands. Name this in the PR.

- [ ] **Step 2: Render it in `app/about.tsx`**

Replace the hand-written sections with renders of the structure. Keep every style and the `marginBottom: 0` on each card's last paragraph.

```tsx
const t = useT();
const last = (i: number, list: readonly unknown[]) => i === list.length - 1;
```

```tsx
<Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
  <Text style={styles.back}>‹ {t.common.back}</Text>
</Pressable>
<Text style={styles.title}>{t.about.title}</Text>

<View style={styles.section}>
  {t.about.intro.map((p, i, all) => (
    <Text key={i} style={[styles.paragraph, last(i, all) && { marginBottom: 0 }]}>
      {p}
    </Text>
  ))}
</View>

<View style={styles.section}>
  <Text style={styles.sectionHeading}>{t.about.credits.heading}</Text>
  {t.about.credits.sections.map((section, s, sections) => (
    <React.Fragment key={section.heading}>
      <Text style={styles.subHeading}>{section.heading}</Text>
      {section.paragraphs.map((p, i, all) => (
        <Text
          key={i}
          style={[styles.paragraph, last(s, sections) && last(i, all) && { marginBottom: 0 }]}
        >
          {p}
        </Text>
      ))}
    </React.Fragment>
  ))}
</View>
```

- The two setting rows: `{t.about.vibration}` and `accessibilityLabel={t.about.vibration}`; `{t.about.usageStatistics}` and `accessibilityLabel={t.about.usageStatistics}`.
- Privacy: `sectionHeading` `{t.about.privacy.heading}`, then `<Text style={styles.paragraphEmphasis}>{t.about.privacy.lead}</Text>`, then `privacy.paragraphs`, then `privacy.sections`, rendered like credits.
- Import `React` (or `Fragment`) from `react`. Keys are section headings, which are unique within a card.

- [ ] **Step 3: Write the temporary verbatim check**

`i18n/__tests__/aboutVerbatim.test.ts`:

```ts
// TEMPORARY (#142, Task 11): proves en.about reproduces main's About text. Deleted before the commit — it reads main's
// copy of app/about.tsx, which this PR replaces.
import { execSync } from 'node:child_process';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { en } from '@/i18n/en';

function mainAboutTexts(): string[] {
  const src = execSync('git show main:app/about.tsx', { encoding: 'utf8' });
  const sf = ts.createSourceFile('about.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text
        .replace(/\s+/g, ' ')
        .trim()
        .replaceAll('&apos;', "'")
        .replaceAll('&quot;', '"');
      if (text) out.push(text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

it("reproduces main's About text", () => {
  const a = en.about;
  const actual = [
    `‹ ${en.common.back}`,
    a.title,
    ...a.intro,
    a.credits.heading,
    ...a.credits.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
    a.vibration,
    a.usageStatistics,
    a.privacy.heading,
    a.privacy.lead,
    ...a.privacy.paragraphs,
    ...a.privacy.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
  ];
  const nine = a.privacy.sections.find((s) => s.heading === 'What is stored on your device')
    ?.paragraphs[0];
  const expected = mainAboutTexts();
  expect(actual).toEqual(expected);
  expect(nine).toContain('nine things');
  expect(nine).toContain('your language choice');
});
```

- [ ] **Step 4: Run it**

Run: `npx vitest run i18n/__tests__/aboutVerbatim.test.ts`

Expected: PASS. On a failure, the diff names the paragraph that drifted: fix `en.ts`, never the test.

- [ ] **Step 5: Delete the temporary test, verify and commit**

```bash
rm i18n/__tests__/aboutVerbatim.test.ts
npm run typecheck && npm run lint
npx prettier --write i18n app
git add -A i18n app
git commit -m "feat(i18n): About as catalog data (#142)"
```

### Task 12: Sweep for strings outside JSX

- [ ] **Step 1: Run the inventory**

Run this from the repo root. It's the TypeScript-AST inventory used to draw up this plan, printing every lettered string literal in `app/` and `components/` with its syntactic context:

```bash
node -e '
const ts=require("typescript"),fs=require("fs");
for (const f of process.argv.slice(1)) {
  const sf=ts.createSourceFile(f,fs.readFileSync(f,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const v=(n)=>{ let t=null;
    if (ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)) t=n.text;
    else if (ts.isTemplateExpression(n)) t=n.getText(sf);
    else if (ts.isJsxText(n)) t=n.text.trim();
    if (t!==null && /[A-Za-z]{2,}/.test(t) && !ts.isImportDeclaration(n.parent))
      console.log(f+":"+(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1)+"\t"+ts.SyntaxKind[n.parent.kind]+"\t"+t.replace(/\s+/g," ").slice(0,90));
    ts.forEachChild(n,v); };
  v(sf); }' $(git ls-files 'app/*.tsx' 'components/*.tsx' 'components/*.ts')
```

- [ ] **Step 2: Review every line**

Each remaining line must be one of these:

- a style value;
- an enum or union value (`'club'`, `'ALL'`, `'image'`, `'button'`…);
- a route;
- a `testID`;
- a telemetry or haptic name;
- `'worklet'`;
- data.

Anything a person can see or hear moves to `en.ts`, under the task area it belongs to. List the reviewed exceptions in the PR description.

- [ ] **Step 3: Commit any fixes**

```bash
npm run typecheck && npx prettier --write i18n app components
git add -A i18n app components
git commit -m "feat(i18n): the last stray strings (#142)"
```

Skip the commit if nothing changed.

### Task 13: The lint rule and its test

**Files:**

- Modify: `eslint.config.js`
- Create: `i18n/__tests__/jsxLiterals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// The guard behind "user-visible text lives in i18n/" (#142): a hard-coded
// string in app/ or components/ JSX fails `npm run lint`. Runs the real
// eslint.config.js, so the props list and allowlist are tested as configured.
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });
const RULES = new Set(['react/jsx-no-literals', 'no-restricted-syntax']);

async function hits(jsx: string): Promise<number> {
  const code = `import { Text, View, Pressable } from 'react-native';\nexport function F({ t, on, n }: { t: { a: string }; on: boolean; n: number }) {\n  return (${jsx});\n}\n`;
  const [result] = await eslint.lintText(code, { filePath: 'components/LintFixture.tsx' });
  return (result?.messages ?? []).filter((m) => m.ruleId !== null && RULES.has(m.ruleId)).length;
}

describe('hard-coded UI strings fail lint', { timeout: 60_000 }, () => {
  it.each([
    ['JSX text', '<Text>Start Training</Text>'],
    ['a string child', "<Text>{'Start Training'}</Text>"],
    ['a template child', '<Text>{`Level ${n}`}</Text>'],
    ['a ternary child', "<Text>{on ? 'Show names' : 'Hide names'}</Text>"],
    ['a spoken label', '<Pressable accessibilityLabel="Close" />'],
    ['a template label', '<Pressable accessibilityLabel={`Score: ${n}`} />'],
    ['a ternary label', "<Pressable accessibilityLabel={on ? 'Show as list' : 'Show as cards'} />"],
    ['a custom label prop', '<View label="Study This Squad" />'],
    ['a hint', '<Pressable accessibilityHint="Reveals the name" />'],
  ])('%s', async (_, jsx) => {
    expect(await hits(jsx)).toBeGreaterThan(0);
  });

  it.each([
    ['catalog text', '<Text>{t.a}</Text>'],
    ['punctuation', "<Text>‹ {t.a}{' · '}/{n}</Text>"],
    [
      'props never shown or spoken',
      '<Pressable testID="x-close" accessibilityRole="button" pointerEvents="none" />',
    ],
    ['a ternary enum', "<Pressable accessibilityRole={on ? 'button' : undefined} />"],
    ['a joined line', "<Text>{[t.a, t.a].join(' · ')}</Text>"],
  ])('passes %s', async (_, jsx) => {
    expect(await hits(jsx)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run i18n/__tests__/jsxLiterals.test.ts`
Expected: the first block FAILs (0 hits), because no rule is configured yet.

- [ ] **Step 3: Add the rules to `eslint.config.js`**

```js
// User-visible text lives in i18n/ (#142). jsx-no-literals catches JSX text
// and string children; its own attribute option can't tell a label from an
// enum, so attributes go through no-restricted-syntax: a lettered string in
// any prop fails unless the prop is on this list of props that are never
// shown or spoken. A new enum prop fails until it is added here — on purpose.
const SILENT_PROPS = [
  'key',
  'testID',
  'nativeID',
  'accessibilityRole',
  'accessibilityLabelledBy',
  'accessibilityLiveRegion',
  'importantForAccessibility',
  'pointerEvents',
  'style',
  'variant',
  'size',
  'contentFit',
  'cachePolicy',
  'keyboardShouldPersistTaps',
  'autoCapitalize',
  'returnKeyType',
  'decelerationRate',
  'animationType',
  'gradient',
  'lineTone',
  'gridKey',
];
const shownProp = `JSXAttribute:not([name.name=/^(${SILENT_PROPS.join('|')})$/])`;
const wordy =
  ':matches(Literal[value=/[A-Za-z]/], TemplateLiteral:has(TemplateElement[value.raw=/[A-Za-z]/]))';
const branch = ':matches(ConditionalExpression, LogicalExpression)';
const useCatalog = 'User-visible text comes from the i18n catalog: `const t = useT()`.';
```

Then add this entry to the `defineConfig([...])` array after the existing one:

```js
  {
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, allowedStrings: ['·', '›', '‹', '/', '—', '?'] },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: `${shownProp} > Literal[value=/[A-Za-z]/]`, message: useCatalog },
        { selector: `${shownProp} > JSXExpressionContainer > ${wordy}`, message: useCatalog },
        {
          selector: `${shownProp} > JSXExpressionContainer > ${branch} > ${wordy}`,
          message: useCatalog,
        },
        {
          selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > ${branch} > ${wordy}`,
          message: useCatalog,
        },
      ],
    },
  },
```

- [ ] **Step 4: Run the test, then lint the app**

Run: `npx vitest run i18n/__tests__/jsxLiterals.test.ts && npm run lint`

Expected: the test passes, and lint reports no `jsx-no-literals` or `no-restricted-syntax` errors.

If lint flags a real string, move it to `en.ts`. If it flags punctuation that renders today, add that glyph to `allowedStrings`. If it flags an enum prop, add the prop to `SILENT_PROPS`. Record any additions in the PR.

- [ ] **Step 5: Commit**

```bash
npx prettier --write eslint.config.js i18n
git add eslint.config.js i18n
git commit -m "feat(i18n): lint fails a hard-coded JSX string (#142)"
```

### Task 14: CLAUDE.md, the shots, and PR 2

- [ ] **Step 1: Add the strings rule to `CLAUDE.md`**

Under `## Architecture rules`, after the Theming bullet:

```markdown
- **User-visible text lives in `i18n/`.** `i18n/en.ts` is the source catalog and
  `Messages = typeof en`; every other catalog is typed `: Messages`, so a missing or
  extra key, or a parameter of the wrong type, fails the typecheck. Screens read text through
  `useT()`. `lib/` modules that build text take `messages` as their last argument
  and stay React-free. Data stays English: squads, players, clubs and position
  codes are translated at display time by code, never by their English string.
  _Escuadra_ and _a la escuadra_ come from `i18n/names.ts` and are never
  translated. `npm run lint` fails a hard-coded string in `app/` or
  `components/` JSX; a prop that is never shown or spoken goes on
  `SILENT_PROPS` in `eslint.config.js`.
```

- [ ] **Step 2: Regenerate the shots**

Run: `npm run shots`

Expected:

- every PNG is unchanged (the About sentence changed in PR 1).

Open every PNG that changed and compare it with `main`. An unexplained change is a bug: find it before going on.

- [ ] **Step 3: Full check**

Run: `nvm use && npm run check`
Expected: exit 0. Keep the tail for the PR.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md design/screens
git commit -m "docs(claude): user-visible text lives in i18n/ (#142)"
```

- [ ] **Step 5: Ask the owner, then open PR 2**

Ask: "PR 2 of #142 is ready: push and open it?" Only on a yes, push and `gh pr create` with:

- `Closes #142`;
- the lint design (Decision 2) and the reviewed exceptions from Task 12;
- the screenshot comparison;
- the `npm run check` tail;
- follow-ups for later issues:
  - a paragraph-count parity test for translated About (#145/#146);
  - `scripts/capture-screens.mjs` clicks by English text (`getByText`), which #145 must replace with `testID`s before capturing other languages.

End with the session's attribution line.
