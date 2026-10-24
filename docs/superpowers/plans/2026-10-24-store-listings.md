# Store Listings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the App Store and Google Play listings files in `store/`, checked in `npm run check`, drafted each version by the `escuadra-store-listing` skill, and entered from a generated paste sheet.

**Architecture:** A pure module (`scripts/store-listing.ts`) holds the field list, the checks, the version baseline and the sheet renderers; a thin Node CLI (`scripts/store-bundle.ts`) reads git and the disk and writes `dist/store-listing/`. `gen:play-assets` learns `--lang` for a feature graphic per language. A skill carries the owner through drafting (on `main`) and entering (on the release branch); a rule and `docs/release.md` hold the reference and the procedure.

**Tech Stack:** TypeScript run directly by Node 24, Vitest (node environment), Playwright (existing capture scripts), Markdown, Claude Code skills and rules.

**Spec:** `docs/superpowers/specs/2026-10-24-store-listings-design.md`

## Global Constraints

- Node 24: run `nvm use` first. `scripts/store-listing.ts` and `scripts/store-bundle.ts` run under plain Node: imports between them carry the `.ts` extension, type-only imports use `type`, no enums or namespaces, and nothing is imported from `i18n/` or through the `@/` alias.
- TypeScript stays strict with `noUncheckedIndexedAccess`; never weaken it.
- Nothing that moves the fingerprint: no new npm script, no `.gitignore` line, no change to `app.json`, `eas.json`, `package.json`, `package-lock.json` or `fingerprint.config.js`. Output goes to `dist/store-listing/`, which `dist/` already covers.
- _Escuadra_ and _a la escuadra_ are never translated, and the product is never called anything else (guardrail 6).
- Tests live in a `__tests__/` folder beside the code they cover, run in Vitest's node environment, and touch no network.
- Docs stay short and single-sourced: extend `docs/release.md`, add no parallel doc. A rule is at most 100 lines with a `paths:`-only frontmatter of double-quoted globs; `CLAUDE.md` stays within 200 lines (`scripts/claude/__tests__/repo.test.ts`).
- Open project files with Read, not `cat`, so their rules load.
- Commits are conventional, end with `(#N)` where N is the tooling issue from Task 0, and carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before reporting a task done, run what its last step names; before the PR, `npm run check`, reporting its actual output.

---

### Task 0: Issues, the Play facts and the branch (main session, before any dispatch)

The owner OK'd these on 2026-10-24. Done by the session that holds the conversation, not a subagent.

