# About and privacy pages in five languages, and language in telemetry (#146) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** About and its Privacy section are translated into all five languages, the launch signal carries the app's language, and the privacy section is rendered word for word into five linked web pages for `gh-pages`.

**Architecture:**

- About's words stay in the catalogs: `en.about`, and from this issue on one `about` per language.
- The few texts the web page needs around the privacy section (page title, "Last updated", nav, theme toggle) also live in the catalogs, under `about.site`. They are never shown in the app.
- One line exists only in a translation: "This is a translation…". It lives in `i18n/translationNotice.ts`, so English has none.
- A pure renderer, `scripts/privacy-pages.ts`, turns a catalog into one HTML page. A Vitest run writes the five pages (the review sheet's pattern), and a separate PR puts them on `gh-pages`.

**Tech Stack:** TypeScript 6 strict (`noUncheckedIndexedAccess`), Vitest 5 (node), Expo SDK 57 / React Native 0.86, `expo-localization`, static HTML on GitHub Pages.

**Spec:**

- Issue #146 is the work list. Its comment settles the switch wording: the owner chose **option 1**, one wording true in the app and on the web, "…off on the app's About screen."
- Issue #141 is the design reference: "Translation", "Telemetry", "Release".
- Previous plan: `docs/superpowers/plans/2026-10-18-i18n-translations.md` (rules, glossary, review sheet).

**Delivery:** two PRs, opened only after the owner says so.

| PR  | Branch                                     | Base       | Merges when                                                                 |
| --- | ------------------------------------------ | ---------- | --------------------------------------------------------------------------- |
| A   | `feat/146-privacy-pages` (already created) | `main`     | review, as usual (nothing ships from `main`)                                |
| B   | `docs/146-privacy-pages`                   | `gh-pages` | the 2.0.0 build reaches users, and the store declarations are updated (#55) |

PR B stays a draft until then. It is built from PR A's generator, so it is opened after PR A merges.

## Global Constraints

- **Word for word (guardrail 4).** Each privacy page shows its catalog's `about.privacy` texts exactly, plus that language's translation notice. Nothing is added, dropped or reworded between the app and the page.
- **The switch sentence:** `…unless you switch "${USAGE_STATISTICS}" off on the app's About screen.` The same wording is used in every language, each with its own switch label in quotes.
- **The English source is `en.about` in `i18n/en.ts` as it stands after the English language review (five rounds, owner-approved, 2026-10-19).** Translate what it says now; #146's original wording was amended there.
  - Notice (drafted in each language): `This is a translation. If it differs from the English text, the English text applies.`
- Already in `en.ts`, from #143: "nine things" and "your language choice". Do not add them twice.
- **Never translated:** _Escuadra_ and _a la escuadra_ (`i18n/names.ts`). Also left as they are: TelemetryDeck, Wikimedia Commons, Wikimedia Foundation, Wikipedia, Wikidata, Expo, flagpedia.net, Unicode CLDR, and licence names (CC BY-SA, CC BY, CC0, SIL Open Font License 1.1, Unicode License).
- **The rules of #145 still hold:**
  - French no-break space U+00A0 before `? ! : ;` and inside `« »`.
  - `’` (U+2019) in French and Italian.
  - Each catalog's existing form of address.
  - A team or country name never sits where it needs an article or case ending.
- **Every new or changed text passes the language review gate** (below) before it is committed. That includes English and the `about.site` texts.
- **Telemetry:** `'app.launched': ['language', 'languageSource']`, typed `{ language: Language; languageSource: 'phone' | 'picked' }`. Nothing else is added to the allowlist.
- **No new npm scripts and no new dependencies.** The pages are written by a Vitest run, as the review sheet is.
- **Tests:** `i18n/` tests go in `i18n/__tests__/`. `scripts/` tests sit beside their code, like `scripts/i18n-review-sheet.test.ts`. `lib/telemetryEvents.test.ts` stays beside its code: `lib/` has not moved over yet.
- Run `npm run check` before reporting any task complete.

## The language review gate

The owner asked for every text to be checked by a careful language expert before it lands. This gate is that check. It does not replace the human native sign-off: issue #146 still needs "The #145 reviewers sign off the About and privacy text" before PR B merges.

**When:** for every text this plan adds or changes, in every language, English included, before the commit that adds it.

**How:**

1. The controller dispatches **one fresh `general-purpose` subagent per language**, using the brief below. The reviewer never sees the translator's reasoning, only the texts.
2. Each finding is resolved:
   - Wording, grammar, typography, terminology: apply the reviewer's proposal, or a better fix.
   - Meaning (a finding that would say something the English does not, or change what the English says): **stop and ask the owner**. This is privacy and legal text (guardrail 7).
3. Re-dispatch a **fresh** reviewer on the corrected texts. Repeat until a review comes back with `No findings.`
4. The commit message lists what the review changed, as #145's review-pass commits did. It ends with "Language review: subagent, not a native sign-off."

**Reviewer brief.** The controller fills the `<…>` slots and pastes the result as the subagent's prompt.

```markdown
You are a senior <LANGUAGE> editor and translator. You are a native speaker,
and you specialise in consumer privacy policies and mobile-app text. You also
know how football fans talk. Review the texts below. Do not edit any file;
reply with findings only.

Context: Escuadra is a football squad memorisation app. These texts are its
About screen and its privacy policy. The Privacy section is shown in the app
AND published word for word on a web page, so it must read correctly in both
places. <For a translation: "The English text is the legally governing one;
the translation must say exactly what it says: no more, no less, no softer,
no stronger.">

Fixed terms (must appear exactly like this):

- Never translated: Escuadra, a la escuadra, TelemetryDeck, Wikimedia Commons,
  Wikimedia Foundation, Wikipedia, Wikidata, Expo, flagpedia.net, Unicode CLDR,
  CC BY-SA, CC BY, CC0, SIL Open Font License 1.1, Unicode License.
- App labels quoted in these texts, which must match the app exactly:
  <list: the usage-statistics switch label, the "Photo credits" label, the
  "cropped" word, each from i18n/<lang>.ts>
- Form of address used everywhere else in the app: <tu / du / tú / tu / you>.
- <French only: no-break space U+00A0 before ? ! : ; and inside « »;
  apostrophe ’ (U+2019).> <Italian only: apostrophe ’ (U+2019).>

Check every text for:

1. Fidelity: back-translate each paragraph into English in your head and
   compare it with the source. Report anything added, dropped, softened,
   strengthened or made ambiguous. Lists must keep every item, and counts
   ("nine things") must match the list.
2. Correctness: grammar, spelling, agreement, punctuation, typography.
3. Register: plain, precise privacy-policy language. It should be neither
   legalese nor chatty, and it should be consistent with the app's form of
   address.
4. Terminology: the same thing is called the same thing every time, and the
   quoted labels match the app exactly.
5. Web-readiness: flag any wording that only makes sense inside the app
   ("this screen", "above", "tap here") in the Privacy section.
6. Naturalness: would a careful native writer phrase it this way?

Reply with a Markdown table, one row per finding:
| path | problem | kind (meaning / wording / typography / terminology) | proposed text |
Then one line: "No findings." if there are none. Do not pad with praise.

ENGLISH SOURCE (path → text):
<paste>

<LANGUAGE> TEXT UNDER REVIEW (path → text):
<paste>
```

To produce the "path → text" lists, run `REVIEW_SHEET=<lang> npx vitest run scripts/i18n-review-sheet.test.ts`. Task 3 makes this sheet include About, so the list is the `about.` rows of `design/play/<lang>/review.md`. Then append the translation notice from `i18n/translationNotice.ts`.

## Decisions to confirm with the owner

1. **The translation notice lives in `i18n/translationNotice.ts`, not in the catalogs.** The catalog tests require every catalog to have English's shape, and to be empty exactly where English is. A line that only translations have cannot meet both. The About screen and the generator both read it from the module, so they still match word for word.
2. **The page's surrounding text (`about.site`) lives in the catalogs.** It is never shown in the app, but `store.tagline` sets the precedent. Keeping it there means the parity, untranslated-text and review-sheet tests cover it with no extra work.
3. **Per-language "later" paths.** `isLater(path)` becomes `isLater(path, language)`, so each language's About is checked by the untranslated-text test as soon as its task lands.
4. **Flagged, not built:** `gh-pages` `index.html` says "No account. No ads. No data collected." and "Fully offline". Both stop being true when 2.0.0 ships TelemetryDeck and Wikimedia photos. This is marketing copy outside #146, so the plan does not change it. **Owner:** reword it in PR B, or open an issue so it lands before PR B merges.
5. **App Privacy and Data safety (Task 9's answer, for the PR):**
   - The two new properties describe the app's language setting. They are sent with the existing anonymous `app.launched` signal.
   - On Apple's side, they fall inside **Usage Data → Product Interaction** (not linked, not tracking, Analytics). On Google's side, **App activity → App interactions** (collected, not shared, Analytics).
   - #55 already declares both categories. **No category changes.** #55's update itself is still pending, and it must land before 2.0.0.

## File map

| File                                                                              | Responsibility                                                                |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `i18n/resolveLanguage.ts`                                                         | `LanguageSource`, `languageSource()`: pure                                    |
| `i18n/useT.ts`                                                                    | `launchLanguage()`: language and source, outside React, for the launch signal |
| `lib/telemetryEvents.ts` (+ test)                                                 | `app.launched` gains `language`, `languageSource`                             |
| `app/_layout.tsx`                                                                 | Sends them                                                                    |
| `i18n/en.ts`                                                                      | Switch wording, "app was opened" detail, CLDR credit, `about.site`            |
| `i18n/translationNotice.ts` (new)                                                 | The "this is a translation" line per language; `null` for English             |
| `i18n/leaves.ts`                                                                  | `LATER_PATHS` per language, `isLater(path, language)`                         |
| `i18n/__tests__/catalogs.test.ts`                                                 | Calls `isLater(path, language)`                                               |
| `i18n/__tests__/translations.test.ts`                                             | Calls `isLater(path, language)`, pins each language's notice                  |
| `scripts/i18n-review-sheet.ts` (+ test)                                           | Includes About once a language has translated it                              |
| `app/about.tsx`                                                                   | Shows the notice at the end of Privacy                                        |
| `scripts/privacy-pages.ts` (+ test, new)                                          | Renders one privacy page; the test writes all five on request                 |
| `i18n/{de,fr,es,it}.ts`                                                           | Their own `about`                                                             |
| `docs/license.md`                                                                 | The CLDR row                                                                  |
| `CLAUDE.md`                                                                       | Guardrails 4 and 7, the ⚠️ note, the i18n bullet                              |
| `gh-pages`: `privacy*.html`, `site.mjs`, `site.css`, `tests/verify-site.test.mjs` | PR B                                                                          |

---

### Task 1: the app's language in the launch signal

**Files:**

- Modify: `i18n/resolveLanguage.ts`, `i18n/useT.ts`, `lib/telemetryEvents.ts`, `app/_layout.tsx`
- Test: `i18n/__tests__/resolveLanguage.test.ts`, `lib/telemetryEvents.test.ts`

**Interfaces:**

- Produces: `type LanguageSource = 'phone' | 'picked'`, `languageSource(preference: LanguagePreference, resolved: Language): LanguageSource`, `launchLanguage(): { language: SupportedLanguage; languageSource: LanguageSource }`. `TelemetryProps['app.launched']` is `{ language: Language; languageSource: LanguageSource }`.

- [ ] **Step 1: Write the failing tests**

Append to `i18n/__tests__/resolveLanguage.test.ts`. Extend its import to `import { LANGUAGES, languageSource, resolveLanguage, SUPPORTED_LANGUAGES, type Language } from '../resolveLanguage';`.

```ts
describe('languageSource', () => {
  it('is phone when the app follows the phone', () => {
    expect(languageSource('system', 'de')).toBe('phone');
    expect(languageSource('system', 'en')).toBe('phone');
  });

  it('is picked when the language picked in the app is the one in use', () => {
    expect(languageSource('fr', 'fr')).toBe('picked');
    expect(languageSource('en', 'en')).toBe('picked');
  });

  it('is phone when a picked language is not supported and the phone decided', () => {
    expect(languageSource('it', 'en')).toBe('phone');
  });
});
```

In `lib/telemetryEvents.test.ts`, replace the `'returns an empty payload for a prop-less event'` test with:

```ts
it("sends the app's language and where it came from on launch", () => {
  expect(buildPayload('app.launched', { language: 'de', languageSource: 'phone' })).toEqual({
    language: 'de',
    languageSource: 'phone',
  });
});
```

and add, inside `describe('TELEMETRY_EVENTS', …)`:

```ts
it('lets the launch signal carry only the language and its source', () => {
  expect(TELEMETRY_EVENTS['app.launched']).toEqual(['language', 'languageSource']);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run i18n/__tests__/resolveLanguage.test.ts lib/telemetryEvents.test.ts`
Expected: FAIL: `languageSource is not a function`, and `app.launched` is `[]`.

- [ ] **Step 3: Implement**

`i18n/resolveLanguage.ts`, append:

```ts
/** Where the language in use came from, for the launch signal (#146). */
export type LanguageSource = 'phone' | 'picked';

/**
 * `'picked'` only when the language picked in the app is the one in use. A
 * picked language without a catalog falls back to the phone's, so that is
 * `'phone'`.
 */
export function languageSource(preference: LanguagePreference, resolved: Language): LanguageSource {
  return preference !== 'system' && preference === resolved ? 'picked' : 'phone';
}
```

`i18n/useT.ts`:

- Change its imports to:

  ```ts
  import { getLocales, useLocales } from 'expo-localization';
  ```

  and

  ```ts
  import {
    languageSource,
    resolveLanguage,
    SUPPORTED_LANGUAGES,
    type LanguageSource,
    type SupportedLanguage,
  } from './resolveLanguage';
  ```

- Append:

  ```ts
  /** The language in use and where it came from, read outside React for the
   *  launch signal. Same resolution as `useLanguage()`. */
  export function launchLanguage(): {
    language: SupportedLanguage;
    languageSource: LanguageSource;
  } {
    const preference = useProgress.getState().languagePreference;
    const language = resolveLanguage(
      preference,
      getLocales().map((locale) => locale.languageTag),
      SUPPORTED_LANGUAGES,
    );
    return { language, languageSource: languageSource(preference, language) };
  }
  ```

`lib/telemetryEvents.ts`:

- Add `import type { Language, LanguageSource } from '@/i18n/resolveLanguage';`.
- Change `'app.launched': [],` to `'app.launched': ['language', 'languageSource'],`.
- Change `'app.launched': Record<string, never>;` to `'app.launched': { language: Language; languageSource: LanguageSource };`.

`app/_layout.tsx`:

- Add `import { launchLanguage } from '@/i18n/useT';`.
- Change `track('app.launched');` to `track('app.launched', launchLanguage());`.
- Change the comment line `// no-op when one already exists. Then one launch signal per JS launch.` to `// no-op when one already exists. Then one launch signal per JS launch, with the language as resolved now that the preference is back.`.

- [ ] **Step 4: Run them to see them pass, then the typecheck**

Run: `npx vitest run i18n/__tests__/resolveLanguage.test.ts lib/telemetryEvents.test.ts && npm run typecheck`
Expected: PASS. `track`'s rest-parameter type now requires the props, so a forgotten call site fails the typecheck.

- [ ] **Step 5: Commit**

```bash
git add i18n/resolveLanguage.ts i18n/useT.ts lib/telemetryEvents.ts lib/telemetryEvents.test.ts i18n/__tests__/resolveLanguage.test.ts app/_layout.tsx
git commit -m "feat(telemetry): the launch signal carries the app's language and its source (#146)"
```

---

### Task 2: the English texts, and the page's surrounding texts

**Files:**

- Modify: `i18n/en.ts` (the `about` block), `i18n/{de,fr,es,it}.ts` (nothing: they still set `about: en.about`), `docs/license.md`
- Test: `npm run test` (parity, budgets), plus the language review gate (English)

**Interfaces:**

- Produces: `en.about.credits.sections[3]` (Country names), and `en.about.site`:

  ```ts
  {
    title: string;
    updated: (date: string) => string;
    home: string;
    languages: string;
    nav: {
      home: string;
      support: string;
    }
    theme: {
      light: string;
      dark: string;
      toLight: string;
      toDark: string;
    }
    releaseStatus: string;
  }
  ```

- [ ] **Step 1: Change the English texts**

In `i18n/en.ts`, inside `about.privacy.sections`, the "Anonymous usage statistics" section:

- In the first paragraph, replace `off at the top of this screen.` with `off on the app's About screen.`.
- In the second paragraph, replace `The statistics are: the app was opened; a round started,` with `The statistics are: the app was opened, with its language and whether that language follows your phone's setting or was chosen in the app; a round started,`.

In `about.credits.sections`, after the "Flags and fonts" entry, add:

```ts
        {
          heading: 'Country names',
          paragraphs: [
            'Most country names in languages other than English come from the Unicode CLDR project and are used under the Unicode License.',
          ],
        },
```

After `privacy: { … },` (the last key of `about`), add:

```ts
    /** The web privacy pages (#146), rendered by scripts/privacy-pages.ts.
     *  Never shown in the app. The page's nav uses `privacy.heading`. */
    site: {
      /** The page's title and heading. */
      title: 'Privacy policy',
      updated: (date: string) => `Last updated: ${date}`,
      /** The spoken name of the Escuadra link in the header. */
      home: `${ESCUADRA} home`,
      /** The spoken name of the list of languages. */
      languages: 'Language',
      nav: { home: 'Home', support: 'Support' },
      theme: {
        light: 'Light',
        dark: 'Dark',
        toLight: 'Switch to light theme',
        toDark: 'Switch to dark theme',
      },
      releaseStatus: 'Now on the App Store',
    },
```

- [ ] **Step 2: Run the catalog tests**

Run: `npx vitest run i18n`
Expected: PASS. The four other catalogs still point at `en.about`, so parity holds.

- [ ] **Step 3: Language review gate, English**

Dispatch the reviewer brief with LANGUAGE = English. Paste the whole `about` block as both source and text under review. For English, the brief's fidelity check becomes: "check that each sentence says what Escuadra does. The code facts are: launch signal carries the language and whether it follows the phone or was picked; nothing else changed." Resolve findings as the gate says. Any meaning change goes to the owner.

- [ ] **Step 4: Add the CLDR row to `docs/license.md`**

In the "What Escuadra ships" table, after the "National flags" row, add:

```markdown
| Country names (es, fr, it, de) | Unicode License v3 (Unicode CLDR) | `i18n/countries.ts`, `scripts/seed-country-names.ts` |
```

Re-align the table with `npx prettier --write docs/license.md`. In "Where the app says it", change `flags, fonts —` to `flags, fonts, country names —`.

- [ ] **Step 5: Run the checks and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add i18n/en.ts docs/license.md
git commit -m "feat(about): the switch sentence works on the web, the launch signal's language, the CLDR credit (#146)"
```

---

### Task 3: the translation notice, per-language "later" paths, About in the review sheet

**Files:**

- Create: `i18n/translationNotice.ts`
- Modify: `i18n/leaves.ts`, `i18n/__tests__/catalogs.test.ts`, `i18n/__tests__/translations.test.ts`, `scripts/i18n-review-sheet.ts`, `scripts/i18n-review-sheet.test.ts`, `app/about.tsx`

**Interfaces:**

- Produces: `translationNotice(language: SupportedLanguage): string | null`, `LATER_PATHS: Readonly<Record<Language, readonly string[]>>`, `isLater(path: string, language: Language): boolean`.

- [ ] **Step 1: Write the failing tests**

In `i18n/__tests__/translations.test.ts`:

- Add `import { translationNotice } from '../translationNotice';`.
- Add to `interface Facts`:

  ```ts
  /** The last line of a translated privacy text (#141): the English text governs. */
  translationNotice: string | null;
  ```

- Give every entry of `FACTS` its value. These are drafts; each language's review gate in Tasks 5–8 may change them, together with the module:

  ```ts
  // en
  translationNotice: null,
  // de
  translationNotice: 'Dies ist eine Übersetzung. Weicht sie vom englischen Text ab, gilt der englische Text.',
  // fr (no-break space U+00A0 before nothing here: no ? ! : ;)
  translationNotice: 'Ceci est une traduction. En cas de divergence avec le texte anglais, c’est le texte anglais qui fait foi.',
  // es
  translationNotice: 'Esta es una traducción. Si difiere del texto en inglés, prevalece el texto en inglés.',
  // it
  translationNotice: 'Questa è una traduzione. In caso di differenze rispetto al testo inglese, prevale il testo inglese.',
  ```

- Add, inside `describe.each(SUPPORTED_LANGUAGES)`:

  ```ts
  it('ends a translated privacy text with the notice that English governs', () => {
    expect(translationNotice(language)).toBe(facts.translationNotice);
  });
  ```

- Change the French spacing filter's `!isLater(leaf.path)` to `!isLater(leaf.path, language)`.

In `i18n/__tests__/catalogs.test.ts`, change `!isLater(leaf.path) &&` to `!isLater(leaf.path, language) &&`.

In `scripts/i18n-review-sheet.test.ts`, replace the `'leaves About and the store tagline to #146 and #147'` test with:

```ts
it('leaves out what a language has not translated yet', () => {
  expect(reviewSheet('de')).not.toContain('| store.');
});

it('includes About once a language has translated it', () => {
  expect(sheet).toContain('| about.privacy.heading | Privacy | Privacy |  |');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run i18n scripts/i18n-review-sheet.test.ts`
Expected: FAIL: `../translationNotice` cannot be resolved, and `isLater` ignores its second argument.

- [ ] **Step 3: Implement**

`i18n/translationNotice.ts`:

```ts
// The line that ends each translated privacy text (#141, "Translation"): the
// English text governs. Shown at the end of About's Privacy section and of
// that language's privacy page, so the two match word for word. English has
// none. Kept out of the catalogs, which must have English's shape.
import type { SupportedLanguage } from './resolveLanguage';

const NOTICES: Readonly<Record<Exclude<SupportedLanguage, 'en'>, string>> = {
  de: 'Dies ist eine Übersetzung. Weicht sie vom englischen Text ab, gilt der englische Text.',
  fr: 'Ceci est une traduction. En cas de divergence avec le texte anglais, c’est le texte anglais qui fait foi.',
  es: 'Esta es una traducción. Si difiere del texto en inglés, prevalece el texto en inglés.',
  it: 'Questa è una traduzione. In caso di differenze rispetto al testo inglese, prevale il testo inglese.',
};

export function translationNotice(language: SupportedLanguage): string | null {
  return language === 'en' ? null : NOTICES[language];
}
```

`i18n/leaves.ts`: replace `LATER_PATHS` and `isLater` with the version below. Add `import type { Language } from './resolveLanguage';`.

```ts
/** What a language has not translated yet: About and privacy (#146) and the
 *  store listing (#147). Each language drops `about.` when its About lands. */
export const LATER_PATHS: Readonly<Record<Language, readonly string[]>> = {
  en: [],
  de: ['about.', 'store.'],
  fr: ['about.', 'store.'],
  es: ['about.', 'store.'],
  it: ['about.', 'store.'],
};

export function isLater(path: string, language: Language): boolean {
  return LATER_PATHS[language].some((prefix) => path.startsWith(prefix));
}
```

`scripts/i18n-review-sheet.ts`:

- Change `.filter((leaf) => !isLater(leaf.path) && leaf.text !== '')` to `.filter((leaf) => !isLater(leaf.path, language) && leaf.text !== '')`.
- Change the comment above it to `// A path the language has not translated yet, or one with no English text: nothing to review.`.

`app/about.tsx`:

- Add `import { translationNotice } from '@/i18n/translationNotice';`.
- Change `import { useT } from '@/i18n/useT';` to `import { useLanguage, useT } from '@/i18n/useT';`.
- Add `const notice = translationNotice(useLanguage());` after `const t = useT();`.
- Then read the Privacy section's JSX (from the `{t.about.privacy.sections.map(` line, about line 158, to the section card's closing `</View>`). Right before that closing `</View>`, add:

  ```tsx
  {
    notice && <Text style={styles.paragraph}>{notice}</Text>;
  }
  ```

  Match the indentation of the `sections.map` line.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run i18n scripts/i18n-review-sheet.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add i18n/translationNotice.ts i18n/leaves.ts i18n/__tests__ scripts/i18n-review-sheet.ts scripts/i18n-review-sheet.test.ts app/about.tsx
git commit -m "feat(i18n): the translation notice, and About in each language's review once translated (#146)"
```

---

### Task 4: the privacy-page generator

**Files:**

- Create: `scripts/privacy-pages.ts`, `scripts/privacy-pages.test.ts`

**Interfaces:**

- Consumes: `CATALOGS`, `translationNotice()`, `LANGUAGE_NAMES`, `ESCUADRA`, `CalendarDate` (from `@/i18n/en`), `en.about.site`.
- Produces: `PAGE_FILES: Record<SupportedLanguage, string>`, `SITE_URL`, `escapeHtml(text: string): string`, `privacyPage(language: SupportedLanguage, updated: CalendarDate): string`. Running `PRIVACY_PAGES=<dir> PRIVACY_UPDATED=YYYY-MM-DD npx vitest run scripts/privacy-pages.test.ts` writes the five files into `<dir>`.

- [ ] **Step 1: Write the failing test**

`scripts/privacy-pages.test.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from '@/i18n/catalogs';
import { SUPPORTED_LANGUAGES } from '@/i18n/resolveLanguage';
import { translationNotice } from '@/i18n/translationNotice';
import { escapeHtml, PAGE_FILES, privacyPage, SITE_URL } from './privacy-pages';

const updated = { day: 21, month: 10, year: 2026 };

describe.each(SUPPORTED_LANGUAGES)('the %s privacy page', (language) => {
  const html = privacyPage(language, updated);
  const paragraphs = [...html.matchAll(/<p>(.*?)<\/p>/gs)].map(([, inner]) => inner);

  it("reproduces its catalog's privacy paragraphs exactly, and nothing else", () => {
    const { privacy } = CATALOGS[language].about;
    const notice = translationNotice(language);
    expect(paragraphs).toEqual([
      `<strong>${escapeHtml(privacy.lead)}</strong>`,
      ...privacy.paragraphs.map(escapeHtml),
      ...privacy.sections.flatMap((section) => section.paragraphs.map(escapeHtml)),
      ...(notice ? [`<em>${escapeHtml(notice)}</em>`] : []),
    ]);
  });

  it('heads each section with its catalog heading', () => {
    const headings = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map(([, inner]) => inner);
    expect(headings).toEqual(
      CATALOGS[language].about.privacy.sections.map((section) => escapeHtml(section.heading)),
    );
  });

  it('declares its language and its alternates', () => {
    expect(html).toContain(`<html lang="${language}">`);
    for (const other of SUPPORTED_LANGUAGES) {
      expect(html).toContain(
        `<link rel="alternate" hreflang="${other}" href="${SITE_URL}${PAGE_FILES[other]}" />`,
      );
    }
    expect(html).toContain(
      `<link rel="alternate" hreflang="x-default" href="${SITE_URL}${PAGE_FILES.en}" />`,
    );
  });

  it('links every language, marking its own', () => {
    for (const other of SUPPORTED_LANGUAGES) {
      expect(html).toContain(`href="${PAGE_FILES[other]}" hreflang="${other}" lang="${other}"`);
    }
    expect(html).toMatch(new RegExp(`href="${PAGE_FILES[language]}"[^>]*aria-current="page"`));
  });
});

describe('escapeHtml', () => {
  it('escapes what HTML would read as markup', () => {
    expect(escapeHtml(`a < b & "c" > d`)).toBe('a &lt; b &amp; &quot;c&quot; &gt; d');
  });
});

// `PRIVACY_PAGES=<dir> PRIVACY_UPDATED=2026-10-21 npx vitest run
// scripts/privacy-pages.test.ts` writes the five pages into <dir> (a gh-pages
// worktree). Skipped in a normal run.
const out = process.env.PRIVACY_PAGES;
it.runIf(out !== undefined)('writes the five privacy pages', () => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(process.env.PRIVACY_UPDATED ?? '');
  if (!match) throw new Error('PRIVACY_UPDATED=YYYY-MM-DD: the date the pages go live');
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const dir = path.resolve(out ?? '');
  mkdirSync(dir, { recursive: true });
  for (const language of SUPPORTED_LANGUAGES) {
    writeFileSync(path.join(dir, PAGE_FILES[language]), privacyPage(language, date));
  }
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run scripts/privacy-pages.test.ts`
Expected: FAIL: `./privacy-pages` cannot be resolved.

- [ ] **Step 3: Implement**

`scripts/privacy-pages.ts`. The `<head>` script and the header and footer copy `gh-pages`' current `privacy.html`. Only its texts come from the catalog, and it gains the language list and the alternates.

```ts
// The web privacy pages (#146): About's Privacy section, word for word, in
// every language, for gh-pages (CLAUDE.md guardrail 4). Written by
// `PRIVACY_PAGES=<dir> PRIVACY_UPDATED=YYYY-MM-DD npx vitest run
// scripts/privacy-pages.test.ts` — a Vitest run, because Node alone cannot
// load the catalogs' extensionless imports.
import { CATALOGS } from '@/i18n/catalogs';
import type { CalendarDate } from '@/i18n/en';
import { ESCUADRA, ESCUADRA_WORDMARK, LANGUAGE_NAMES } from '@/i18n/names';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/resolveLanguage';
import { translationNotice } from '@/i18n/translationNotice';

export const SITE_URL = 'https://tovmassian.github.io/escuadra/';

export const PAGE_FILES: Readonly<Record<SupportedLanguage, string>> = {
  en: 'privacy.html',
  es: 'privacy.es.html',
  fr: 'privacy.fr.html',
  it: 'privacy.it.html',
  de: 'privacy.de.html',
};

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const THEME_SCRIPT = `    <script>
      try {
        const saved = localStorage.getItem('escuadra-site-theme');
        const theme =
          saved === 'light' || saved === 'dark'
            ? saved
            : matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
        document.documentElement.dataset.theme = theme;
      } catch {
        document.documentElement.dataset.theme = matchMedia(
          '(prefers-color-scheme: dark)',
        ).matches
          ? 'dark'
          : 'light';
      }
      document.documentElement.dataset.js = 'true';
    </script>`;

export function privacyPage(language: SupportedLanguage, updated: CalendarDate): string {
  const t = CATALOGS[language];
  const { privacy, site } = t.about;
  const e = escapeHtml;
  const notice = translationNotice(language);
  const p = (text: string) => `      <p>${e(text)}</p>`;

  const alternates = [
    ...SUPPORTED_LANGUAGES.map(
      (other) =>
        `    <link rel="alternate" hreflang="${other}" href="${SITE_URL}${PAGE_FILES[other]}" />`,
    ),
    `    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${PAGE_FILES.en}" />`,
  ];
  const languageLinks = SUPPORTED_LANGUAGES.map((other) => {
    const current = other === language ? ' aria-current="page"' : '';
    return `<a href="${PAGE_FILES[other]}" hreflang="${other}" lang="${other}"${current}>${e(LANGUAGE_NAMES[other])}</a>`;
  }).join('');

  return [
    '<!doctype html>',
    `<html lang="${language}">`,
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <link rel="icon" type="image/x-icon" href="assets/favicon.ico" />',
    `    <title>${e(site.title)} — ${ESCUADRA}</title>`,
    `    <link rel="canonical" href="${SITE_URL}${PAGE_FILES[language]}" />`,
    ...alternates,
    THEME_SCRIPT,
    '    <link rel="stylesheet" href="site.css" />',
    '    <script type="module" src="site.mjs"></script>',
    '  </head>',
    '  <body>',
    '    <header class="site-header shell">',
    `      <a class="brand" href="index.html" aria-label="${e(site.home)}">`,
    '        <span class="brand-mark" aria-hidden="true">',
    '          <img src="assets/favicon.ico" />',
    '        </span>',
    `        <span>${ESCUADRA_WORDMARK}</span>`,
    '      </a>',
    '      <nav aria-label="Utility">',
    `        <a href="${PAGE_FILES[language]}">${e(privacy.heading)}</a><a href="support.html">${e(site.nav.support)}</a>`,
    '      </nav>',
    '      <button',
    '        type="button"',
    '        class="theme-toggle"',
    '        data-theme-toggle',
    `        data-label-light="${e(site.theme.light)}"`,
    `        data-label-dark="${e(site.theme.dark)}"`,
    `        data-label-to-light="${e(site.theme.toLight)}"`,
    `        data-label-to-dark="${e(site.theme.toDark)}"`,
    '        aria-pressed="false"',
    '      >',
    '        <span class="theme-toggle-icon" aria-hidden="true">◐</span',
    '        ><span data-theme-toggle-label></span>',
    '      </button>',
    '    </header>',
    '    <main class="legal-page shell">',
    `      <nav class="language-nav" aria-label="${e(site.languages)}">${languageLinks}</nav>`,
    `      <h1>${e(site.title)}</h1>`,
    `      <p class="updated">${e(site.updated(t.formats.date(updated)))}</p>`,
    '',
    `      <p><strong>${e(privacy.lead)}</strong></p>`,
    ...privacy.paragraphs.map(p),
    ...privacy.sections.flatMap((section) => [
      '',
      `      <h2>${e(section.heading)}</h2>`,
      ...section.paragraphs.map(p),
    ]),
    ...(notice ? ['', `      <p><em>${e(notice)}</em></p>`] : []),
    '    </main>',
    '    <footer class="site-footer shell">',
    `      <span>&copy; ${ESCUADRA}</span>`,
    '      <nav aria-label="Footer">',
    `        <a href="index.html">${e(site.nav.home)}</a><a href="support.html">${e(site.nav.support)}</a>`,
    '      </nav>',
    `      <span class="release-status">${e(site.releaseStatus)}</span>`,
    '    </footer>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}
```

The test's `<p>…</p>` match counts `<p class="updated">` out, because it only matches a bare `<p>`. That is deliberate: the date line is not About text.

- [ ] **Step 4: Run it to see it pass, then write the pages once to look at them**

Run: `npx vitest run scripts/privacy-pages.test.ts`
Expected: PASS. The writer test is skipped.

Run: `PRIVACY_PAGES=$TMPDIR/privacy PRIVACY_UPDATED=2026-10-21 npx vitest run scripts/privacy-pages.test.ts && ls $TMPDIR/privacy`
Expected: five files. Open `privacy.html` and compare its `<main>` with `app/about.tsx`'s Privacy section in the English shot (`design/screens/01a-about.png`).

- [ ] **Step 5: Commit**

```bash
git add scripts/privacy-pages.ts scripts/privacy-pages.test.ts
git commit -m "feat(privacy): render About's Privacy section into five linked web pages (#146)"
```

---

### Tasks 5–8: About in Deutsch, Français, Español, Italiano

**One task per language, in this order: German (Task 5), French (Task 6), Spanish (Task 7), Italian (Task 8).** Each task follows the procedure below, with `<lang>` replaced. Each is a separate commit, so a reviewer can reject one language and keep the others.

**Files (per language):**

- Modify: `i18n/<lang>.ts` (its `about:`), `i18n/leaves.ts` (its `LATER_PATHS` entry), `i18n/__tests__/catalogs.test.ts` (its `SAME_AS_ENGLISH`, only if needed), `i18n/translationNotice.ts` and `i18n/__tests__/translations.test.ts` (only if the review changes the notice)

**Interfaces:**

- Consumes: `en.about`, including `about.site` (Task 2), `translationNotice` (Task 3), the review gate.
- Produces: `<lang>.about`, a full object of `Messages['about']`'s shape. No `en.about` references remain except `version` and `builtIn`, and only where the language truly shares them.

- [ ] **Step 1: Turn the language's About on in the tests**

In `i18n/leaves.ts`, change the language's entry to `['store.']`.

Run: `npx vitest run i18n/__tests__/catalogs.test.ts -t "<lang>"`
Expected: FAIL. "translates every text it does not share on purpose" lists every `about.` path.

- [ ] **Step 2: Draft the translation (translator subagent)**

Dispatch one fresh `general-purpose` subagent with this brief:

```markdown
Translate Escuadra's About screen into <LANGUAGE>, in i18n/<lang>.ts.

Read first: i18n/en.ts (the `about` block is the source; its comments are
instructions), i18n/<lang>.ts (the rest of the app, already reviewed: keep its
form of address, its terms and its typography), and the "Global Constraints"
and "The language review gate" sections of
docs/superpowers/plans/2026-10-19-i18n-about-privacy-pages.md.

Replace the line `about: en.about,` and its comment with a full `about: { … }`
object of the same shape: same keys, same order, same array lengths, same
function parameters. Rules:

- Interpolate `${ESCUADRA}` and `${A_LA_ESCUADRA}` exactly where English does.
  Never write them as literals.
- The usage-statistics switch label is quoted in the privacy text: quote the
  catalog's own label (define a const like en.ts's USAGE_STATISTICS if needed,
  and use it for `usageStatistics` too). Do the same for the "Photo credits"
  label and the "cropped" word, which the credits paragraph quotes: they must
  match this catalog's `photoCredit` texts exactly.
- Legal fidelity: say exactly what the English says. Nothing added, dropped,
  softened or strengthened. "nine things" must list nine things.
- Keep proper names and licence names as listed in Global Constraints.
- The Privacy section is also a web page: no wording that only works in the
  app.
- `site.*` are web-page labels: short and idiomatic for a website in
  <LANGUAGE>. `site.updated` is "Last updated: <date>".
  Then run `npx vitest run i18n` and fix what fails. Report the diff, and any
  sentence where you had to choose between two readings.
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run i18n scripts/i18n-review-sheet.test.ts scripts/privacy-pages.test.ts && npm run typecheck`
Expected: PASS.

If "translates every text it does not share on purpose" still lists a path the language rightly shares with English (for example `about.version` in German, "Version {1}"), add it to that language's `SAME_AS_ENGLISH` with a comment saying why. Proper names are not a reason to share a whole text.

- [ ] **Step 4: Language review gate**

Write the sheet: `REVIEW_SHEET=<lang> npx vitest run scripts/i18n-review-sheet.test.ts`. Take its `about.` rows, plus the notice from `i18n/translationNotice.ts`. Dispatch the reviewer brief, and loop until it returns `No findings.`. Meaning findings go to the owner.

If the review changes the notice, change it in `i18n/translationNotice.ts` and in `FACTS.<lang>.translationNotice` together.

- [ ] **Step 5: Shots of About in the language**

Run, with the web build running per CLAUDE.md: `npm run shots:play -- --lang=<lang>`
Then read `design/play/<lang>/01a-about*.png`, so the next reviewer sees the text in place. Check that headings and the switch row wrap cleanly, and that nothing is cut off. UI text is never truncated (#141). A text that does not fit is rewritten and sent back through Step 4.

- [ ] **Step 6: Commit**

```bash
git add i18n/<lang>.ts i18n/leaves.ts i18n/__tests__ i18n/translationNotice.ts
git commit -m "feat(i18n): About and privacy in <LANGUAGE NAME> (#146)

<what the language review changed, one line each>

Language review: subagent, not a native sign-off."
```

---

### Task 9: the docs say "privacy pages"

**Files:**

- Modify: `CLAUDE.md`, `docs/release.md`

- [ ] **Step 1: Edit `CLAUDE.md`**

- Guardrail 4: change `ships **together** with the updated privacy policy (the published page and the About screen text, word for word)` to `ships **together** with the updated privacy policy (the privacy pages and the About screen text, word for word)`.
- Guardrail 7: change `The Privacy section also reaches `privacy.html` word for word (guardrail 4).` to `The Privacy section also reaches the privacy pages word for word (guardrail 4), rendered by `scripts/privacy-pages.ts`.`
- The ⚠️ paragraph under "Releases": replace its first two sentences (from `**The About text on `main` now covers…` to `…word for word,`) with:

  ```markdown
  ⚠️ **The About text on `main` now covers TelemetryDeck, the Wikimedia photos
  and the app's language, in five languages (#54, #146), but the web policy has
  not caught up.** `gh-pages` still carries the old English `privacy.html`; #146's
  PR B replaces it with the five pages `scripts/privacy-pages.ts` renders,
  ```

  Keep the rest of that paragraph ("published when the first build…" onward). Re-read the paragraph so it is one grammatical sentence chain.

- The i18n bullet under "Architecture rules": change `About's words are `en.about`, kept as data that #146 renders into the privacy pages.` to:

  ```markdown
  About's words are each catalog's `about`. Its Privacy section, plus
  `i18n/translationNotice.ts` in a translation, is rendered word for word into
  `privacy.html` and `privacy.{es,fr,it,de}.html` by `scripts/privacy-pages.ts`.
  ```

- [ ] **Step 2: Edit `docs/release.md`**

Change `and the web privacy page: those change` (line 81) to `and the web privacy pages (`scripts/privacy-pages.ts`): those change`.

- [ ] **Step 3: Check and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add CLAUDE.md docs/release.md
git commit -m "docs: guardrails 4 and 7 name the five privacy pages (#146)"
```

---

### Task 10: regenerate the shots, verify, open PR A

- [ ] **Step 1: Regenerate the English design shots**

About's English text changed, so `design/screens/01a-about.png` is stale (CLAUDE.md, "after any change to a screen"). With the web build running: `npm run shots`. Commit only the changed About capture(s):

```bash
git add design/screens
git commit -m "chore(design): About shot after #146's text changes"
```

- [ ] **Step 2: Verify**

Use superpowers:verification-before-completion. Run `npm run check` and quote its output.

- [ ] **Step 3: Ask the owner, then open PR A**

Only on the owner's go-ahead: `git push -u origin feat/146-privacy-pages`, then `gh pr create --base main`. The body:

- the summary of the changes;
- "Closes" nothing: #146 closes with PR B;
- guardrails 4 and 7 flagged, as CLAUDE.md requires for a change to what leaves the device;
- Decision 5's App Privacy / Data safety answer;
- what each language review changed;
- a checklist for the human native sign-off per language, with each `design/play/<lang>/review.md`.

It ends with the attribution line from the session's system reminder.

---

### Task 11: the five pages on `gh-pages` (PR B, draft)

Starts after PR A merges.

**Files (on `gh-pages`):**

- Create: `privacy.es.html`, `privacy.fr.html`, `privacy.it.html`, `privacy.de.html`
- Modify: `privacy.html`, `site.mjs`, `site.css`, `tests/verify-site.test.mjs`

- [ ] **Step 1: A worktree on `gh-pages`**

```bash
git fetch origin
git worktree add .claude/worktrees/146-gh-pages -b docs/146-privacy-pages origin/gh-pages
```

- [ ] **Step 2: Write the failing site test**

In `.claude/worktrees/146-gh-pages/tests/verify-site.test.mjs`:

- Change `const pages = ['index.html', 'privacy.html', 'support.html'];` to:

  ```js
  const privacyPages = [
    'privacy.html',
    'privacy.es.html',
    'privacy.fr.html',
    'privacy.it.html',
    'privacy.de.html',
  ];
  const pages = ['index.html', ...privacyPages, 'support.html'];
  const siteUrl = 'https://tovmassian.github.io/escuadra/';
  ```

- Change `const allowedExternalLinks = [...]` to include `siteUrl`, for the `hreflang` and canonical links.
- In the per-page loop, change the privacy link check to `assert.match(html, /href="privacy(\.[a-z]{2})?\.html"/, `${page} links privacy`);`. A translated page links its own language's policy.
- Replace the `['privacy.html', 'Escuadra does not collect any personal data about you.']` entry with `['privacy.html', 'Escuadra has no account, no sign-in and no advertising']`.
- Append:

  ```js
  for (const page of privacyPages) {
    const html = readFileSync(page, 'utf8');
    assert.match(html, /<main/, `${page} has a main landmark`);
    assert.equal((html.match(/<h1/g) ?? []).length, 1, `${page} has exactly one h1`);
    for (const other of privacyPages) {
      assert.ok(html.includes(`href="${other}"`), `${page} links ${other}`);
      assert.ok(
        html.includes(`href="${siteUrl}${other}"`),
        `${page} declares ${other} as an alternate`,
      );
    }
    assert.match(html, /hreflang="x-default"/, `${page} declares the English page as the default`);
    assert.doesNotMatch(
      html,
      /does not collect any personal data/,
      `${page} carries the current policy`,
    );
  }
  for (const page of privacyPages.slice(1)) {
    assert.match(readFileSync(page, 'utf8'), /<p><em>/, `${page} ends with the translation notice`);
  }
  ```

Run: `cd .claude/worktrees/146-gh-pages && node tests/verify-site.test.mjs`
Expected: FAIL: `missing privacy.es.html`, or the old text.

- [ ] **Step 3: Generate the pages**

From the main checkout, on `main` after PR A has merged, with the date the 2.0.0 build reaches users:

```bash
PRIVACY_PAGES=.claude/worktrees/146-gh-pages PRIVACY_UPDATED=<YYYY-MM-DD> npx vitest run scripts/privacy-pages.test.ts
```

If that date is not known yet, use today's date. Regenerate with the real date before the PR is marked ready.

- [ ] **Step 4: The theme toggle reads its labels from the page**

In `site.mjs`, replace the two lines in `setTheme` that set `aria-label` and the label text with:

```js
const labels = toggle.dataset;
const next = nextTheme(theme);
toggle.setAttribute(
  'aria-label',
  (next === 'dark' ? labels.labelToDark : labels.labelToLight) ?? `Switch to ${next} theme`,
);
const label = toggle.querySelector('[data-theme-toggle-label]');
if (label) {
  label.textContent =
    (theme === 'dark' ? labels.labelDark : labels.labelLight) ??
    (theme === 'dark' ? 'Dark' : 'Light');
}
```

`index.html` and `support.html` carry no `data-label-*` attributes, so they keep the English fallback.

- [ ] **Step 5: Style the language list**

Read `site.css` for its custom properties (colour, spacing, type). Add a `.language-nav` rule under the `.legal-page` rules:

- a wrapping row of links with a small gap;
- the muted text colour;
- `[aria-current="page"]` in the primary text colour, without an underline.

Use only properties `site.css` already defines. Check the page at phone width (375 px) in both themes.

- [ ] **Step 6: Run the site test, then look at the pages**

Run: `cd .claude/worktrees/146-gh-pages && node tests/verify-site.test.mjs && node --test tests/theme.test.mjs`
Expected: PASS.

Serve the worktree (`npx serve .claude/worktrees/146-gh-pages`). Open each of the five pages, switch the theme and language, and check:

- the labels are in the page's language;
- the theme toggle works;
- the notice is last on the four translated pages.

- [ ] **Step 7: Commit, ask, open the draft**

```bash
cd .claude/worktrees/146-gh-pages
git add privacy*.html site.mjs site.css tests/verify-site.test.mjs
git commit -m "docs(site): the privacy policy in five languages, from the app's About text (#146)"
```

Only on the owner's go-ahead: push and run `gh pr create --draft --base gh-pages`. The body says:

- it merges when the 2.0.0 build reaches users, together with #55's declarations, and not before;
- Decision 4 (`index.html`'s "No data collected") must be settled first;
- it closes #146.

---

## Self-review against #146

| #146 item                                                 | Task                                        |
| --------------------------------------------------------- | ------------------------------------------- |
| About moves into the catalogs, five languages             | 5–8                                         |
| "nine things" + "your language choice"                    | already in `en.ts` (#143); 5–8 translate it |
| "the app was opened, with the app's language…"            | 2                                           |
| CLDR credit                                               | 2                                           |
| Translation notice at the end of each translated Privacy  | 3, 5–8                                      |
| `docs/license.md` CLDR entry                              | 2                                           |
| Telemetry `language`, `languageSource`, typed             | 1                                           |
| Generator, `hreflang`, each page links the others         | 4, 11                                       |
| `gh-pages` five pages; `verify-site` asserts the new text | 11                                          |
| CLAUDE.md guardrail 4 "the privacy pages"                 | 9                                           |
| App Privacy / Data safety answer recorded in the PR       | Decision 5, 10                              |
| #145 reviewers sign off                                   | PR A checklist; PR B waits                  |
| The issue comment's switch wording (owner chose option 1) | 2                                           |
| `lib/telemetryEvents.test.ts` covers the new properties   | 1                                           |
| Generator test: exact paragraphs                          | 4                                           |
| Published with the 2.0.0 build, not before                | PR B draft                                  |
| `npm run check` passes                                    | every task                                  |

---

## Part 2: the owner's decisions of 2026-10-19 (PR A follow-up, PR B, the telemetry epic)

The owner reviewed PR A (#155) and decided:

1. **Unicode License v3:** option A now. Commit the notice next to the data. An in-app licence sheet comes later, in its own issue.
2. **Release note:** rewrite the ⚠️ paragraph in the right order.
3. **Versioned privacy pages:** `privacy.html` stays alive as the 1.x policy, because both store listings link it today. The 2.0 policy lives under `privacy/2/`, and each store's URL is switched when that store ships 2.0.
4. **TelemetryDeck gaps:** the privacy text names the hashed identifier, the per-launch session code and the IP address. The telemetry epic (#52) and its TBC issues (#54, #55, #57) are revisited, and whatever code they still need lands in this PR or a PR stacked on it.
5. **Cropped wording:** as proposed below.

The owner is unavailable while this runs, so every change must be cheap and reversible: commits, draft PRs, issue edits. **Nothing is merged, released or published.**

### Task 12: English texts, the Unicode notice, the release note

**Files:** `i18n/en.ts`, `i18n/__tests__/catalogs.test.ts` (the hash), `i18n/UNICODE-LICENSE.txt` (new), `i18n/countries.ts` (header), `docs/license.md`, `CLAUDE.md`, `docs/release.md`

- [ ] **en.ts, `about.privacy.sections[2].paragraphs[0]`** (usage statistics) becomes:
      `${ESCUADRA} sends anonymous usage statistics to TelemetryDeck, an analytics service, unless you switch "${USAGE_STATISTICS}" off on the app's About screen. Each one carries a hashed form of a random identifier created for these statistics, separate from the one the app-update check uses, and a random session code that is new each time the app starts. Like any website, TelemetryDeck also receives your device's IP address with each one, and TelemetryDeck's own privacy policy applies to what it receives. The identifier and the session code are not linked to you, your device or your accounts, and neither they nor the statistics are shared with anyone else.`
- [ ] **en.ts, `about.privacy.sections[4].paragraphs[1]`** (what is stored): change `the identifier, which is sent with each statistic,` to `a hashed form of the identifier, which is sent with each statistic,`.
- [ ] **en.ts, `about.credits.sections[1].paragraphs[0]`** (player photos): change `Every photo is cropped to fit its frame.` to `Photos are cropped to fill the space they appear in. On the question screen, a photo too small to fill it is shown whole instead, over an enlarged, darkened copy of itself.`, and delete `A photo too small to fill the screen is shown whole, over a darkened copy of itself.` The rest is unchanged.
- [ ] **The pin.** Update the English About hash in `catalogs.test.ts`. The four translations follow in Task 14, in the same PR, which is what the pin asks for.
- [ ] **`i18n/UNICODE-LICENSE.txt`.** The Unicode License v3 notice, verbatim: "UNICODE LICENSE V3" through "SPDX-License-Identifier: Unicode-3.0". Take it from the ICU section of Node's own `LICENSE` (`$(dirname $(dirname $(which node)))/LICENSE`, about line 373), unindented. Put one line above it naming the source: `The country names in i18n/countries.ts for es, fr, it and de are derived from the Unicode CLDR project, under this licence:`.
- [ ] **countries.ts header.** Add `// The CLDR-derived names travel with Unicode's notice: ./UNICODE-LICENSE.txt.`
- [ ] **docs/license.md.**
  - The country-names row says the notice is in `i18n/UNICODE-LICENSE.txt`.
  - A sentence after the table says how the condition is met: the notice sits next to the data in the repo. For the app bundle, an in-app licences sheet is tracked in its own issue (Task 17 creates it).
- [ ] **CLAUDE.md, the ⚠️ paragraph** under "Releases" becomes:
  ```
  ⚠️ **2.0.0 changes what leaves the device, so its disclosures ship with its store
  build.** The About text on `main`, in all five catalogs, covers TelemetryDeck,
  the Wikimedia photos and the language sent with the launch signal (#54, #146).
  The web policy is versioned: `privacy.html` stays the 1.x policy that both store
  listings link today, and `privacy/2/` holds the 2.0 pages `scripts/privacy-pages.ts`
  renders. The order: every 2.0.0 issue lands on `main`, with the 2.0 pages signed
  off and #55's answers written; then `release/2.0.0` is cut and built (#116). At
  submission, App Privacy (before Apple review) and Data safety (when the build is
  uploaded) are updated, and each store's privacy URL moves to `privacy/2/` when
  that store ships 2.0.
  ```
- [ ] **CLAUDE.md, the i18n bullet.** Change `` into `privacy.html` and `privacy.{es,fr,it,de}.html` `` to ``into `privacy/2/` (`index.html`, `es.html`, `fr.html`, `it.html`, `de.html`)``, and rewrap.
- [ ] **docs/release.md.** The "web privacy pages" line also says the pages are versioned folders, and that a store's privacy URL moves when it ships the version.
- [ ] **Gate.** Run the English language gate on the three changed paragraphs and on the CLAUDE.md, release.md and license.md prose. Wording findings are applied. A meaning finding takes the smallest change that keeps the facts above, and is recorded as a ruling.

### Task 13: the versioned generator

**Files:** `scripts/privacy-pages.ts`, `scripts/privacy-pages.test.ts`, `i18n/en.ts`, `i18n/{de,fr,es,it}.ts` (two new `about.site` keys)

- [ ] **Two new `about.site` keys in every catalog:**
  - `appliesTo: (version: string) => `This policy applies to ${ESCUADRA} ${version} and later.``
  - `earlierVersions: 'Privacy policy for earlier versions'`
  - The implementer drafts the four translations; the language gates in Task 14 review them.
- [ ] **`scripts/privacy-pages.ts`:**
  - `POLICY_VERSION = '2.0'` and `POLICY_DIR = 'privacy/2/'`, with a comment: a version that changes what leaves the device gets a new folder, and a published folder is never edited after its version ships.
  - `PAGE_FILES` becomes `{ en: 'index.html', es: 'es.html', fr: 'fr.html', it: 'it.html', de: 'de.html' }`, inside `POLICY_DIR`.
  - The page URL is `${SITE_URL}${POLICY_DIR}` for English (the folder itself) and `${SITE_URL}${POLICY_DIR}${file}` for the others. The canonical link, the alternates and `x-default` use these.
  - Relative links between language pages use the file names.
  - Every site asset and page link outside the folder gets `../../`: favicon, `site.css`, `site.mjs`, `index.html`, `support.html`.
  - After `<p class="updated">`, add `<p class="applies">${e(site.appliesTo(POLICY_VERSION))} <a href="../../privacy.html">${e(site.earlierVersions)}</a></p>`.
- [ ] **Tests:**
  - Update the paths. The exact-paragraph test keeps matching bare `<p>` only.
  - Add tests that each page has the applies line with the earlier-versions link, and that every local `href`/`src` starts with `../../`, is a sibling page file, or is absolute.
  - The writer writes `<dir>/privacy/2/<file>`, creating the folders.

### Task 14: the four translations follow the English

**Files:** `i18n/{de,fr,es,it}.ts`

- [ ] Translate the three changed paragraphs from Task 12 into each language, keeping each catalog's consts, address form and typography. The cropped sentence quotes nothing.
- [ ] Run the language gate per language, with fresh reviewers, in parallel since they are read-only. A gate reviews the changed paragraphs and the two new `site` keys, and also re-checks that the whole Privacy section is still consistent. Loop until "No findings."
- [ ] Then regenerate the review sheets.

### Task 15: PR B on `gh-pages`, as a draft

**Worktree:** `/Users/khachaturtovmasyan/Projects/escuadra-146-gh-pages`, branch `docs/146-privacy-pages`.

- [ ] **`privacy.html`** goes back to `origin/gh-pages`'s version, unchanged: the 1.x policy stays alive. Delete the `privacy.{es,fr,it,de}.html` files. Generate `privacy/2/*` from `feat/146-privacy-pages`, with the placeholder date until release.
- [ ] **`index.html`**, using the owner's wording approved in #54 (comment of 2026-09-21):
  - the trust line `No account. No ads. No data collected.` becomes `No ads. No account. No personal data.`
  - the "Fully offline" card becomes the heading `Works offline` and the text `Every round plays without a connection, and there's no account to make.`
  - Both are true for 1.x and 2.0.
- [ ] **`tests/verify-site.test.mjs`:**
  - pages in a subfolder resolve their local links relative to their own folder;
  - `privacy.html` keeps its 1.x key copy;
  - the `privacy/2/` pages get the five-language assertions;
  - the home-page assertions use the new wording.
- [ ] Commit, push the branch, and open a **draft** PR into `gh-pages`. Its body says:
  - it merges only after #155, the native sign-off and a regeneration with the real date;
  - nothing links `privacy/2/` until a store's privacy URL is switched.

### Task 16: push PR A's new commits, and update its description

### Task 17: the issues

Each issue edit keeps the earlier text inside a `<details>` block, so nothing is lost.

- [ ] **#52 (epic):**
  - It now ships in 2.0.0. `release-1.1.0` was never cut, and #60 was closed for #116.
  - Update the task table: #53 ✅, #54 About ✅ with web via #146, #55 open, #56 ✅, #57 (Task 18), #58 ✅, #59 (Play), #60 → #116.
  - The facts it must describe now include `language`/`languageSource`, the hashed identifier, the session code and the IP.
- [ ] **#54:**
  - Done on `main`: About covers EAS Update, telemetry and photos, now in five languages via #146.
  - Remaining: the web policy, through #146's PR B (`privacy/2/`), and the home-page wording.
  - Closes with PR B.
- [ ] **#55:**
  - Rewrite for 2.0.0: Apple and Google answers per data type, including the `language` property, the hashed identifier and the session code under Device ID.
  - Add a note on the IP addresses that TelemetryDeck and Wikimedia receive.
  - Add a step to switch each store's privacy URL to `privacy/2/` when it ships 2.0.
  - Timing per #116.
  - Leave the Wikimedia photo-loading answer as an explicit owner checkbox.
- [ ] **#57:** 2.0.0 facts: PR into `main`, a native module so it waits for the 2.0 store build, one more stored item, which means About changes in five languages. Link Task 18's PR.
- [ ] **#146 and #116:** a comment each, with the versioned-pages decision and the release order.
- [ ] **New issue:** an in-app "Licences" sheet showing the Unicode notice and the MIT notices of the bundled JavaScript dependencies (milestone v2.0.0). Use the `escuadra-issue-creator` skill.

### Task 18: #57, the store-rating prompt (stacked draft PR)

**Branch:** `feat/57-review-prompt`, off `feat/146-privacy-pages`. Draft PR with base `feat/146-privacy-pages`; retarget it to `main` once #155 merges.

- [ ] Install `expo-store-review` with `npx expo install expo-store-review`, so the version suits SDK 57.
- [ ] **Pure, test-first:** `lib/reviewPrompt.ts` exports `shouldAskForReview({ flawless, hasAction, appVersion, askedVersion, earlierRounds })`. It returns true only when all of these hold:
  - the round was flawless;
  - `hasAction` is true;
  - this app version has not asked before;
  - the user had completed an earlier round.
  - Tests go in `lib/__tests__/` if `lib/` has moved over; otherwise beside the code, as `lib/` does now.
- [ ] **Persistence:** `stores/progress.ts` gets `reviewAskedVersion: string | null`, set when the prompt is requested. "An earlier round" is derived from existing state, without a new counter: the implementer reads how Results knows a previous best, and rules on it.
- [ ] **Results:** after a flawless round, fire and forget, never blocking or delaying the screen: `if (shouldAskForReview(…)) { setReviewAskedVersion(v); StoreReview.requestReview().catch(() => {}); }`.
- [ ] **About:** "What is stored" becomes ten things, adding which app version last asked you for a rating, in five languages. Then the language gates, the hash pin, and a regeneration of the pages.
- [ ] **Docs:** CLAUDE.md lists `expo-store-review` where native modules are named, if anywhere.
- [ ] **Not verifiable here:** the TestFlight/internal-track check (#57's acceptance criterion) stays open for the owner.
