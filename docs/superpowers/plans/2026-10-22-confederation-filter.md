# Confederation Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Nations tab of the team picker filters by confederation (All, UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC), the way Clubs filters by league, together with search and the A–Z list.

**Architecture:** A pure `lib/confederations.ts` maps a FIFA code (the one `lib/flags.ts` gives a nation's name) to its confederation; its test fails for any nation squad left unmapped. `lib/pickerView.ts` gains the filter's pills, labels, spoken names and caption, and `nationSections` takes the confederation. The screen reuses `PickerPill` and the league pills' scroll row. About's affiliation paragraph names the confederations, in five languages.

**Tech Stack:** Expo SDK 57, expo-router, React Native 0.86, Vitest (node environment).

**Spec:** issue #177's body, on top of `docs/superpowers/specs/2026-10-22-team-picker-design.md` (#176), which built the screen this extends. The canvas is the Handoff page's **Pick your squad — Nations** artboard, `project/Teams.dc.html` in https://claude.ai/artifact/9wopqyRq53dok9ZYqGPT8X, saved at `/private/tmp/claude-501/-Users-khachaturtovmasyan-Projects-escuadra/17769266-03f5-4c53-9c10-81ab280041ca/scratchpad/artifact-files/48702136-15ff-44ba-aebe-17e26506387c/project/Teams.dc.html`.

**Decisions taken in this plan** (the PR body lists them, open to review):

- The pills are `PickerPill`s in the league pills' scroll row: the canvas draws them identically.
- Like `leagueFilters`, a confederation with no nation squad gets no pill.
- Switching tabs drops the confederation back to All, as it does the league. The Nations tab's count is not narrowed by the confederation, as the Clubs count is not narrowed by the league.
- The canvas's caption beside the first letter ("UEFA · A–Z") is built, with "All nations · A–Z" when no confederation is picked, mirroring Clubs' "All clubs · 96".
- The acronyms are proper nouns, kept in code like `LEAGUE_NAMES`. Only the spoken regions and the "All" words are catalog text.
- The owner decided (2026-10-22) that About's affiliation paragraph names the confederations, since the picker now shows five that About did not name.

## Global Constraints

- Work in `/Users/khachaturtovmasyan/Projects/escuadra`, on the branch `feat/177-confederation-filter`, which is already checked out. Run `nvm use` first (Node 24); if it is blocked, Node 24 is at `/Users/khachaturtovmasyan/.nvm/versions/node/v24.21.0/bin`. Open project files with the Read tool, so `.claude/rules/` load.
- Guardrail 5: no hard-coded colour, spacing or font size. Colour comes from `useThemeColors()`; a missing value becomes a token in `theme/tokens.ts`, and a colour goes in **both** palettes.
- Never call `StyleSheet.create` with colours at module scope.
- User-visible text goes only through `useT()`. Every `≤ N chars` comment in `i18n/en.ts` has its group in `i18n/budgets.ts`, in file order (`i18n/__tests__/budgets.test.ts`).
- Data stays English: the acronyms and the map are code, the regions are catalog text.
- No new telemetry, no network call, no dependency, no `app.json` change. Nothing animates.
- Tests live in `__tests__/` folders that mirror the code. TypeScript stays strict, with `noUncheckedIndexedAccess`.
- Commit each task with explicit `git add` paths. Messages are conventional, reference `(#177)`, and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: The confederation map

**Files:**

- Create: `lib/confederations.ts`
- Test: `lib/__tests__/confederations.test.ts`

**Interfaces:**

- Produces:
  - `CONFEDERATIONS: readonly ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']`, the pill order.
  - `type Confederation = (typeof CONFEDERATIONS)[number]`.
  - `CONFEDERATION_MEMBERS: Record<Confederation, readonly FlagCode[]>`.
  - `confederationOf(code: FlagCode): Confederation | null`.

- [ ] **Step 1: Write the failing test.** `lib/__tests__/confederations.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFEDERATIONS, CONFEDERATION_MEMBERS, confederationOf } from '../confederations';
import { flagFor } from '../flags';
import type { SquadManifestEntry } from '@/types/squad';

// The map is hand-authored knowledge, like lib/flags.ts, so drift from the
// data is the failure to guard: a nation squad added without a confederation
// fails here, rather than vanishing from every pill but All.
const ROOT = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(
  readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf-8'),
) as SquadManifestEntry[];
const nations = manifest.filter((s) => s.kind === 'nation');

describe('confederationOf', () => {
  it('maps a nation to its confederation', () => {
    expect(confederationOf('ESP')).toBe('UEFA');
    expect(confederationOf('ARG')).toBe('CONMEBOL');
    expect(confederationOf('MEX')).toBe('CONCACAF');
    expect(confederationOf('SEN')).toBe('CAF');
    expect(confederationOf('JPN')).toBe('AFC');
    expect(confederationOf('NZL')).toBe('OFC');
  });

  it('follows the confederation, not the continent', () => {
    expect(confederationOf('AUS')).toBe('AFC');
    expect(confederationOf('KAZ')).toBe('UEFA');
    expect(confederationOf('GUY')).toBe('CONCACAF');
    expect(confederationOf('SUR')).toBe('CONCACAF');
    expect(confederationOf('CYP')).toBe('UEFA');
    expect(confederationOf('GUM')).toBe('AFC');
  });

  it('returns null for a code it does not map', () => {
    // GLP (Guadeloupe) has a flag but no nation squad.
    expect(confederationOf('GLP')).toBeNull();
  });
});

describe('CONFEDERATION_MEMBERS', () => {
  it('maps every nation squad in data/index.json', () => {
    const unmapped = nations
      .filter((s) => {
        const code = flagFor(s.name);
        return code === null || confederationOf(code) === null;
      })
      .map((s) => s.name);
    expect(unmapped).toEqual([]);
  });

  it('puts no code in two confederations', () => {
    const codes = CONFEDERATIONS.flatMap((c) => CONFEDERATION_MEMBERS[c]);
    expect(codes.filter((code, i) => codes.indexOf(code) !== i)).toEqual([]);
  });

  it('lists each confederation in the order the pills show', () => {
    expect(CONFEDERATIONS).toEqual(['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']);
    expect(Object.keys(CONFEDERATION_MEMBERS)).toEqual([...CONFEDERATIONS]);
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run lib/__tests__/confederations.test.ts`. Expected: FAIL, `Failed to resolve import "../confederations"`.

- [ ] **Step 3: Write the map.** `lib/confederations.ts`:

```ts
// FIFA code -> confederation (#177): how the picker's Nations tab is filtered.
// Pure, and hand-authored for the same reason as lib/flags.ts, whose codes it
// takes: it is knowledge, not derivable. It follows the confederation, not the
// continent, which is how fans group national teams: Australia is AFC,
// Kazakhstan and Cyprus are UEFA, Guyana and Suriname are CONCACAF.
//
// It lists only the nations that have a squad. lib/__tests__/confederations.test.ts
// fails `npm run check` for a nation squad missing here.
import type { FlagCode } from '@/assets/flags/generated';

/** The pill order. The acronyms are proper nouns: data, not catalog text. */
export const CONFEDERATIONS = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'] as const;
export type Confederation = (typeof CONFEDERATIONS)[number];

/** Each confederation's nations, by FIFA code, A–Z. */
export const CONFEDERATION_MEMBERS: Record<Confederation, readonly FlagCode[]> = {
  UEFA: [
    'ALB',
    'AND',
    'ARM',
    'AUT',
    'AZE',
    'BEL',
    'BIH',
    'BUL',
    'CRO',
    'CYP',
    'CZE',
    'DEN',
    'ENG',
    'ESP',
    'EST',
    'FIN',
    'FRA',
    'FRO',
    'GEO',
    'GER',
    'GIB',
    'GRE',
    'HUN',
    'IRL',
    'ISL',
    'ITA',
    'KAZ',
    'KOS',
    'LTU',
    'LUX',
    'LVA',
    'MDA',
    'MKD',
    'MNE',
    'NED',
    'NIR',
    'NOR',
    'POL',
    'POR',
    'ROU',
    'SCO',
    'SRB',
    'SUI',
    'SVK',
    'SVN',
    'SWE',
    'TUR',
    'UKR',
    'WAL',
  ],
  CONMEBOL: ['ARG', 'BOL', 'BRA', 'CHI', 'COL', 'ECU', 'PAR', 'PER', 'URU', 'VEN'],
  CONCACAF: [
    'AIA',
    'ARU',
    'ATG',
    'BER',
    'BLZ',
    'CAN',
    'CAY',
    'CUW',
    'DOM',
    'GRN',
    'GUA',
    'GUY',
    'HAI',
    'HON',
    'JAM',
    'LCA',
    'MEX',
    'MSR',
    'NCA',
    'PAN',
    'SKN',
    'SLV',
    'SUR',
    'TCA',
    'TRI',
    'USA',
    'VGB',
    'VIR',
  ],
  CAF: [
    'ALG',
    'BEN',
    'BFA',
    'CHA',
    'CIV',
    'CMR',
    'COD',
    'COM',
    'DJI',
    'EGY',
    'EQG',
    'ERI',
    'GHA',
    'MAR',
    'MLI',
    'NGA',
    'NIG',
    'RSA',
    'SDN',
    'SEN',
    'SEY',
    'SLE',
    'SWZ',
    'TAN',
    'TUN',
    'UGA',
    'ZIM',
  ],
  AFC: [
    'AFG',
    'AUS',
    'BAN',
    'BHR',
    'BHU',
    'BRU',
    'CAM',
    'CHN',
    'GUM',
    'HKG',
    'IDN',
    'IRN',
    'IRQ',
    'JOR',
    'JPN',
    'KOR',
    'KSA',
    'LAO',
    'LIB',
    'MAC',
    'MAS',
    'MNG',
    'MYA',
    'NEP',
    'OMA',
    'PAK',
    'PHI',
    'PLE',
    'PRK',
    'QAT',
    'SIN',
    'SRI',
    'THA',
    'TJK',
    'TKM',
    'TLS',
    'UAE',
    'UZB',
    'VIE',
    'YEM',
  ],
  OFC: ['FIJ', 'NCL', 'NZL'],
};

const BY_CODE = new Map<FlagCode, Confederation>(
  CONFEDERATIONS.flatMap((c) => CONFEDERATION_MEMBERS[c].map((code) => [code, c] as const)),
);

/** A nation's confederation, or null for a code with no nation squad. */
export function confederationOf(code: FlagCode): Confederation | null {
  return BY_CODE.get(code) ?? null;
}
```

Run `npx prettier --write lib/confederations.ts`. If it puts one code per line, keep that.

- [ ] **Step 4: Run the test.** `npx vitest run lib/__tests__/confederations.test.ts`. Expected: PASS, 6 tests. The members total 157, one per nation squad.

- [ ] **Step 5: Commit:** `feat(picker): a confederation for every nation squad (#177)`.

---

### Task 2: The filter's text, in five languages

**Files:**

- Modify: `i18n/en.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`, `i18n/it.ts`, `i18n/budgets.ts`, `i18n/__tests__/catalogs.test.ts` (`SAME_AS_ENGLISH` only)

**Interfaces:**

- Produces, in `picker`, right after `allClubs`:
  - `allConfederations: string`, the All pill on Nations, ≤ 6 chars.
  - `regions: Record<'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC', string>`, spoken after a pill's acronym.
  - `allNations: string`, the caption with no confederation picked, ≤ 22 chars.
  - `nationsCaption(name: string): string`, the caption beside the first letter.

- [ ] **Step 1: English.** In `i18n/en.ts`, insert after `allClubs` (and before `listCaption`):

```ts
    /** ≤ 6 chars: the confederation pill that clears the filter on Nations. */
    allConfederations: 'All',
    /** A confederation pill's region, spoken after its acronym: "UEFA, Europe". */
    regions: {
      UEFA: 'Europe',
      CONMEBOL: 'South America',
      CONCACAF: 'North and Central America and the Caribbean',
      CAF: 'Africa',
      AFC: 'Asia',
      OFC: 'Oceania',
    },
    /** ≤ 22 chars: the nations list's caption with no confederation picked, in mono capitals. */
    allNations: 'All nations',
    /** The nations list's caption, beside the first letter: the confederation, or "All nations". */
    nationsCaption: (name: string) => `${name} · A–Z`,
```

- [ ] **Step 2: Budgets.** Read `i18n/budgets.ts` and `i18n/__tests__/budgets.test.ts` first. After the `picker.allClubs` group, add, in order:
  - `{ budget: 6, texts: { 'picker.allConfederations': (m) => m.picker.allConfederations } }`
  - `{ budget: 22, texts: { 'picker.allNations': (m) => m.picker.allNations } }`

- [ ] **Step 3: Translate**, in the same key order, in each catalog's `picker` block. Starting drafts, for the review in Task 4 to correct:

  | key                 | de                                        | es                                        | fr (France)                              | it                                     |
  | ------------------- | ----------------------------------------- | ----------------------------------------- | ---------------------------------------- | -------------------------------------- |
  | `allConfederations` | `Alle`                                    | `Todas` (feminine: the confederaciones)   | `Toutes` (feminine: the confédérations)  | `Tutte` (feminine: the confederazioni) |
  | `regions.UEFA`      | `Europa`                                  | `Europa`                                  | `Europe`                                 | `Europa`                               |
  | `regions.CONMEBOL`  | `Südamerika`                              | `Sudamérica`                              | `Amérique du Sud`                        | `Sudamerica`                           |
  | `regions.CONCACAF`  | `Nord- und Mittelamerika und die Karibik` | `Norteamérica, Centroamérica y el Caribe` | `Amérique du Nord, centrale et Caraïbes` | `Nord e Centro America e Caraibi`      |
  | `regions.CAF`       | `Afrika`                                  | `África`                                  | `Afrique`                                | `Africa`                               |
  | `regions.AFC`       | `Asien`                                   | `Asia`                                    | `Asie`                                   | `Asia`                                 |
  | `regions.OFC`       | `Ozeanien`                                | `Oceanía`                                 | `Océanie`                                | `Oceania`                              |
  | `allNations`        | `Alle Nationen`                           | `Todas las selecciones`                   | `Toutes les sélections`                  | `Tutte le nazionali`                   |
  | `nationsCaption`    | `` (name) => `${name} · A–Z` ``           | the same                                  | the same                                 | the same                               |

  `allNations` follows each catalog's `nations` tab word ("Nationen", "Selecciones", "Sélections", "Nazionali"). Put the gender note as a `//` comment above `allConfederations`, as `allLeagues` has one.

- [ ] **Step 4: `SAME_AS_ENGLISH`.** In `i18n/__tests__/catalogs.test.ts`, add each with its reason, beside the existing `picker.listCaption` entries:
  - de: `'picker.nationsCaption'` (`"{1} · A–Z" has no words.`, merged into the `listCaption` comment).
  - fr: `'picker.nationsCaption'`, and `'picker.regions.UEFA'` (`"Europe" is French too.`).
  - es: `'picker.nationsCaption'`, and `'picker.regions.AFC'` (`"Asia" is Spanish too.`).
  - it: `'picker.nationsCaption'`, and `'picker.regions.CAF'`, `'picker.regions.AFC'`, `'picker.regions.OFC'` (`"Africa", "Asia" and "Oceania" are Italian too.`).

  If Task 4's review changes a region so that it differs from English, or matches it, add or drop its entry here: the test `shares with English only texts that are still the same` holds the list to the catalogs.

  Check the leaf paths against `i18n/leaves.ts` (nested keys are dotted, as `ladder.levels.1.title`).

- [ ] **Step 5: Verify.** `npm run typecheck && npx vitest run i18n scripts/__tests__/i18n-review-sheet.test.ts`. Expected: PASS. The About hash does not change in this task.

- [ ] **Step 6: Commit:** `feat(i18n): the confederation filter's text in five languages (#177)`.

---

### Task 3: About names the confederations

The owner decided (2026-10-22) to extend About's affiliation paragraph. Guardrail 7: the PR flags this change.

**Files:**

- Modify: `i18n/en.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`, `i18n/it.ts` (`about.intro[0]` only), `i18n/__tests__/catalogs.test.ts` (the About hash)

**Interfaces:** none. `app/about.tsx` already renders `about.intro`; `scripts/privacy-pages.ts` renders only the Privacy section, so `privacy/2/` does not change.

- [ ] **Step 1: English.** In `i18n/en.ts`, `about.intro[0]`, change exactly two phrases:
  - `associated with FIFA, UEFA, any league,` → `associated with FIFA, UEFA or any other confederation, any league,`
  - `Club and national team names are used` → `Club, national team and confederation names are used`

- [ ] **Step 2: See the hash test fail.** `npx vitest run i18n/__tests__/catalogs.test.ts -t "pins the English About"`. Expected: FAIL, with the new hash in the message.

- [ ] **Step 3: Translate the same two phrases** in each catalog's `about.intro[0]`, changing nothing else:
  - de: `weder mit der FIFA, der UEFA, einer Liga,` → `weder mit der FIFA, der UEFA oder einem anderen Kontinentalverband, einer Liga,`; `Die Namen von Vereinen und Nationalteams werden` → `Die Namen von Vereinen, Nationalteams und Kontinentalverbänden werden`.
  - es: `a la FIFA, a la UEFA, a ninguna liga,` → `a la FIFA, a la UEFA ni a ninguna otra confederación, a ninguna liga,`; `Los nombres de los clubes y de las selecciones nacionales se usan` → `Los nombres de los clubes, de las selecciones nacionales y de las confederaciones se usan`.
  - fr: `à la FIFA, à l’UEFA, à une ligue,` → `à la FIFA, à l’UEFA ou à une autre confédération, à une ligue,`; `Les noms des clubs et des sélections nationales sont utilisés` → `Les noms des clubs, des sélections nationales et des confédérations sont utilisés`.
  - it: `alla FIFA, alla UEFA, ad alcuna lega,` → `alla FIFA, alla UEFA o ad altre confederazioni, ad alcuna lega,`; `I nomi dei club e delle nazionali sono usati` → `I nomi dei club, delle nazionali e delle confederazioni sono usati`.

- [ ] **Step 4: Update the hash** in `i18n/__tests__/catalogs.test.ts` to the one Step 2 printed. This is what the test's comment asks for once every catalog's `about` matches; the review in Task 4 covers the translations.

- [ ] **Step 5: Verify.** `npm run typecheck && npx vitest run i18n`. Expected: PASS.

- [ ] **Step 6: Commit:** `docs(about): About names the confederations the picker shows (#177)`.

---

### Task 4: Native-speaker review

The controller dispatches one fresh reviewer per language (de, es, fr with France usage, it), in parallel. Each reviews the `picker` additions from Task 2 and the `about.intro[0]` change from Task 3, against `en.ts` and the rest of its catalog: meaning, idiom, budgets, gender agreement of the All pill, register, football usage (the confederation word each language's fans use), and consistency with existing words. A finding goes to a fix implementer, unless it would change the meaning, in which case it goes to the owner; for About, any wording that changes what the sentence claims goes to the owner. Repeat with fresh reviewers until every language is clean. Re-run `npx vitest run i18n` after each fix. Commit: `fix(i18n): the confederation filter's text after native review (#177)`.

---

### Task 5: The filter's pure logic

**Files:**

- Modify: `lib/pickerView.ts`
- Test: `lib/__tests__/pickerView.test.ts`

**Interfaces:**

- Consumes: `CONFEDERATIONS`, `Confederation`, `confederationOf` (Task 1); `messages.picker.allConfederations`, `regions`, `allNations`, `nationsCaption` (Task 2); `flagFor` from `lib/flags.ts`.
- Produces:
  - `type ConfederationFilter = 'ALL' | Confederation`.
  - `squadConfederation(squad: SquadManifestEntry): Confederation | null`.
  - `confederationFilters(squads: SquadManifestEntry[]): ConfederationFilter[]`.
  - `confederationLabel(filter: ConfederationFilter, messages: Messages): string`.
  - `confederationSpoken(filter: ConfederationFilter, messages: Messages): string`.
  - `nationsCaption(filter: ConfederationFilter, messages: Messages): string`.
  - `nationSections(squads, names, query = '', confederation: ConfederationFilter = 'ALL')`, the new last parameter.

- [ ] **Step 1: Write the failing tests.** In `lib/__tests__/pickerView.test.ts`, add the new names to the `../pickerView` import, then append:

```ts
// Nations under their real English names, so the flag code, and with it the
// confederation, resolves.
function nation(id: string, name: string): SquadManifestEntry {
  return { id, kind: 'nation', name } as SquadManifestEntry;
}
const EN_NAMES: SquadNames = { nameOf: (s) => s.name, locale: 'en' };
const NATIONS: SquadManifestEntry[] = [
  nation('aut', 'Austria'),
  nation('aus', 'Australia'),
  nation('arg', 'Argentina'),
  nation('esp', 'Spain'),
  nation('jpn', 'Japan'),
];

describe('squadConfederation', () => {
  it("finds a nation's confederation through its flag code", () => {
    expect(squadConfederation(nation('aus', 'Australia'))).toBe('AFC');
    expect(squadConfederation(nation('aut', 'Austria'))).toBe('UEFA');
  });

  it('gives a club none', () => {
    expect(squadConfederation(entry('bar', 'club', 'la-liga'))).toBeNull();
  });
});

describe('confederationFilters', () => {
  it('leads with ALL, then the confederations that have a nation, in pill order', () => {
    expect(confederationFilters(NATIONS)).toEqual(['ALL', 'UEFA', 'CONMEBOL', 'AFC']);
  });

  it('offers every confederation for the real squads', () => {
    expect(confederationFilters(listSquads())).toEqual([
      'ALL',
      'UEFA',
      'CONMEBOL',
      'CONCACAF',
      'CAF',
      'AFC',
      'OFC',
    ]);
  });

  it('ignores clubs', () => {
    expect(confederationFilters([entry('bar', 'club', 'la-liga')])).toEqual(['ALL']);
  });
});

describe('confederation text', () => {
  it('shows the acronym, and the catalog word for ALL', () => {
    expect(confederationLabel('UEFA', en)).toBe('UEFA');
    expect(confederationLabel('ALL', en)).toBe('All');
  });

  it('speaks the acronym, then its region', () => {
    expect(confederationSpoken('UEFA', en)).toBe('UEFA, Europe');
    expect(confederationSpoken('OFC', en)).toBe('OFC, Oceania');
    expect(confederationSpoken('ALL', en)).toBe('All');
  });

  it('captions the list with the confederation, or with all nations', () => {
    expect(nationsCaption('UEFA', en)).toBe('UEFA · A–Z');
    expect(nationsCaption('ALL', en)).toBe('All nations · A–Z');
  });
});

describe('nationSections with a confederation', () => {
  const ids = (sections: ReturnType<typeof nationSections>) =>
    sections.flatMap((s) => s.squads.map((q) => q.id));

  it('shows every nation under ALL', () => {
    expect(ids(nationSections(NATIONS, EN_NAMES))).toEqual(['arg', 'aus', 'aut', 'jpn', 'esp']);
  });

  it('shows only the picked confederation', () => {
    expect(ids(nationSections(NATIONS, EN_NAMES, '', 'UEFA'))).toEqual(['aut', 'esp']);
    expect(ids(nationSections(NATIONS, EN_NAMES, '', 'AFC'))).toEqual(['aus', 'jpn']);
  });

  it('composes the confederation with the search', () => {
    expect(ids(nationSections(NATIONS, EN_NAMES, 'au'))).toEqual(['aus', 'aut']);
    expect(ids(nationSections(NATIONS, EN_NAMES, 'au', 'UEFA'))).toEqual(['aut']);
    expect(ids(nationSections(NATIONS, EN_NAMES, 'au', 'AFC'))).toEqual(['aus']);
    expect(ids(nationSections(NATIONS, EN_NAMES, 'au', 'CONMEBOL'))).toEqual([]);
  });

  it('keeps only the letters the confederation has', () => {
    expect(nationSections(NATIONS, EN_NAMES, '', 'UEFA').map((s) => s.letter)).toEqual(['A', 'S']);
  });

  it.each(['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'] as const)(
    'shows only %s among the real squads, in every language',
    (confederation) => {
      for (const language of SUPPORTED_LANGUAGES) {
        const names: SquadNames = {
          nameOf: (s) => squadDisplayName(s, language),
          locale: language,
        };
        const shown = nationSections(listSquads(), names, '', confederation).flatMap(
          (s) => s.squads,
        );
        expect(shown.length).toBeGreaterThan(0);
        expect(shown.every((s) => squadConfederation(s) === confederation)).toBe(true);
      }
    },
  );

  it('splits the real nations among the confederations without losing one', () => {
    const all = nationSections(listSquads(), EN_NAMES).flatMap((s) => s.squads).length;
    const split = (['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'] as const)
      .map((c) => nationSections(listSquads(), EN_NAMES, '', c).flatMap((s) => s.squads).length)
      .reduce((a, b) => a + b, 0);
    expect(split).toBe(all);
  });
});
```

Check `squadDisplayName`'s signature in `i18n/displayNames.ts` and how the existing `nationSections` tests build their `SquadNames`; match them.

- [ ] **Step 2: Run to see them fail.** `npx vitest run lib/__tests__/pickerView.test.ts`. Expected: FAIL, the new imports are not exported.

- [ ] **Step 3: Implement.** In `lib/pickerView.ts`, add imports:

```ts
import { CONFEDERATIONS, confederationOf, type Confederation } from '@/lib/confederations';
import { flagFor } from '@/lib/flags';
```

After `leagueFilters`, add:

```ts
/** The nations tab's confederation filter (#177). `'ALL'` is the default. */
export type ConfederationFilter = 'ALL' | Confederation;

/** A nation's confederation, through the flag code of its English name; null
 *  for a club, or a nation `lib/confederations.ts` does not map. */
export function squadConfederation(squad: SquadManifestEntry): Confederation | null {
  if (squad.kind !== 'nation') return null;
  const code = flagFor(squad.name);
  return code === null ? null : confederationOf(code);
}

/** `'ALL'` plus every confederation that has a nation in the manifest, in
 *  `CONFEDERATIONS` order: like `leagueFilters`, no pill filters to nothing. */
export function confederationFilters(squads: SquadManifestEntry[]): ConfederationFilter[] {
  const present = new Set<Confederation>();
  for (const squad of squads) {
    const confederation = squadConfederation(squad);
    if (confederation !== null) present.add(confederation);
  }
  return ['ALL', ...CONFEDERATIONS.filter((c) => present.has(c))];
}

/** A confederation pill's label: the acronym, a proper noun like a league's name. */
export function confederationLabel(filter: ConfederationFilter, messages: Messages): string {
  return filter === 'ALL' ? messages.picker.allConfederations : filter;
}

/** A confederation pill's spoken name: "UEFA, Europe". */
export function confederationSpoken(filter: ConfederationFilter, messages: Messages): string {
  return filter === 'ALL'
    ? messages.picker.allConfederations
    : [filter, messages.picker.regions[filter]].join(', ');
}

/** The nations list's caption, beside its first letter: "UEFA · A–Z". */
export function nationsCaption(filter: ConfederationFilter, messages: Messages): string {
  return messages.picker.nationsCaption(filter === 'ALL' ? messages.picker.allNations : filter);
}
```

Change `nationSections` to take the confederation last, and filter by it:

```ts
/** The nations tab grouped A–Z (#176), in the app's language: the visible
 *  nations in `visibleSquads`' order, narrowed to one confederation unless it
 *  is `'ALL'` (#177), under the first letter of their displayed name. A letter
 *  the locale's order would split (a folded "Ñ" after "N") still opens once:
 *  later names join its section. */
export function nationSections(
  squads: SquadManifestEntry[],
  names: SquadNames,
  query = '',
  confederation: ConfederationFilter = 'ALL',
): NationSection[] {
  const sections: NationSection[] = [];
  const byLetter = new Map<string, NationSection>();
  for (const squad of visibleSquads(squads, 'nation', 'ALL', names, query)) {
    if (confederation !== 'ALL' && squadConfederation(squad) !== confederation) continue;
    // …the rest of the loop as it is.
  }
  return sections;
}
```

Update `kindCounts`' doc comment: "The league and confederation filters do not narrow it."

- [ ] **Step 4: Run the tests.** `npx vitest run lib/__tests__/pickerView.test.ts && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit:** `feat(picker): nations narrowed to a confederation, with its pills and caption (#177)`.

---

### Task 6: The screen

**Files:**

- Modify: `components/PickerPill.tsx`, `app/team-picker.tsx`

**Interfaces:**

- Consumes: everything Task 5 produces.
- Produces: `PickerPill({ label, active, onPress, spokenLabel?, testID? })`; pills with `testID`s `confederation-<filter>` (e.g. `confederation-UEFA`) and `league-<filter>`.

- [ ] **Step 1: `PickerPill`.** Add two optional props and pass them to the `Pressable`:

```tsx
interface PickerPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  /** What a screen reader says, when it differs from the label: "UEFA, Europe". */
  spokenLabel?: string;
  testID?: string;
}
```

On the `Pressable`: `testID={testID}` and `accessibilityLabel={spokenLabel}`. Update the header comment: "A filter pill: a league on Clubs, a confederation on Nations (#176, #177)."

- [ ] **Step 2: State.** In `app/team-picker.tsx`:
  - Import `confederationFilters`, `confederationLabel`, `confederationSpoken`, `nationsCaption` and `type ConfederationFilter` from `@/lib/pickerView`.
  - `const [confederation, setConfederation] = useState<ConfederationFilter>('ALL');`
  - `const confederations = useMemo(() => confederationFilters(squads), [squads]);`
  - `sections`: `nationSections(squads, names, query, confederation)`, with `confederation` in its deps.
  - `layoutKey`: `` `${filter}|${language}|${query}|${confederation}` ``, and its comment: "A new tab, language, search or confederation starts a new one".
  - `changeKind` also calls `setConfederation('ALL')`. Its comment: "Switching tabs drops the league and the confederation back to ALL, so a tab always opens unfiltered…" (keep the rest of its reasoning).
  - Add, beside `changeQuery`:

```tsx
const changeConfederation = (next: ConfederationFilter) => {
  setConfederation(next);
  setCurrent(null);
  jumped.current = null;
};
```

- [ ] **Step 3: The pill row.** Show the scroll row on both tabs, and key it by the tab so each opens scrolled to its start. Rename `leagueTrack` and `leagueRow` to `pillTrack` and `pillRow` (their comments stand):

```tsx
<ScrollView
  key={filter}
  horizontal
  showsHorizontalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  style={styles.pillTrack}
  contentContainerStyle={styles.pillRow}
>
  {filter === 'club'
    ? leagues.map((l) => (
        <PickerPill
          key={l}
          testID={`league-${l}`}
          label={leagueLabel(l, t)}
          active={league === l}
          onPress={() => setLeague(l)}
        />
      ))
    : confederations.map((c) => (
        <PickerPill
          key={c}
          testID={`confederation-${c}`}
          label={confederationLabel(c, t)}
          spokenLabel={confederationSpoken(c, t)}
          active={confederation === c}
          onPress={() => changeConfederation(c)}
        />
      ))}
</ScrollView>
```

- [ ] **Step 4: The caption.** The first letter heading carries the caption beside its letter, on the letter's baseline, as on the canvas. Add styles:

```ts
    heading: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, paddingBottom: spacing.xxs },
    // The caption shrinks before it pushes the row wider than the screen.
    nationsCaption: { ...typography.monoCaption, color: colors.textMuted, flexShrink: 1 },
```

and inside the heading `View`, after the letter's `Text`:

```tsx
{
  i === 0 && (
    <Text style={styles.nationsCaption} numberOfLines={1}>
      {nationsCaption(confederation, t)}
    </Text>
  );
}
```

The heading stays a direct child of the ScrollView's content; its `onLayout` is unchanged.

- [ ] **Step 5: Update the header comment** of `TeamPicker`: "…nations are grouped A–Z, narrowed by confederation (#177), with a letter rail pinned over the right edge."

- [ ] **Step 6: Verify.** `npm run typecheck && npm run lint && npx vitest run`. Expected: PASS. Then start the web build (`npx expo start --web`), open `/team-picker`, tap Nations, and check by hand: each pill shows only its confederation; a search narrows within it; the rail shows only that confederation's letters and a jump still lands; "All" restores every nation; switching to Clubs and back resets to All; an empty combination shows "No teams found". Stop the server.

- [ ] **Step 7: Commit:** `feat(picker): confederation pills on the Nations tab (#177)`.

---

### Task 7: Shots, docs and rules

**Files:**

- Modify: `scripts/capture-screens.mjs`, `design/SCREENS.md`, `design/screens/*`, `.claude/rules/squad-data.md`

- [ ] **Step 1: The capture script.** In `scripts/capture-screens.mjs`, after the `03b-team-picker-nations-jump` shot, add:

```js
// A confederation picked, from a fresh open so the list starts at the top.
await capture.open('/team-picker');
await capture.tapId('kind-nation', { wait: SWAP_MS });
await capture.tapId('confederation-UEFA', { wait: SWAP_MS });
await capture.shoot('03c-team-picker-nations-uefa');
```

- [ ] **Step 2: Regenerate.** Run `npm run shots`. Restore any PNG that changed only because a photo had not loaded (`git checkout -- <file>`). Use the Read tool on `03-team-picker-nations`, `03b-…` and `03c-…`, dark and light, and compare them with the canvas artboard `Teams.dc.html` (path in the header). Ignore Your squads and OUTDATED, which are #179 and #180.

- [ ] **Step 3: `design/SCREENS.md`.** In the `/team-picker` route row, add "and confederation pills on Nations" after the league pills, and the caption `ALL NATIONS · A–Z` beside the first letter. Add the capture row `screens/03c-team-picker-nations-uefa.png | Team picker, Nations, UEFA`, and a sentence in the team picker paragraph: "`03c-team-picker-nations-uefa.png` is Nations with UEFA picked: the caption `UEFA · A–Z` beside the `A`, only UEFA's nations, and a rail of only their letters." Update `03-team-picker-nations.png`'s sentence to mention the All pill picked and the caption.

- [ ] **Step 4: The squad-data rule.** In `.claude/rules/squad-data.md`, add `"lib/confederations.ts"` to `paths`, and after the `League` paragraph:

```md
A nation squad's confederation (the picker's Nations filter) is
`lib/confederations.ts`, keyed by the FIFA code `lib/flags.ts` gives its name. A new
nation needs both: `lib/__tests__/flags.test.ts` and
`lib/__tests__/confederations.test.ts` fail until it has them.
```

Then grep `.claude/rules`, `docs/*.md` and `tools/squadctl/README.md` for "league pills" and "new nation" and fix any sentence the change made untrue.

- [ ] **Step 5: Verify.** Run `npm run check`, keep its output, and commit: `docs(picker): screens and docs for the confederation filter (#177)`.