**Files:** none in the repo, except this plan (Task 1's two Play placeholders).

- [ ] **Step 1: Check in-flight overlap**

```bash
gh pr list --state open --json number,title,headRefName
git worktree list
for b in $(git branch -r --format='%(refname:short)' | grep -vE 'origin/(main|HEAD|gh-pages|release/)'); do
  git diff --name-only origin/main...$b 2>/dev/null | grep -qE '^(scripts/(capture-screens|generate-play-listing-assets|privacy-pages)|app/store/|docs/release.md|CLAUDE.md|\.claude/rules/(design-handoff|privacy-telemetry)|\.prettierignore)' && echo "overlap: $b"
done
```

Expected: no `overlap:` line. On one, the tooling issue gets "Depends on #M" and waits for it to merge.

- [ ] **Step 2: Ask the owner for the console facts `store/declarations.md` needs**

One AskUserQuestion: Play Console's app category and content rating as set today, and confirmation that App Store Connect still has Education then Sports, rated 4+. Replace `<PLAY_CATEGORY>` and `<PLAY_RATING>` in Task 1, Step 5 of this plan with the answers (and the App Store lines if they differ).

- [ ] **Step 3: Create the tooling issue with the `escuadra-issue-creator` skill**

Milestone `v2.0.0`, size M. Title: `chore(store): store listings as files, drafted by a skill, entered from a paste sheet`. Body:

```markdown
**Size:** M
**Spec:** `docs/superpowers/specs/2026-10-24-store-listings-design.md`
**Plan:** `docs/superpowers/plans/2026-10-24-store-listings.md`
**Blocks:** #147

The store listings become files in `store/`, checked in `npm run check`, drafted each version by a skill with the owner and entered in the consoles from a generated paste sheet. #147 is its first use.

### Work

- [ ] `scripts/store-listing.ts` and its test: the six fields, their limits and the checks
- [ ] `store/declarations.md` from #55's answers, and a proposed `store/screenshots.json`
- [ ] `node scripts/store-bundle.ts`: the paste sheet, the per-locale images, and `--review` sheets
- [ ] `npm run gen:play-assets -- --lang=<code>`: a feature graphic per language
- [ ] The `escuadra-store-listing` skill
- [ ] `.claude/rules/store-listing.md`, and `docs/release.md`'s Cut a release and Change the store listing

### Acceptance criteria

- [ ] `npm run check` passes
- [ ] Nothing the change touches feeds the fingerprint
- [ ] The skill, the rule and the docs pass the language-expert review
```

Note its number as N for every commit below.

- [ ] **Step 4: Create the backlog issue with the same skill**

No milestone, size M. Title: `chore(store): enter the store listing from CI`. Body:

```markdown
**Size:** M
**Spec:** `docs/superpowers/specs/2026-10-24-store-listings-design.md` (Later: the push)
**Depends on:** #N

Enter the store listing in both consoles from CI instead of by hand from the paste sheet.

### Work

- [ ] A manually dispatched workflow on `release/*` that shows a dry-run diff of each console against `store/`, then uploads the text and images
- [ ] Choose the tool: fastlane's deliver and supply, or the stores' APIs from `scripts/ci/`
- [ ] An App Store Connect API key and a Play service account in the `production-<platform>` environments
- [ ] Decide what stays hand-entered (App Privacy, Data safety)
- [ ] `docs/release.md`: Cut a release, step 7 runs the workflow

### Acceptance criteria

- [ ] A dry run shows every difference between `store/` and both consoles
- [ ] A run enters everything the paste sheet marks _paste_, with nothing entered by hand
```

- [ ] **Step 5: Rewrite #147 as 2.0.0's first run, keeping its original text**

```bash
gh issue view 147 --json body --jq .body > "$TMPDIR/147-original.md"
```

New body, with the original appended inside `<details><summary>Original issue text</summary>` … `</details>`:

```markdown
**Size:** L
**Design:** #141 (Decisions: Four layers); `docs/superpowers/specs/2026-10-24-store-listings-design.md`
**Depends on:** #145, #146, #N

The App Store and Google Play listings in all five languages: the first run of the `escuadra-store-listing` skill.

### Work

- [ ] `store/listing/en.md`, seeded from the live 1.x App Store listing (the owner pastes the keywords and promotional text from App Store Connect), then drafted for 2.0.0 from its `CHANGELOG.md` section
- [ ] Confirm or change the proposed `store/screenshots.json`
- [ ] `es.md`, `fr.md`, `it.md` and `de.md`, through the language-expert loop
- [ ] The #145 reviewers sign off each translation (`node scripts/store-bundle.ts --review`)
- [ ] At submission (#116): captures in five languages and `node scripts/store-bundle.ts` on `release/2.0.0`; everything entered from the paste sheet; the zips on the v2.0.0 Release

### Acceptance criteria

- [ ] `npm run check` passes with all five listing files
- [ ] Screenshots and a feature graphic exist for each language, and both consoles hold what the paste sheet marked _paste_
```

```bash
gh issue edit 147 --body-file "$TMPDIR/147-new.md"
```

- [ ] **Step 6: Point #55 at the file, without removing its answers**

Append to #55's body:

```markdown
### Where the answers live (2026-10-24)

The answers above are `store/declarations.md` from #N, and the 2.0.0 paste sheet lists them (#147). This issue stays open until they are entered at submission.
```

- [ ] **Step 7: Point #116's asset line at the bundle**

Replace the line `- [ ] Assets for the 2.0 listing: \`npm run shots\`, \`shots:store\`, \`shots:play\` and \`gen:play-assets\`` with:

```markdown
- [ ] `npm run shots` for `design/screens/`; the listing's text and images through #147 (`docs/release.md`, Cut a release, steps 4 and 7)
```

```bash
gh issue view 116 --json body --jq .body > "$TMPDIR/116.md"   # edit the one line, then:
gh issue edit 116 --body-file "$TMPDIR/116.md"
```

- [ ] **Step 8: Rename the branch and commit Step 2's answers**

The spec and this plan are already committed on `docs/store-listings-design`.

```bash
git branch -m chore/N-store-listings
git add docs/superpowers/plans/2026-10-24-store-listings.md
git commit -m "docs(store): the Play facts for the declarations (#N)"
```

---

### Task 1: The listing format and its checks

**Files:**

- Create: `scripts/store-listing.ts`
- Create: `scripts/__tests__/store-listing.test.ts`
- Create: `store/screenshots.json`
- Create: `store/declarations.md`
- Modify: `.prettierignore` (one line)

**Interfaces:**

- Consumes: `pageUrl` from `scripts/privacy-pages.ts`; `LANGUAGE_NAMES` from `i18n/names.ts`; `SUPPORTED_LANGUAGES` from `i18n/resolveLanguage.ts` (test only).
- Produces (all exported from `scripts/store-listing.ts`):
  - `LANGUAGES: readonly ['en', 'es', 'fr', 'it', 'de']`, `type ListingLanguage`
  - `STORE_LOCALES: Readonly<Record<ListingLanguage, { appStore: string; play: string }>>`
  - `FIELDS` (the six fields, each `{ id, name, store, limit }`), `type Field`, `type FieldId`, `type Listing = Readonly<Record<FieldId, string>>`
  - `MAX_SHOTS = 8`
  - `heading(field: Field): string`, `charCount(text: string): number`
  - `parseListing(markdown: string): ParsedListing` (`{ title: string | null; sections: { heading; body }[]; stray: boolean }`)
  - `listingProblems(markdown: string): string[]`, `readListing(markdown: string): Listing`
  - `translationProblems(listing: Listing, english: Listing): string[]`
  - `screenshotProblems(shots: unknown): string[]`, `declaredPrivacyUrl(declarations: string): string | null`

- [ ] **Step 1: Write the failing tests**

`scripts/__tests__/store-listing.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run scripts/__tests__/store-listing.test.ts`
Expected: FAIL, `Failed to resolve import "../store-listing"`.

- [ ] **Step 3: Write the module**

`scripts/store-listing.ts`:

```ts
// The store listings (docs/superpowers/specs/2026-10-24-store-listings-design.md): the
// fields each store/listing/<lang>.md holds and the checks npm run check runs on them.
// Pure, and importing nothing from i18n/, so scripts/store-bundle.ts runs it under plain
// Node; scripts/__tests__/store-listing.test.ts holds LANGUAGES to SUPPORTED_LANGUAGES.

/** The languages with a listing: the app's supported languages (tested). */
export const LANGUAGES = ['en', 'es', 'fr', 'it', 'de'] as const;
export type ListingLanguage = (typeof LANGUAGES)[number];

/** Each language's locale in App Store Connect and in Play Console: one per language. */
export const STORE_LOCALES: Readonly<
  Record<ListingLanguage, { readonly appStore: string; readonly play: string }>
> = {
  en: { appStore: 'en-US', play: 'en-US' },
  es: { appStore: 'es-ES', play: 'es-ES' },
  fr: { appStore: 'fr-FR', play: 'fr-FR' },
  it: { appStore: 'it', play: 'it-IT' },
  de: { appStore: 'de-DE', play: 'de-DE' },
};

/**
 * Every field of a listing file, in order: the store that shows it and its limit in
 * characters. One Description serves both stores, and one What's new is written to
 * Play's 500.
 */
export const FIELDS = [
  { id: 'subtitle', name: 'Subtitle', store: 'App Store', limit: 30 },
  { id: 'promotionalText', name: 'Promotional text', store: 'App Store', limit: 170 },
  { id: 'keywords', name: 'Keywords', store: 'App Store', limit: 100 },
  { id: 'shortDescription', name: 'Short description', store: 'Google Play', limit: 80 },
  { id: 'description', name: 'Description', store: 'both', limit: 4000 },
  { id: 'whatsNew', name: "What's new", store: 'both', limit: 500 },
] as const;

export type Field = (typeof FIELDS)[number];
export type FieldId = Field['id'];
export type Listing = Readonly<Record<FieldId, string>>;

/** Play's most phone screenshots per language; Apple takes 10. */
export const MAX_SHOTS = 8;

/** A field's heading in a listing file: `Subtitle (App Store, 30)`. */
export function heading(field: Field): string {
  return `${field.name} (${field.store}, ${field.limit})`;
}

/** Characters as a reader counts them: code points, so é and ß are one each. */
export function charCount(text: string): number {
  return [...text].length;
}

export interface ParsedListing {
  /** The `# ` line: the language's name in itself. */
  readonly title: string | null;
  readonly sections: readonly { readonly heading: string; readonly body: string }[];
  /** Whether a non-empty line sits outside any field. */
  readonly stray: boolean;
}

/** Splits a listing file at its `## ` headings. A body runs to the next heading, trimmed. */
export function parseListing(markdown: string): ParsedListing {
  let title: string | null = null;
  let stray = false;
  const sections: { heading: string; lines: string[] }[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of markdown.replaceAll('\r\n', '\n').split('\n')) {
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else if (title === null && line.startsWith('# ')) {
      title = line.slice(2).trim();
    } else if (line.trim() !== '') {
      stray = true;
    }
  }
  return {
    title,
    stray,
    sections: sections.map(({ heading, lines }) => ({ heading, body: lines.join('\n').trim() })),
  };
}

function keywordProblems(keywords: string): string[] {
  if (keywords === '') return [];
  const words = keywords.split(',');
  const problems: string[] = [];
  if (words.some((word) => word !== word.trim())) {
    problems.push('Keywords have spaces around a comma, which spend the limit on nothing');
  }
  if (words.some((word) => word.trim() === '')) {
    problems.push('Keywords have an empty entry between commas');
  }
  const seen = new Set<string>();
  for (const word of words.map((each) => each.trim().toLocaleLowerCase())) {
    if (word !== '' && seen.has(word)) problems.push(`Keywords repeat "${word}"`);
    seen.add(word);
  }
  return problems;
}

/** What is wrong with one listing file, one sentence each; empty when nothing is. */
export function listingProblems(markdown: string): string[] {
  const parsed = parseListing(markdown);
  const problems: string[] = [];
  if (parsed.stray) {
    problems.push('text before the first field: every line belongs under a ## heading');
  }
  const expected = FIELDS.map(heading);
  const found = parsed.sections.map((section) => section.heading);
  if (found.join('\n') !== expected.join('\n')) {
    problems.push(
      `the fields must be exactly, in order: ${expected.join('; ')}. Found: ${found.join('; ') || 'none'}`,
    );
    return problems;
  }
  FIELDS.forEach((field, index) => {
    const body = parsed.sections[index]?.body ?? '';
    if (body === '') problems.push(`${field.name} is empty`);
    const count = charCount(body);
    if (count > field.limit) {
      problems.push(`${field.name} is ${count} characters, over its ${field.limit}`);
    }
    if (/\bSquad (Trainer|Game|Quiz)\b/.test(body)) {
      problems.push(`${field.name} calls the product something other than Escuadra (guardrail 6)`);
    }
    if (field.id === 'keywords') problems.push(...keywordProblems(body));
  });
  return problems;
}

/** The fields of a listing file by id. Throws what `listingProblems` finds. */
export function readListing(markdown: string): Listing {
  const problems = listingProblems(markdown);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  const { sections } = parseListing(markdown);
  // listingProblems just proved the sections are FIELDS, in order.
  return Object.fromEntries(
    FIELDS.map((field, index) => [field.id, sections[index]?.body ?? '']),
  ) as Listing;
}

/** What a translation gets wrong against the English: a field left in English, a name translated. */
export function translationProblems(listing: Listing, english: Listing): string[] {
  return FIELDS.flatMap((field) => {
    const theirs = listing[field.id];
    const ours = english[field.id];
    const problems: string[] = [];
    if (theirs === ours) problems.push(`${field.name} is still the English text`);
    // Two separate checks: a field can keep the phrase and drop the name, or the reverse.
    if (/a la escuadra/i.test(ours) && !/a la escuadra/i.test(theirs)) {
      problems.push(`${field.name} must keep "a la escuadra" as it is`);
    }
    if (ours.includes('Escuadra') && !theirs.includes('Escuadra')) {
      problems.push(`${field.name} must keep the name Escuadra`);
    }
    return problems;
  });
}

/** What is wrong with store/screenshots.json's contents. */
export function screenshotProblems(shots: unknown): string[] {
  if (!Array.isArray(shots) || shots.some((shot) => typeof shot !== 'string')) {
    return ['store/screenshots.json must be a list of capture names'];
  }
  const problems: string[] = [];
  if (shots.length === 0) problems.push('store/screenshots.json lists no shots');
  if (shots.length > MAX_SHOTS) {
    problems.push(
      `store/screenshots.json lists ${shots.length} shots; Play takes at most ${MAX_SHOTS}`,
    );
  }
  if (new Set(shots).size !== shots.length)
    problems.push('store/screenshots.json lists a shot twice');
  return problems;
}

/** The privacy policy URL store/declarations.md declares, or null. */
export function declaredPrivacyUrl(declarations: string): string | null {
  return /^- Privacy policy URL: (\S+)$/m.exec(declarations)?.[1] ?? null;
}
```

The name check is case-sensitive on purpose: "a la escuadra" holds the lowercase word, so it never satisfies the check for the capitalised name, and the test "flags a translated name" pins each check alone.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/__tests__/store-listing.test.ts`
Expected: every `describe` above `the files in store/` PASSes. `the files in store/` FAILs on the two missing files (`store/screenshots.json`, `store/declarations.md`).

- [ ] **Step 5: Add the two `store/` files and keep Prettier off the listings**

`store/screenshots.json`, a proposal the owner confirms in #147 (each name is a `design/screens/` capture that the store and play profiles also take):

```json
[
  "06-question-l1",
  "08-question-l3",
  "09-results-passed",
  "05-study",
  "02-team-picker-clubs",
  "01-home"
]
```

`store/declarations.md` (from #55's agreed answers, 2026-10-20; the deletion line names the switch as the app now labels it, in Settings):

```markdown
# Store declarations

What Escuadra declares in App Store Connect and Play Console: set once per app and changed
only when the app changes. What each answer means is the owner's call (guardrail 7), and
every answer agrees with `en.about.privacy` in `i18n/en.ts`, the complete statement of
what leaves the device. A change to what leaves the device updates this file in the same
PR. The paste sheet lists it when it changed since the last version.

## Both stores

- Name: Escuadra
- Privacy policy URL: https://tovmassian.github.io/escuadra/privacy/2/
- Support URL: https://tovmassian.github.io/escuadra/support.html

## App Store Connect

- Category: Education, then Sports
- Age rating: 4+

### App Privacy

Entered before Submit for Review, with the privacy policy URL.

- Identifiers, Device ID: not linked to the user, not used for tracking, purpose Analytics
  (TelemetryDeck's hashed install ID and session code).
- Usage Data, Product Interaction: not linked, not tracking, purpose Analytics (the events,
  the app language among them).
- Diagnostics, Crash Data: not linked, not tracking, purpose App Functionality (the
  expo-updates error message after a failed start).
- The EAS Update check's installation ID, for App Functionality, as the 1.0.0 correction
  (#61) answered it.

## Play Console

- Category: <PLAY_CATEGORY>
- Content rating: <PLAY_RATING>

### Data safety

Entered when the build is uploaded, with the privacy policy URL.

- App activity, App interactions: collected, not shared, purpose Analytics.
- Device or other IDs: collected, not shared, purposes Analytics and App functionality.
- App info and performance, Crash logs: collected, not shared, purpose App functionality
  (the expo-updates error message).
- Encrypted in transit: yes.
- Deletion requests: none offered. The statistics carry only a hashed random installation
  ID and cannot be traced to a person, and switching off "Usage statistics" in Settings
  stops all sending.
- Consistent with the EAS Update answer in the Android 1.0 listing.

## Not declared

- Wikimedia Commons photo loading (owner, 2026-10-20). Wikimedia is not a partner or an
  integrated SDK: the app fetches public files from its CDN as a browser would, and
  neither the developer nor a partner can access what Wikimedia receives. About still says
  what Wikimedia receives.
```

Append to `.prettierignore`:

```
# Pasted into the store consoles as written: a reformat would change what is pasted.
store/listing/
```

- [ ] **Step 6: Run the tests and Prettier**

Run: `npx prettier --write scripts/store-listing.ts scripts/__tests__/store-listing.test.ts store/ && npx vitest run scripts/__tests__/store-listing.test.ts && npx tsc --noEmit`
Expected: all PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/store-listing.ts scripts/__tests__/store-listing.test.ts store/ .prettierignore
git commit -m "feat(store): the listing format and its checks (#N)"
```

---

### Task 2: The baseline, the statuses and the sheets

**Files:**

- Modify: `scripts/store-listing.ts` (append)
- Modify: `scripts/__tests__/store-listing.test.ts` (append, extend the import)

**Interfaces:**

- Consumes: everything Task 1 exports.
- Produces (exported from `scripts/store-listing.ts`):
  - `type Status = 'paste' | 'skip'`, `type ImageStatus = Status | 'release-only'`
  - `baselineTag(tags: readonly string[], version: string): string | null`
  - `readBaseline(markdown: string | null): Listing | null`
  - `fieldStatuses(listing: Listing, baseline: Listing | null, newVersion: boolean): Readonly<Record<FieldId, Status>>`
  - `isReleaseBranch(branch: string): boolean`
  - `imageCopies(shots: readonly string[]): { from: string; to: string }[]`
  - `interface SheetInput`, `pasteSheet(input: SheetInput): string`
  - `reviewSheet(language: string, listing: Listing, english: Listing, statuses: Readonly<Record<FieldId, Status>>, baseline: string | null): string | null`

- [ ] **Step 1: Write the failing tests**

Add to the import list in `scripts/__tests__/store-listing.test.ts`: `baselineTag`, `fieldStatuses`, `imageCopies`, `isReleaseBranch`, `pasteSheet`, `readBaseline`, `reviewSheet`, `type FieldId`, `type ListingLanguage`, `type SheetInput`, `type Status`. Then append:

```ts
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
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run scripts/__tests__/store-listing.test.ts`
Expected: FAIL, `baselineTag` (and the rest) is not exported.

- [ ] **Step 3: Append the implementation to `scripts/store-listing.ts`**

```ts
export type Status = 'paste' | 'skip';
/** Images are entered, unchanged, or not this checkout's to hand over. */
export type ImageStatus = Status | 'release-only';

type Version = readonly [number, number, number];

function versionOf(text: string): Version | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * The tag of the listing that is live: the highest `vX.Y.Z` at or below app.json's
 * version. While a version is prepared that is the previous one; between versions, the
 * live one itself. A version's tag sits on its release branch, which later branches hold
 * only as cherry-picked copies, so it is found by name, never by walking history.
 */
export function baselineTag(tags: readonly string[], version: string): string | null {
  const ceiling = versionOf(version);
  if (ceiling === null) throw new Error(`app.json's version "${version}" is not X.Y.Z`);
  let best: { tag: string; version: Version } | null = null;
  for (const tag of tags) {
    const tagged = tag.startsWith('v') ? versionOf(tag.slice(1)) : null;
    if (tagged === null || compareVersions(tagged, ceiling) > 0) continue;
    if (best === null || compareVersions(tagged, best.version) > 0) best = { tag, version: tagged };
  }
  return best?.tag ?? null;
}

/** A listing file as it was at the baseline: null with none, or when it no longer parses. */
export function readBaseline(markdown: string | null): Listing | null {
  if (markdown === null) return null;
  try {
    return readListing(markdown);
  } catch {
    return null;
  }
}

/**
 * Which fields need entering. A field the baseline already holds is skipped. What's new
 * belongs to a version, not to the listing: every new version enters it, and an edit
 * between versions has no version to carry it.
 */
export function fieldStatuses(
  listing: Listing,
  baseline: Listing | null,
  newVersion: boolean,
): Readonly<Record<FieldId, Status>> {
  return Object.fromEntries(
    FIELDS.map((field) => {
      if (field.id === 'whatsNew') return [field.id, newVersion ? 'paste' : 'skip'];
      const same = baseline !== null && baseline[field.id] === listing[field.id];
      return [field.id, same ? 'skip' : 'paste'];
    }),
  ) as Record<FieldId, Status>;
}

/** Whether a branch is a version's release branch, the only place images come from. */
export function isReleaseBranch(branch: string): boolean {
  return /^release\/\d+\.\d+\.\d+$/.test(branch);
}

/** Every image a release hands over: from its capture to its place in dist/store-listing/. */
export function imageCopies(
  shots: readonly string[],
): { readonly from: string; readonly to: string }[] {
  const copies = LANGUAGES.flatMap((language) => {
    const { appStore, play } = STORE_LOCALES[language];
    return [
      ...shots.flatMap((shot, index) => {
        const n = String(index + 1).padStart(2, '0');
        return [
          { from: `design/store/${language}/${shot}.png`, to: `app-store/${appStore}/${n}.png` },
          { from: `design/play/${language}/${shot}.jpg`, to: `play/${play}/${n}.jpg` },
        ];
      }),
      {
        from: `design/play/${language}/feature-graphic.jpg`,
        to: `play/${play}/feature-graphic.jpg`,
      },
    ];
  });
  return [...copies, { from: 'design/play/icon-512.png', to: 'play/icon-512.png' }];
}

export interface SheetInput {
  readonly version: string;
  readonly baseline: string | null;
  readonly listings: Readonly<Record<ListingLanguage, Listing>>;
  readonly statuses: Readonly<Record<ListingLanguage, Readonly<Record<FieldId, Status>>>>;
  readonly images: ImageStatus;
  readonly shotCount: number;
  readonly declarations: Status;
}

const FENCE = '~~~~';

/** Each console's own name for a field, where it differs from the listing file's. */
const APP_STORE_LABELS: Partial<Record<FieldId, string>> = {
  promotionalText: 'Promotional Text',
  whatsNew: "What's New in This Version",
};
const PLAY_LABELS: Partial<Record<FieldId, string>> = { description: 'Full description' };

function entry(label: string, status: Status, text: string, limit: number): string[] {
  if (status === 'skip') return [`- ${label}: skip, unchanged`, ''];
  return [
    `#### ${label} · paste · ${charCount(text)}/${limit}`,
    '',
    `${FENCE}text`,
    text,
    FENCE,
    '',
  ];
}

function imagesIntro(images: ImageStatus, baseline: string | null): string {
  switch (images) {
    case 'paste':
      return 'Images: **paste**, from `dist/store-listing/`.';
    case 'skip':
      return `Images: skip, the same as in ${baseline}.`;
    case 'release-only':
      return 'Images: none here. They show the code that ships, so they come only from a release branch.';
  }
}

/** The paste sheet: store, then locale, then field, in the order the consoles take them. */
export function pasteSheet(input: SheetInput): string {
  const { listings, statuses, images } = input;
  const last = String(input.shotCount).padStart(2, '0');
  const lines: string[] = [
    `# Paste sheet: ${input.version}`,
    '',
    input.baseline === null
      ? 'No earlier version is tagged, so everything is **paste**.'
      : `Compared with ${input.baseline}, the listing that is live: enter only what says **paste**.`,
    '',
    imagesIntro(images, input.baseline),
    '',
    '## App Store Connect',
    '',
  ];
  for (const language of LANGUAGES) {
    const locale = STORE_LOCALES[language].appStore;
    lines.push(`### ${locale}`, '');
    for (const field of FIELDS) {
      if (field.store === 'Google Play') continue;
      const label = APP_STORE_LABELS[field.id] ?? field.name;
      lines.push(
        ...entry(label, statuses[language][field.id], listings[language][field.id], field.limit),
      );
    }
    if (images === 'paste') {
      lines.push(`- Screenshots: \`app-store/${locale}/01.png\` to \`${last}.png\`, in order`, '');
    }
  }
  lines.push('## Google Play Console', '');
  for (const language of LANGUAGES) {
    const locale = STORE_LOCALES[language].play;
    lines.push(`### ${locale}`, '');
    for (const field of FIELDS) {
      if (field.store === 'App Store' || field.id === 'whatsNew') continue;
      const label = PLAY_LABELS[field.id] ?? field.name;
      lines.push(
        ...entry(label, statuses[language][field.id], listings[language][field.id], field.limit),
      );
    }
    if (images === 'paste') {
      lines.push(
        `- Screenshots: \`play/${locale}/01.jpg\` to \`${last}.jpg\`, in order`,
        `- Feature graphic: \`play/${locale}/feature-graphic.jpg\``,
        '',
      );
    }
  }
  if (images === 'paste') lines.push('- App icon: `play/icon-512.png`, in the default listing', '');
  // Play takes every language's release notes in one box, each inside its locale's tags.
  if (LANGUAGES.some((language) => statuses[language].whatsNew === 'paste')) {
    const notes = LANGUAGES.flatMap((language) => {
      const locale = STORE_LOCALES[language].play;
      return [`<${locale}>`, listings[language].whatsNew, `</${locale}>`];
    });
    lines.push(
      '### Release notes · paste, every language in one box',
      '',
      `${FENCE}text`,
      ...notes,
      FENCE,
      '',
    );
  } else {
    lines.push('### Release notes: skip, unchanged', '');
  }
  if (input.declarations === 'paste') {
    lines.push(
      '## Declarations · paste',
      '',
      "Enter what `store/declarations.md` says: App Privacy before Submit for Review, Data safety when the build is uploaded, and each store's privacy policy URL with its answers.",
      '',
    );
  } else {
    lines.push('## Declarations: skip, unchanged', '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * The sheet a native reviewer signs off: each changed field's English, then its
 * translation and count. `language` is the language's name in itself (its file's title).
 * Null when nothing in the language changed.
 */
export function reviewSheet(
  language: string,
  listing: Listing,
  english: Listing,
  statuses: Readonly<Record<FieldId, Status>>,
  baseline: string | null,
): string | null {
  const changed = FIELDS.filter((field) => statuses[field.id] === 'paste');
  if (changed.length === 0) return null;
  const quote = (text: string) => text.split('\n').map((line) => (line === '' ? '>' : `> ${line}`));
  const lines = [
    `# ${language}: store listing review`,
    '',
    'Reviewer: ______________ Signed off on: ______________',
    '',
    baseline === null
      ? '- Every field is here: this is the first listing.'
      : `- Only the fields that changed since ${baseline} are here.`,
    '- The limit is the most characters the store takes. A text that does not fit is rewritten, never cut.',
    '- Never translated: Escuadra, a la escuadra. Screens and buttons are named as the app names them in this language.',
    '',
    ...changed.flatMap((field) => [
      `## ${heading(field)}`,
      '',
      'English:',
      '',
      ...quote(english[field.id]),
      '',
      `${language}, ${charCount(listing[field.id])}/${field.limit}:`,
      '',
      ...quote(listing[field.id]),
      '',
    ]),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
```

- [ ] **Step 4: Run the tests, the typecheck and Prettier**

Run: `npx prettier --write scripts/store-listing.ts scripts/__tests__/store-listing.test.ts && npx vitest run scripts/__tests__/store-listing.test.ts && npx tsc --noEmit && npx eslint scripts/store-listing.ts scripts/__tests__/store-listing.test.ts`
Expected: all PASS, no type or lint errors. Prettier may rewrap long lines and string concatenations; the assertions match on content, so re-run the tests after it.

- [ ] **Step 5: Commit**

```bash
git add scripts/store-listing.ts scripts/__tests__/store-listing.test.ts
git commit -m "feat(store): compare with the live version, and render the paste and review sheets (#N)"
```

---

### Task 3: The bundle CLI

**Files:**

- Create: `scripts/store-bundle.ts`

**Interfaces:**

- Consumes: from `./store-listing.ts`: `baselineTag`, `fieldStatuses`, `imageCopies`, `isReleaseBranch`, `LANGUAGES`, `parseListing`, `pasteSheet`, `readBaseline`, `readListing`, `reviewSheet`, `screenshotProblems`, `translationProblems`, and the types `FieldId`, `ImageStatus`, `Listing`, `ListingLanguage`, `Status`.
- Produces: the commands `node scripts/store-bundle.ts` (writes `dist/store-listing/paste-sheet.md`, and on `release/X.Y.Z` copies images into `dist/store-listing/app-store/` and `play/`) and `node scripts/store-bundle.ts --review` (writes `dist/store-listing/review/<lang>.md`).

The logic is tested in Tasks 1 and 2; this file only reads git and the disk, so it is checked by running it.

- [ ] **Step 1: Write the CLI**

`scripts/store-bundle.ts`:

```ts
// node scripts/store-bundle.ts [--review]
//
// The store listing at release (docs/release.md, Cut a release). With no flag it writes
// dist/store-listing/paste-sheet.md and, on a release/X.Y.Z checkout only (images must show
// the code that ships), copies each language's listed screenshots and feature graphic
// beside it. With --review it writes each translation's review sheet to
// dist/store-listing/review/. Both compare with the listing that is live: the highest
// version tag at or below app.json's version. The logic is ./store-listing.ts; this file
// only reads git and the disk.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  baselineTag,
  fieldStatuses,
  imageCopies,
  isReleaseBranch,
  LANGUAGES,
  parseListing,
  pasteSheet,
  readBaseline,
  readListing,
  reviewSheet,
  screenshotProblems,
  translationProblems,
  type FieldId,
  type ImageStatus,
  type Listing,
  type ListingLanguage,
  type Status,
} from './store-listing.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist', 'store-listing');

const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => existsSync(path.join(ROOT, file));
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const listingFile = (language: ListingLanguage) => `store/listing/${language}.md`;

/** A file as it was at `tag`; null with no tag, or when the file did not exist then. */
function atTag(tag: string | null, file: string): string | null {
  if (tag === null) return null;
  try {
    return git('show', `${tag}:${file}`);
  } catch {
    return null;
  }
}

/** Whether every path is the same now as at `tag`. */
function sameAsTag(tag: string, paths: readonly string[]): boolean {
  try {
    git('diff', '--quiet', tag, '--', ...paths);
    return true;
  } catch {
    return false;
  }
}

const version: string = JSON.parse(read('app.json')).expo.version;
const tag = baselineTag(git('tag', '--list', 'v*').split('\n').filter(Boolean), version);
const newVersion = tag !== `v${version}`;

if (!exists(listingFile('en'))) {
  throw new Error(`${listingFile('en')} is missing: it is the source every translation follows`);
}
const english = readListing(read(listingFile('en')));

/** A language's listing, checked against the English. */
function listingOf(language: ListingLanguage): Listing {
  const listing = readListing(read(listingFile(language)));
  const problems = language === 'en' ? [] : translationProblems(listing, english);
  if (problems.length > 0) throw new Error(`${listingFile(language)}:\n${problems.join('\n')}`);
  return listing;
}

function statusesOf(language: ListingLanguage, listing: Listing) {
  return fieldStatuses(listing, readBaseline(atTag(tag, listingFile(language))), newVersion);
}

function writeReviewSheets(): void {
  const dir = path.join(OUT, 'review');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const language of LANGUAGES) {
    if (language === 'en' || !exists(listingFile(language))) continue;
    const listing = listingOf(language);
    const title = parseListing(read(listingFile(language))).title ?? language;
    const sheet = reviewSheet(title, listing, english, statusesOf(language, listing), tag);
    if (sheet === null) {
      console.log(`${language}: nothing changed since ${tag}`);
      continue;
    }
    writeFileSync(path.join(dir, `${language}.md`), sheet);
    console.log(`wrote dist/store-listing/review/${language}.md`);
  }
}

/** Images come only from a release branch, and only when they changed since `tag`. */
function imageStatus(shots: readonly string[]): ImageStatus {
  if (!isReleaseBranch(git('rev-parse', '--abbrev-ref', 'HEAD').trim())) return 'release-only';
  if (tag === null) return 'paste';
  const before = atTag(tag, 'store/screenshots.json');
  const sameSet = before !== null && JSON.stringify(JSON.parse(before)) === JSON.stringify(shots);
  const screens = [
    ...shots.map((shot) => `design/screens/${shot}.png`),
    'app/store/feature-graphic.tsx',
  ];
  return sameSet && sameAsTag(tag, screens) ? 'skip' : 'paste';
}

function copyImages(shots: readonly string[]): void {
  const copies = imageCopies(shots);
  const absent = copies.filter(({ from }) => !exists(from));
  if (absent.length > 0) {
    throw new Error(
      [
        `${absent.length} capture(s) missing, among them:`,
        ...absent.slice(0, 10).map(({ from }) => `  ${from}`),
        'Capture every language, then run this again:',
        '  for code in en es fr it de; do npm run shots:store -- --lang=$code && npm run shots:play -- --lang=$code && npm run gen:play-assets -- --lang=$code || break; done',
      ].join('\n'),
    );
  }
  for (const { from, to } of copies) {
    const target = path.join(OUT, to);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(ROOT, from), target);
  }
  console.log(`copied ${copies.length} images into dist/store-listing/`);
}

function writeBundle(): void {
  const missing = LANGUAGES.filter((language) => !exists(listingFile(language)));
  if (missing.length > 0) {
    throw new Error(
      `no listing for ${missing.join(', ')}: every language ships one (store/listing/<lang>.md)`,
    );
  }
  const listings = Object.fromEntries(
    LANGUAGES.map((language) => [language, listingOf(language)]),
  ) as Record<ListingLanguage, Listing>;
  const statuses = Object.fromEntries(
    LANGUAGES.map((language) => [language, statusesOf(language, listings[language])]),
  ) as Record<ListingLanguage, Readonly<Record<FieldId, Status>>>;

  const shots: unknown = JSON.parse(read('store/screenshots.json'));
  const shotProblems = screenshotProblems(shots);
  if (shotProblems.length > 0) throw new Error(shotProblems.join('\n'));
  const list = shots as string[];

  rmSync(path.join(OUT, 'app-store'), { recursive: true, force: true });
  rmSync(path.join(OUT, 'play'), { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const images = imageStatus(list);
  if (images === 'paste') copyImages(list);

  const declarations = read('store/declarations.md');
  const sheet = pasteSheet({
    version,
    baseline: tag,
    listings,
    statuses,
    images,
    shotCount: list.length,
    declarations: atTag(tag, 'store/declarations.md') === declarations ? 'skip' : 'paste',
  });
  writeFileSync(path.join(OUT, 'paste-sheet.md'), sheet);
  console.log(`wrote dist/store-listing/paste-sheet.md (compared with ${tag ?? 'nothing yet'})`);
}

if (process.argv.includes('--review')) writeReviewSheets();
else writeBundle();
```

- [ ] **Step 2: Typecheck, lint and format**

Run: `npx prettier --write scripts/store-bundle.ts && npx tsc --noEmit && npx eslint scripts/store-bundle.ts`
Expected: no errors.

- [ ] **Step 3: Run it with no listing yet**

Run: `node scripts/store-bundle.ts; echo "exit $?"`
Expected: an error naming `store/listing/en.md is missing`, exit 1. That message is the one the first run (#147) sees before `en.md` exists.

- [ ] **Step 4: Run it against a throwaway listing, then remove it**

```bash
mkdir -p store/listing
cat > store/listing/en.md <<'EOF'
# English

## Subtitle (App Store, 30)

Learn every squad

## Promotional text (App Store, 170)

Every squad, in five languages.

## Keywords (App Store, 100)

football,squad,quiz

## Short description (Google Play, 80)

Learn a football squad by its shirt numbers.

## Description (both, 4000)

Escuadra teaches a squad by repetition.

A flawless round is a la escuadra.

## What's new (both, 500)

Photos of every player.
EOF
for code in es fr it de; do sed -E "s/^([A-Za-z].*)$/\1 ($code)/" store/listing/en.md > store/listing/$code.md; done
node scripts/store-bundle.ts --review && sed -n '1,24p' dist/store-listing/review/de.md
node scripts/store-bundle.ts && sed -n '1,40p' dist/store-listing/paste-sheet.md
rm -r store/listing && git status --short store/
```

Expected:

- four review sheets written, `de.md` starting `# English: store listing review` (the throwaway files keep the English title) and holding every field with `this is the first listing`;
- the paste sheet starting `# Paste sheet: ` with `No earlier version is tagged`, `Images: none here.` (this branch is not a release branch), fenced fields under `### en-US`, and the release-notes block with `<de-DE>`;
- `git status` showing nothing under `store/` after the removal.

- [ ] **Step 5: Commit**

```bash
git add scripts/store-bundle.ts
git commit -m "feat(store): the bundle writes the paste sheet, the images and the review sheets (#N)"
```

---

### Task 4: A feature graphic per language

**Files:**

- Create: `scripts/seed-language.mjs`
- Modify: `scripts/capture-screens.mjs` (the inline language seed in `openCapture`)
- Modify: `scripts/generate-play-listing-assets.mjs`
- Modify: `app/store/feature-graphic.tsx`
- Modify: `.claude/rules/design-handoff.md`

**Interfaces:**

- Consumes: `resolveLanguageArg` from `scripts/screenshot-profiles.ts`.
- Produces: `npm run gen:play-assets -- --lang=<code>` writes `design/play/<code>/feature-graphic.jpg` (and the icon, as before, to `design/play/icon-512.png`); `imageCopies` (Task 2) expects exactly that path. `seedLanguage(page, language)` from `scripts/seed-language.mjs`.

- [ ] **Step 1: Move the language seed into a shared module**

`scripts/seed-language.mjs`:

```js
// Seeds the app's language before a page loads (#145). The app reads `languagePreference`
// from its persisted progress store, so the value is merged into whatever the store
// already holds: a best score written earlier on the page survives the next navigation.
// Shared by capture-screens.mjs and generate-play-listing-assets.mjs.
export async function seedLanguage(page, language) {
  await page.addInitScript((code) => {
    const key = 'escuadra-progress';
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      stored = null;
    }
    const next = stored ?? { state: {}, version: 0 };
    next.state = { ...next.state, languagePreference: code };
    localStorage.setItem(key, JSON.stringify(next));
  }, language);
}
```

In `scripts/capture-screens.mjs`, add `import { seedLanguage } from './seed-language.mjs';` after the `./dev-server.mjs` import, and replace the whole `if (LANGUAGE) { … await page.addInitScript(…) … }` block in `openCapture` with:

```js
if (LANGUAGE) await seedLanguage(page, LANGUAGE);
```

- [ ] **Step 2: Name the rendered language on the graphic**

In `app/store/feature-graphic.tsx`, import `useLanguage` beside `useT` (`import { useLanguage, useT } from '@/i18n/useT';`), and in the component:

```tsx
const t = useT();
// Names the language it rendered in, so gen:play-assets' --lang can check the seed took.
const language = useLanguage();
```

and give the content view the ID: `<View style={styles.content} testID={`feature-graphic-${language}`}>`. `testID` is on `SILENT_PROPS` in `eslint.config.js`, so the lint rule against hard-coded text lets it through.

- [ ] **Step 3: Teach `gen:play-assets` `--lang`, and wait for the launch intro**

In `scripts/generate-play-listing-assets.mjs`:

- Add the imports:

```js
import { resolveLanguageArg } from './screenshot-profiles.ts';
import { seedLanguage } from './seed-language.mjs';
```

- After `const OUT_DIR = 'design/play';` add:

```js
// `--lang=de` renders the graphic's tagline in one language, into design/play/de/, beside
// that language's shots:play captures. Without it the app follows the browser, as before.
const LANGUAGE = resolveLanguageArg(process.argv.slice(2));
const GRAPHIC_DIR = LANGUAGE ? `${OUT_DIR}/${LANGUAGE}` : OUT_DIR;
```

- Replace the body of `generateFeatureGraphic` from `await page.goto(…)` through `await page.close();` with:

```js
if (LANGUAGE) await seedLanguage(page, LANGUAGE);
await page.goto(`${BASE}/store/feature-graphic`, { waitUntil: 'networkidle' });
// The launch intro (#182) plays over every route as the app opens, the graphic's
// included: wait for the graphic, then for the intro to leave.
const graphic = page.locator('[data-testid^="feature-graphic-"]');
await graphic.waitFor();
await page.getByTestId('launch-intro').waitFor({ state: 'detached' });
if (LANGUAGE) {
  const rendered = await graphic.getAttribute('data-testid');
  if (rendered !== `feature-graphic-${LANGUAGE}`) {
    throw new Error(`--lang=${LANGUAGE}: the graphic rendered as ${rendered}`);
  }
}
await page.waitForTimeout(500);

await mkdir(GRAPHIC_DIR, { recursive: true });
const outPath = `${GRAPHIC_DIR}/feature-graphic.jpg`;
await page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });
await page.close();
```

- Update the file's opening comment: after "the 1024×500 feature graphic.", add "`--lang=<code>` writes the graphic in one language to design/play/<code>/."

- [ ] **Step 4: Run it in German and in the default, and look**

Run: `nvm use && npm run gen:play-assets -- --lang=de && npm run gen:play-assets`
Expected: `generated design/play/icon-512.png`, then `generated design/play/de/feature-graphic.jpg`; the second run `generated design/play/feature-graphic.jpg`. Read both JPEGs: the German one shows the German `store.tagline` (`i18n/de.ts`), the default the English "Learn every squad", neither with the launch intro over it.

Then: `npm run gen:play-assets -- --lang=xx; echo "exit $?"; ls design/play/xx 2>&1`
Expected: it fails with exit 1, either on `--lang=xx: the graphic rendered as feature-graphic-en` or, if the app rejects the stored value, on a timeout waiting for the graphic; either way `design/play/xx` does not exist, because the folder is made only after the check.

- [ ] **Step 5: Check the capture script still seeds a language**

Run: `npm run shots:play -- --lang=de 2>&1 | tail -5`
Expected: ends with `captured 09-results-share-flawless-light.jpg` (or the last capture's name); the Settings check at its start would have thrown if the seed had not taken.

- [ ] **Step 6: Update the design-handoff rule**

In `.claude/rules/design-handoff.md`:

- In the command block, after the `npm run gen:play-assets` line, add:

```bash
npm run gen:play-assets -- --lang=<code>   # the feature graphic in one language, to design/play/<code>/
```

- Replace "They are regenerated for each release and attached to its GitHub Release (`docs/release.md`, Cut a release), never committed." with:

```markdown
They are regenerated for a store build that changes the listing's images, never committed:
`node scripts/store-bundle.ts` copies the listed ones (`store/screenshots.json`) into
`dist/store-listing/` for the consoles and the GitHub Release (`docs/release.md`, Cut a
release, step 7).
```

- After the sentence describing `design/play/feature-graphic.jpg`, add: "With `--lang=<code>` the graphic goes to `design/play/<code>/feature-graphic.jpg`, its tagline in that language."

Run: `npx prettier --write .claude/rules/design-handoff.md scripts/seed-language.mjs scripts/capture-screens.mjs scripts/generate-play-listing-assets.mjs app/store/feature-graphic.tsx && npx eslint scripts/*.mjs app/store/feature-graphic.tsx && npx tsc --noEmit && npx vitest run scripts/claude/__tests__/repo.test.ts`
Expected: no errors; the repo test PASSes (every path the rule cites exists by now, and `dist/` is ignored). The step number is Task 6's numbering of Cut a release.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-language.mjs scripts/capture-screens.mjs scripts/generate-play-listing-assets.mjs app/store/feature-graphic.tsx .claude/rules/design-handoff.md
git commit -m "feat(store): a feature graphic per language, clear of the launch intro (#N)"
```

---

### Task 5: The `escuadra-store-listing` skill

**Files:**

- Create: `.claude/skills/escuadra-store-listing/SKILL.md`

**Interfaces:**

- Consumes: the commands from Tasks 1–4; `docs/release.md`'s Cut a release steps as Task 6 numbers them (4 the listing, 5 privacy, 6 store-build, 7 enter the listing, 8 submit and tag).
- Produces: the skill the owner invokes, and #147 names.

- [ ] **Step 1: Write the skill**

`.claude/skills/escuadra-store-listing/SKILL.md`:

````markdown
---
name: escuadra-store-listing
description: "Use when drafting, translating, reviewing or entering Escuadra's App Store or Google Play listing: a version's What's new, the subtitle, description, keywords or promotional text, the listing screenshots or feature graphic, the App Privacy and Data safety answers in store/declarations.md, or the paste sheet at release. Also when a release issue asks for its store listing. Not for About or the privacy pages themselves."
---

# Escuadra store listing

Escuadra's App Store and Google Play listings live in `store/` and reach the consoles by
hand, from a paste sheet. This skill drafts a version's listing with the owner (draft
mode) and walks the owner through entering it (ship mode). First Read
`.claude/rules/store-listing.md` (with Read, so it loads) and `docs/release.md`, Cut a
release: this file says what to do and in what order, they say how each piece works.

## The chain

Every version's listing takes this path, numbered as `docs/release.md`'s Cut a release.
Steps 4 and 7, and the images in 8, are this skill's.

```
main                           release/X.Y.Z                  GitHub, the stores
1 app.json -> X.Y.Z (PR)
2 cut ------------------------> branch = copy of main
3 CHANGELOG [X.Y.Z] ---pick---> CHANGELOG [X.Y.Z]
4 listing PR (draft) --pick---> store/listing/*.md
                               5 privacy pages, if data changed
                               6 store-build ---------------> binaries uploaded
                               7 bundle (ship) -------------> paste sheet; owner enters it
                               8 submit, tag vX.Y.Z ---------> GitHub Release + images
```

- The text is written on `main` and picked to the release branch, like docs.
- The images are captured on the release branch, because they show the code that ships.
- The paste sheet compares with the listing that is live: the highest `vX.Y.Z` tag at or
  below `app.json`'s version. With no tag yet, everything is entered. Step 8's tag is the
  next version's baseline.

## Which mode

| The owner asks to…                                               | Mode              | Where                                         |
| ---------------------------------------------------------------- | ----------------- | --------------------------------------------- |
| draft the listing for X.Y.Z, write What's new, change a field    | Draft             | `main`, after the cut (step 4)                |
| change the listing between versions, e.g. a tournament promotion | Draft, no version | `main`                                        |
| enter, paste or submit the listing for X.Y.Z                     | Ship              | `release/X.Y.Z`, after `store-build` (step 7) |

## Draft mode

1. **Read what changed.**

   ```bash
   v=$(node -p "require('./app.json').expo.version")
   awk "/^## \[$v\]/{f=1;next} /^## \[/{f=0} f" CHANGELOG.md
   gh pr list --state merged --search "milestone:v$v" --json number,title --limit 200
   git tag --list 'v*'          # the baseline t: the highest at or below $v
   ```

   Read the five `store/listing/<lang>.md`, `store/screenshots.json` and
   `store/declarations.md`. With a baseline `t`, look at what moved since it:
   `git diff "$t" -- lib/telemetryEvents.ts` and the `about` block of
   `git diff "$t" -- i18n/en.ts` (what leaves the device), the `@telemetrydeck/sdk` and
   `expo-updates` lines of `git diff "$t" -- package.json`, and
   `git diff --stat "$t" -- design/screens/ app/store/` for the listed shots.

2. **Ask the owner, one question at a time**, with AskUserQuestion: a draft, the
   CHANGELOG line it comes from, your recommendation first, and what each option changes.
   In this order:
   1. What's new, for a version: English, at most 500 characters, from the section's
      user-facing lines, without PR numbers.
   2. Each other field: keep it, or an edit for a named CHANGELOG line. Most versions keep
      them.
   3. The screenshot set: keep it, or swap in a screen the version added
      (`design/SCREENS.md` says what each capture shows; at most 8).
   4. The declarations, only when step 1 shows that what leaves the device changed. The PR
      that changed it should have updated `store/declarations.md`
      (`.claude/rules/privacy-telemetry.md`); say so if it did not, and draft the change
      from About's text. What an answer means is the owner's (guardrail 7).

3. **Write the English** into `store/listing/en.md`, then
   `npx vitest run scripts/__tests__/store-listing.test.ts`.

4. **Translate the changed fields** into `es.md`, `fr.md`, `it.md` and `de.md`:
   - a screen or control the text names is that catalog's label for it
     (`i18n/<lang>.ts`), so the listing says what the app shows;
   - the catalog's form of address, and France's usage for French;
   - _Escuadra_ and _a la escuadra_ stay as they are.

5. **Run the language-expert loop.** For each language, dispatch a fresh subagent as a
   native-speaker app-store editor. Give it each changed field's English and translation,
   the limits, the catalog labels the text names and the fixed terms, and ask it to
   back-translate and report only what would block publication. Apply wording findings;
   bring meaning findings to the owner. Dispatch a fresh one until it returns "No
   findings": at most five rounds, then a final check scoped to what changed.

6. **Write the review sheets:** `node scripts/store-bundle.ts --review` writes
   `dist/store-listing/review/<lang>.md`, changed fields only. The owner sends them to
   the native reviewers (#145). The PR merges only after all four sign off.

7. **Open the PR.** `npm run check`, then a PR into `main` titled
   `docs(store): the X.Y.Z listing (#N)`, N being the issue the listing work runs under,
   recording each reviewer and date in its body.
   Once it is merged, pick it to the branch and open that PR into `release/X.Y.Z`:

   ```bash
   git switch -c pick/listing-X.Y.Z origin/release/X.Y.Z
   git cherry-pick -x <squash commit>
   ```

   A listing-only pick is docs to `release-gate`.

### The first run

When `store/listing/` does not exist yet (2.0.0, #147), seed `en.md` before drafting.
The public App Store page (https://apps.apple.com/us/app/escuadra/id6810705505) shows the
live subtitle and description; ask the owner to paste the keywords and promotional text
from App Store Connect. Use the six headings `FIELDS` in `scripts/store-listing.ts` gives,
under `# English`; each translation's title is its language's name in itself
(`LANGUAGE_NAMES` in `i18n/names.ts`). Confirm or change the proposed
`store/screenshots.json` with the owner. Every field is new, so every field is drafted,
translated, reviewed and entered.

## Ship mode

Only after `store-build` has run on the branch (step 6). Never trigger it.

1. From a clean checkout of `release/X.Y.Z`: `npm ci`, then `node scripts/store-bundle.ts`.
2. If it stops, naming missing captures, capture every language and run it again:

   ```bash
   for code in en es fr it de; do npm run shots:store -- --lang=$code && npm run shots:play -- --lang=$code && npm run gen:play-assets -- --lang=$code || break; done
   ```

   Look at a few captures in each language before going on: they are web renders, so a
   layout that breaks only in one language shows here first.

3. Walk `dist/store-listing/paste-sheet.md` with the owner, one store at a time, ticking
   what they confirm entered. Apple's fields and App Privacy go in before Submit for
   Review; Play's listing, release notes and Data safety when the build is uploaded; each
   store's privacy URL together with its answers.
4. After the owner tags `vX.Y.Z` (step 8), and only when the sheet marked the images
   _paste_, offer to attach them to its GitHub Release, and do it on the owner's OK:

   ```bash
   (cd dist/store-listing && zip -qr app-store.zip app-store && zip -qr play.zip play)
   gh release upload vX.Y.Z dist/store-listing/app-store.zip dist/store-listing/play.zip
   ```

## Never

- Trigger `store-build` or any EAS build: each spends the Free plan's quota, and it is the
  owner's call.
- Decide what a declaration means, or merge a translation without its native reviewer's
  sign-off.
- Enter anything in a console: the owner does, from the sheet.
- Push `gh-pages`, or upload to a GitHub Release, without the owner's OK.
- Translate _Escuadra_ or _a la escuadra_, or call the product anything else (guardrail 6).
````

- [ ] **Step 2: Format and check the skill loads**

Run: `npx prettier --write .claude/skills/escuadra-store-listing/SKILL.md && head -4 .claude/skills/escuadra-store-listing/SKILL.md`
Expected: the frontmatter intact (`name: escuadra-store-listing`, the single-quoted description on one line).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/escuadra-store-listing/SKILL.md
git commit -m "feat(store): the escuadra-store-listing skill, from draft to paste sheet (#N)"
```

---

### Task 6: The rule, the release doc and the final checks

**Files:**

- Create: `.claude/rules/store-listing.md`
- Modify: `CLAUDE.md` (the index table; guardrail 4's pointer)
- Modify: `.claude/rules/privacy-telemetry.md` (one sentence)
- Modify: `docs/release.md` (Start here; What the fingerprint can't see; Cut a release; a new Change the store listing procedure)

**Interfaces:**

- Consumes: every file and command from Tasks 1–5.
- Produces: the docs a session and the owner read; `docs/release.md`'s Cut a release steps 4–8, which the skill cites by number.

- [ ] **Step 1: Write the rule**

`.claude/rules/store-listing.md`:

```markdown
---
paths:
  - 'store/**'
  - 'scripts/store-listing.ts'
  - 'scripts/store-bundle.ts'
  - 'scripts/__tests__/store-listing.test.ts'
  - 'app/store/**'
---

# Store listings

The App Store and Google Play listings, from the words to the paste sheet. The design is
`docs/superpowers/specs/2026-10-24-store-listings-design.md`, the procedure
`docs/release.md` (Cut a release, steps 4 and 7, and Change the store listing), and the
walk-through the `escuadra-store-listing` skill.

## What lives where

- `store/listing/<lang>.md`: one file per language, six fields under fixed headings
  (`FIELDS` in `scripts/store-listing.ts`, each with its store and limit). Pasted as
  written: plain text, no Markdown formatting, which is why Prettier skips the folder.
- `store/screenshots.json`: the listing's shots in order, named as in `design/screens/`;
  the same set in every language and both stores, at most 8.
- `store/declarations.md`: English, entered once per app: the name, URLs, category, age
  rating, and the App Privacy and Data safety answers. What they mean is the owner's
  (guardrail 7), and they agree with `en.about.privacy`. A change to what leaves the device
  updates the file in the same PR (`.claude/rules/privacy-telemetry.md`).
- `STORE_LOCALES` in `scripts/store-listing.ts`: each language's locale in each console.
- The feature graphic's tagline is `store.tagline` in the catalogs, because
  `app/store/feature-graphic.tsx` is a rendered route (`.claude/rules/design-handoff.md`).

## The words

- _Escuadra_ and _a la escuadra_ are never translated, and the product has no other name
  (guardrail 6). "Football squad quiz" and the like are category words.
- A screen or control the text names is the catalog's label for it in that language, so
  the listing says what the app shows. French follows France usage.
- Each translation is signed off by a native reviewer before it merges, as the catalogs
  were (#145).

## Checks

`scripts/__tests__/store-listing.test.ts`, in `npm run check`, checks each file's headings
and their order, empty fields, each limit in characters, a field left in English, the
untranslated names, other product names, keyword spacing and repeats, the screenshot set
against `design/screens/`, and the declared privacy URL against `pageUrl('en')` in
`scripts/privacy-pages.ts`. A console's own counter has the last word on a field written
to its limit.

## The paste sheet

`node scripts/store-bundle.ts` compares with the listing that is live: the highest
`vX.Y.Z` tag at or below `app.json`'s version, found by name, because a version's tag sits
on its release branch. It marks each field, the images and the declarations _paste_ or
_skip_ and writes `dist/store-listing/paste-sheet.md`; on a `release/X.Y.Z` checkout it
also copies the images there. `--review` writes the reviewers' sheets to
`dist/store-listing/review/`. It has no npm script, because a new one would move the
fingerprint; nothing under `store/` feeds it.
```

- [ ] **Step 2: Point `CLAUDE.md` and the privacy rule at it**

In `CLAUDE.md`'s rule table, after the `design-handoff` row, add:

```markdown
| [`store-listing`](.claude/rules/store-listing.md) | Store listings, their screenshots, the console declarations |
```

In guardrail 4, change "Apple's App Privacy answers and Google Play's Data safety form:" to "Apple's App Privacy answers and Google Play's Data safety form (`store/declarations.md`):".

In `.claude/rules/privacy-telemetry.md`, at the end of the "What leaves the device" section's second paragraph, add: "Apple's App Privacy and Play's Data safety answers are `store/declarations.md` (`.claude/rules/store-listing.md`): a change to what leaves the device updates it in the same PR, as it does About."

- [ ] **Step 3: Update `docs/release.md`**

1. In Start here, add a row after "Ship a new binary":

```markdown
| Change the store listing | [Change the store listing](#change-the-store-listing) |
```

2. In "What the fingerprint can't see", replace the bullet that begins "Store listing text and screenshots, and the web privacy pages" up to "those change in Play Console, App Store Connect and on `gh-pages`." with:

```markdown
- Store listing text and screenshots, written in `store/` and entered in Play Console and
  App Store Connect from a paste sheet ([Change the store listing](#change-the-store-listing)),
  and the web privacy pages (`scripts/privacy-pages.ts`), published on `gh-pages`.
```

and keep the rest of that bullet ("The pages are versioned: …") as it is.

3. Replace Cut a release's numbered list for a new version (steps 1–6) with:

```markdown
1. The `app.json` version bump (and, the first time, the `sourceSkips` in
   `fingerprint.config.js`) lands on `main` by PR.
2. Cut the branch: `git push origin origin/main:refs/heads/release/X.Y.Z`. Fixes found
   from here on go into it by PR and on to `main` by cherry-pick.
3. On `main`, write the version's section of [`CHANGELOG.md`](../CHANGELOG.md) from the
   milestone's merged PRs (`gh pr list --state merged --search "milestone:vX.Y.Z"`), and
   pick it to the branch.
4. On `main`, draft the version's store listing with the `escuadra-store-listing` skill:
   What's new from step 3's section, and any other field or screenshot the version
   changes. It merges once each translation's native reviewer signs off; pick it to the
   branch.
5. Only if the release changes what leaves the device (guardrail 4 in `CLAUDE.md`):
   - Give the version its own folder (`POLICY_VERSION` and `POLICY_DIR` in
     `scripts/privacy-pages.ts`, whose comment says what the superseded folder gets), then
     generate and publish it before the build.
   - When the builds reach the stores, enter `store/declarations.md`'s App Privacy and
     Data safety answers and move each store's privacy URL to the new folder at the same
     moment: Play when step 6 uploads the build, Apple before step 8's Submit for Review.
     Step 7's paste sheet lists them.
   - Point the site's own Privacy nav link at the new folder once every live store
     ships the version.
6. **Actions → store-build**: `platforms: both`, `profile: production`, `submit` on. Both
   platforms build from one commit; each job checks the built runtime, opens the freeze
   and lists what's left.
7. Enter the listing. From a clean checkout of the branch, `node scripts/store-bundle.ts`
   writes `dist/store-listing/paste-sheet.md`, marking each field, the images and the
   declarations _paste_ or _skip_ against the last version's tag. When it stops for
   missing captures, capture every language and run it again:
   `for code in en es fr it de; do npm run shots:store -- --lang=$code && npm run shots:play -- --lang=$code && npm run gen:play-assets -- --lang=$code || break; done`.
   Enter what says _paste_: Apple's before Submit for Review, Play's with the release.
8. iOS: Submit for Review in App Store Connect. Android: promote the build in Play
   Console. Close each freeze once approved.
   Then tag the commit the build came from (its `store-build` run names it) and publish its
   notes: `git tag vX.Y.Z <commit> && git push origin vX.Y.Z`, then
   `awk '/^## \[X.Y.Z\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md > "$RUNNER_TEMP/notes.md"`
   (locally, any temp path) and
   `gh release create vX.Y.Z --title X.Y.Z --notes-file "$RUNNER_TEMP/notes.md"`.
   The tag is also what the next version's paste sheet compares with. When step 7 copied
   images, attach them to the same Release:
   `(cd dist/store-listing && zip -qr app-store.zip app-store && zip -qr play.zip play)`,
   then
   `gh release upload vX.Y.Z dist/store-listing/app-store.zip dist/store-listing/play.zip`.
   They stay out of git: they are
   large and change with every release. No workflow runs on tags. Play's 12-tester,
   14-day closed test gates only a new app's first production release; later updates go
   straight to review.
```

4. In "A runtime-changing fix to a released version (1.0.1)", replace step 3 ("`store-build` as above, then take the fix to `main`.") with:

```markdown
3. Its What's new as in step 4 above, then steps 6–8 as above, and take the fix to `main`.
```

5. After the Cut a release section (before "Cut preview builds"), add:

```markdown
### Change the store listing

The listing is `store/`: one Markdown file per language, the screenshot set and the
console declarations (`.claude/rules/store-listing.md`). The `escuadra-store-listing`
skill drafts a change with you, writes the reviewers' sheets
(`node scripts/store-bundle.ts --review`) and walks you through entering it. A version's
listing is [Cut a release](#cut-a-release), steps 4 and 7.

Between versions, such as promotional text for a tournament, the skill drafts the change
on `main`; it merges after the native sign-offs, and you enter what
`node scripts/store-bundle.ts`, run on `main`, marks _paste_. That sheet holds no images
and no What's new: both come only with a version. The next version's sheet marks the
change _paste_ again, because only a version's tag records what is live.
```

6. Check that no other line cites the old step numbers:

Run: `grep -nE 'step [4-8]' docs/release.md .claude/rules/*.md CLAUDE.md`
Expected: only the lines written above.

- [ ] **Step 4: Format and run the repository's doc checks**

Run: `npx prettier --write .claude/rules/store-listing.md .claude/rules/privacy-telemetry.md CLAUDE.md docs/release.md && npx vitest run scripts/claude/__tests__/repo.test.ts`
Expected: PASS: every rule within 100 lines with live globs, `CLAUDE.md` within 200, every cited path and rule present (`dist/store-listing/` is ignored, so it passes as ignored).

- [ ] **Step 5: Confirm nothing the change touches feeds the fingerprint**

```bash
npx expo-updates fingerprint:generate --platform ios > "$TMPDIR/fp-ios.json"
npx expo-updates fingerprint:generate --platform android > "$TMPDIR/fp-android.json"
for p in ios android; do
  git diff --name-only origin/main...HEAD | node -e '
    const fs = require("fs");
    const fp = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const changed = fs.readFileSync(0, "utf8").split("\n").filter(Boolean);
    const hit = changed.filter((f) => fp.sources.some((s) => s.filePath === f || (s.type === "dir" && f.startsWith(`${s.filePath}/`))));
    console.log(hit.length ? `IN THE FINGERPRINT: ${hit.join(", ")}` : "none of the changed files feeds the fingerprint");
  ' "$TMPDIR/fp-$p.json"
done
```

Expected: `none of the changed files feeds the fingerprint`, twice. Any `IN THE FINGERPRINT` line stops the task: report it, because the spec promises a listing change never needs a new version.

- [ ] **Step 6: Language-expert review of the prose agents and the owner read**

Dispatch a fresh subagent as an English technical editor for agent instructions, with the facts it needs (the commands exist as written; the step numbers are Cut a release's; "a la escuadra" and "Escuadra" are fixed terms). Give it `.claude/skills/escuadra-store-listing/SKILL.md`, `.claude/rules/store-listing.md`, `store/declarations.md`, and `git diff origin/main...HEAD -- docs/release.md CLAUDE.md .claude/rules/privacy-telemetry.md .claude/rules/design-handoff.md`. Ask it for defects only: untrue statements, ambiguity an agent would act on wrongly, repetition, noise. Apply wording findings; a finding that changes what `store/declarations.md` means goes to the owner (guardrail 7). Re-dispatch a fresh one until it returns "No findings", at most five rounds.

- [ ] **Step 7: Run everything CI runs**

Run: `nvm use && npm run check`
Expected: typecheck, lint, Prettier, Vitest, squadctl's registry check and the generated-file diffs all pass. Report the actual output.

- [ ] **Step 8: Commit**

```bash
git add .claude/rules/store-listing.md CLAUDE.md .claude/rules/privacy-telemetry.md docs/release.md
git commit -m "docs(store): the store-listing rule, and the listing in Cut a release (#N)"
```

(Include any files the review in Step 6 changed.)

---

## After the tasks

Use superpowers:finishing-a-development-branch: push `chore/N-store-listings` and open the PR into `main` titled `chore(store): store listings as files, drafted by a skill, entered from a paste sheet (#N)`, its body summarising the six commits, the fingerprint result from Task 6 Step 5 and the expert review's rounds, ending with the PR attribution line. Pushing and opening the PR wait for the owner's OK.
