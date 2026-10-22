# Team Picker Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The team picker in the 2.0 look: a squad count, a display title, Clubs/Nations tabs with counts, league pills, rows with a score block, clubs as a list, and nations A–Z with a letter rail.

**Architecture:** Pure logic (grouping, the current letter, counts, the score block) in `lib/pickerView.ts`, test first. Small components (`RoundBackButton`, `KindTabs`, `PickerPill`, `TeamRow`, `LetterRail`), and one screen that scrolls as a whole in a `ScrollView`, recording each letter heading's offset.

**Tech Stack:** Expo SDK 57, expo-router, React Native 0.86, Zustand, Vitest (node environment).

**Spec:** `docs/superpowers/specs/2026-10-22-team-picker-design.md` (issue #176). Read it before any task.

## Global Constraints

- Work in `/Users/khachaturtovmasyan/Projects/escuadra/.claude/worktrees/176-team-picker`. Node 24 is at `/Users/khachaturtovmasyan/.nvm/versions/node/v24.21.0/bin`; call it directly if `nvm use` is blocked. Open project files with the Read tool, so `.claude/rules/` load.
- Guardrail 5: no hard-coded colour, spacing or font size. Colour comes from `useThemeColors()`; a missing value becomes a token in `theme/tokens.ts`, and a colour goes in **both** palettes. Team colours come only from squad data.
- Never call `StyleSheet.create` with colours at module scope.
- User-visible text goes only through `useT()`. Every `≤ N chars` comment in `i18n/en.ts` has its group in `i18n/budgets.ts`, in file order (`i18n/__tests__/budgets.test.ts`).
- No new telemetry, no network call, no dependency, no `app.json` change. Nothing animates.
- Tests live in `__tests__/` folders that mirror the code. TypeScript stays strict, with `noUncheckedIndexedAccess`.
- Commit each task with explicit `git add` paths, never `.superpowers/`. Messages are conventional, reference `(#176)`, and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `expo-router` typed routes: `.expo/types/router.d.ts` is generated and gitignored. If `tsc` rejects a route, start `node node_modules/expo/bin/cli start --web --port 8099` briefly to regenerate it. Never cast a route.

---

### Task 1: Tokens, and the shared round back button

**Files:**

- Modify: `theme/tokens.ts`, `theme/__tests__/tokens.test.ts`, `app/settings.tsx`, `components/SettingsSection.tsx`
- Create: `components/RoundBackButton.tsx`

**Interfaces:**

- Produces:
  - Palette roles `ctaMuted` and `markerRing`.
  - Typography `displayTitle` (renamed from `settingsTitle`), `monoCaption` (renamed from `settingsSection`), `teamName`, `rowLevel`, `rowScore`, `rowScoreTail`, `letterHeading`, `railLetter`, `tabLabel`, `pillLabel`, `pillLabelActive` and `searchInput`.
  - `sizes.roundButton` (moved from `sizes.settings.roundButton`), `sizes.pickerMarker` `{width:40,height:27,radius:5}`, `sizes.pickerRow` (60), `sizes.pickerPill` (40), `sizes.pickerTab` (44), `sizes.searchField` (52) and `sizes.rail` `{width:44,letter:14}`.
  - `RoundBackButton({ onPress, testID?, label })`.

- [ ] **Step 1: Roles.** Add `ctaMuted` and `markerRing` to the `Palette` interface, after `plateMark`, with comments: "A quiet count on `ctaBg` (the picker's selected tab)" and "The ring round a 40 × 27 team marker in the picker". In `darkRoles`, set `ctaMuted: '#4b4f56'` and `markerRing: 'rgba(255,255,255,0.12)'`. In `lightRoles`, set `ctaMuted: '#b4b8bb'` and `markerRing: 'rgba(20,22,26,0.12)'`.
- [ ] **Step 2: Renames.** Rename `typography.settingsTitle` to `displayTitle` and `settingsSection` to `monoCaption`, with comments that Settings and the picker share them. Move `sizes.settings.roundButton` to `sizes.roundButton`, with the comment "The 44 pt round back button (Settings, the picker)". Update every user:

  ```
  grep -rn "settingsTitle\|settingsSection\|settings.roundButton\|g.roundButton" app components
  ```

- [ ] **Step 3: New typography,** after `soonChip`:

```ts
  // ---- 2.0 team picker (#176) ----
  teamName: { fontFamily: 'Inter-Bold', fontSize: 16 },
  rowLevel: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  // The natural line height (1.088 of the size), as `shirtNumber` explains:
  // iOS clips this face's digits to a tighter line box.
  rowScore: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 24, lineHeight: 26 },
  rowScoreTail: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 15 },
  letterHeading: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 34, lineHeight: 37 },
  railLetter: { fontFamily: 'IBMPlexMono-Bold', fontSize: 10, lineHeight: 14 },
  tabLabel: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  pillLabel: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 14 },
  pillLabelActive: { fontFamily: 'Inter-Bold', fontSize: 14 },
  searchInput: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 16 },
```

`theme/__tests__/tokens.test.ts` counts the Archivo styles. Raise its expected count by the 4 added here (`rowScore`, `rowScoreTail`, `letterHeading` and `tabLabel`), and keep its no-`fontWeight` check passing.

- [ ] **Step 4: New sizes,** in `sizes` after `settings`:

```ts
  // The 44 pt round back button (Settings, the picker).
  roundButton: 44,
  // The team picker (#176): a row's marker or flag, the row, a league pill, a
  // tab, the search field, and the letter rail (its touch column and the
  // height of one letter).
  pickerMarker: { width: 40, height: 27, radius: 5 },
  pickerRow: 60,
  pickerPill: 40,
  pickerTab: 44,
  searchField: 52,
  rail: { width: 44, letter: 14 },
```

- [ ] **Step 5: `components/RoundBackButton.tsx`.** Move Settings' back button out of `app/settings.tsx`, where its `round` style and Pressable now live:

```tsx
import { Pressable, StyleSheet } from 'react-native';
import { BackGlyph } from '@/components/ActionGlyphs';
import { borderWidths, opacity, sizes } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// The 2.0 back button (Settings, the team picker): a 44 pt circle in `surface`
// with a hairline `border`, the chevron in `textPrimary`.
export function RoundBackButton({
  onPress,
  label,
  testID,
}: {
  onPress: () => void;
  /** Spoken: `t.common.back`. */
  label: string;
  testID?: string;
}) {
  const colors = useThemeColors();
  const size = sizes.roundButton;
  const styles = StyleSheet.create({
    round: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, pressed && { opacity: opacity.settled }]}
    >
      <BackGlyph color={colors.textPrimary} />
    </Pressable>
  );
}
```

In `app/settings.tsx`, replace the inline back Pressable with `<RoundBackButton testID="settings-back" label={t.common.back} onPress={() => router.back()} />`, and drop the now unused `round` style and imports. Home's gear in `app/index.tsx` uses the same circle: point its size at `sizes.roundButton`.

- [ ] **Step 6: Verify.** Run `npm run typecheck && npm run lint && npx vitest run theme`. Expected: PASS.
- [ ] **Step 7: Commit:** `feat(theme): tokens for the team picker, and one round back button (#176)`.

---

### Task 2: The picker's pure logic

**Files:**

- Modify: `lib/pickerView.ts`
- Test: `lib/__tests__/pickerView.test.ts`

**Interfaces:**

- Produces, from `@/lib/pickerView`:
  - `initialOf(name: string): string`
  - `interface NationSection { letter: string; squads: SquadManifestEntry[] }`
  - `nationSections(squads, names: SquadNames, query?: string): NationSection[]`
  - `interface LetterOffset { letter: string; y: number }`
  - `letterAt(offsets: readonly LetterOffset[], y: number): string | null`
  - `kindCounts(squads, names, query?): { club: number; nation: number }`
  - `type ScoreBlock = { kind: 'hydrating' } | { kind: 'unplayed' } | { kind: 'played'; level: number; correct: number; total: number; flawless: boolean }`
  - `scoreBlock(progress: TeamProgress | null | undefined): ScoreBlock`
- Removes `teamMetaLine` and its tests; Task 5 removes its only caller, `TeamRow`'s sub-line. `teamProgress`, `leagueFilters`, `leagueLabel`, `visibleSquads` and `SquadNames` stay.

- [ ] **Step 1: Write the failing tests.** Append to `lib/__tests__/pickerView.test.ts`, extending its imports with `initialOf`, `nationSections`, `letterAt`, `kindCounts`, `scoreBlock`, `squadDisplayName` from `@/i18n/displayNames`, `listSquads` from `@/lib/squads`, and `SUPPORTED_LANGUAGES` from `@/i18n/resolveLanguage`:

```ts
const namesIn = (language: (typeof SUPPORTED_LANGUAGES)[number]): SquadNames => ({
  nameOf: (s) => squadDisplayName(s, language),
  locale: language,
});

describe('initialOf', () => {
  it('folds accents and case, as search does', () => {
    expect(initialOf('Ägypten')).toBe('A');
    expect(initialOf('Égypte')).toBe('E');
    expect(initialOf('Österreich')).toBe('O');
    expect(initialOf('italia')).toBe('I');
  });
});

describe.each(SUPPORTED_LANGUAGES)('nationSections in %s', (language) => {
  const names = namesIn(language);
  const squads = listSquads();
  const sections = nationSections(squads, names);
  const nations = squads.filter((s) => s.kind === 'nation');

  it('lists every nation exactly once', () => {
    const ids = sections.flatMap((s) => s.squads.map((q) => q.id));
    expect(ids).toHaveLength(nations.length);
    expect(new Set(ids).size).toBe(nations.length);
  });

  it('opens each letter once, in alphabetical order', () => {
    const letters = sections.map((s) => s.letter);
    expect(new Set(letters).size).toBe(letters.length);
    expect([...letters].sort((a, b) => a.localeCompare(b, language))).toEqual(letters);
  });

  it("files each nation under its displayed name's first letter", () => {
    for (const section of sections) {
      for (const squad of section.squads) {
        expect(initialOf(names.nameOf(squad))).toBe(section.letter);
      }
    }
  });

  it('keeps the displayed order inside a letter', () => {
    for (const section of sections) {
      const shown = section.squads.map((q) => names.nameOf(q));
      expect([...shown].sort((a, b) => a.localeCompare(b, language))).toEqual(shown);
    }
  });
});

describe('nationSections with a search', () => {
  it('keeps only the matching nations, still grouped', () => {
    const sections = nationSections(listSquads(), namesIn('en'), 'spa');
    expect(sections.map((s) => s.letter)).toEqual(['S']);
    expect(sections[0]?.squads.map((q) => q.name)).toContain('Spain');
  });

  it('is empty when nothing matches', () => {
    expect(nationSections(listSquads(), namesIn('en'), 'zzzz')).toEqual([]);
  });
});

describe('letterAt', () => {
  const offsets = [
    { letter: 'A', y: 400 },
    { letter: 'B', y: 900 },
    { letter: 'C', y: 1300 },
  ];
  it('is the first letter above the first heading', () => {
    expect(letterAt(offsets, 0)).toBe('A');
  });
  it('is the last heading at or above the offset', () => {
    expect(letterAt(offsets, 900)).toBe('B');
    expect(letterAt(offsets, 1299)).toBe('B');
    expect(letterAt(offsets, 5000)).toBe('C');
  });
  it('is null with no headings', () => {
    expect(letterAt([], 100)).toBeNull();
  });
});

describe('kindCounts', () => {
  it('counts every squad of each kind with no search', () => {
    const squads = listSquads();
    const counts = kindCounts(squads, namesIn('en'));
    expect(counts.club + counts.nation).toBe(squads.length);
  });
  it('counts the matches on each tab with a search', () => {
    const counts = kindCounts(listSquads(), namesIn('en'), 'spain');
    expect(counts.nation).toBe(1);
  });
});

describe('scoreBlock', () => {
  it('waits while the store hydrates', () => {
    expect(scoreBlock(undefined)).toEqual({ kind: 'hydrating' });
  });
  it('is unplayed for a team with no score', () => {
    expect(scoreBlock(null)).toEqual({ kind: 'unplayed' });
  });
  it('shows the highest level and its best', () => {
    expect(scoreBlock({ level: 2, correct: 7, total: 10, cleared: true })).toEqual({
      kind: 'played',
      level: 2,
      correct: 7,
      total: 10,
      flawless: false,
    });
  });
  it('marks 10/10 as flawless', () => {
    expect(scoreBlock({ level: 3, correct: 10, total: 10, cleared: true })).toMatchObject({
      flawless: true,
    });
  });
});
```

Delete the `teamMetaLine` `describe` block and its import. If "Spain" is not `S` in English, or the `'spain'` search matches more than one nation, read the data and correct the expectation, not the code.

- [ ] **Step 2: Run them.** `npx vitest run lib/__tests__/pickerView.test.ts`. Expected: FAIL, with the new functions not exported.
- [ ] **Step 3: Implement.** In `lib/pickerView.ts`, delete `teamMetaLine` and its `Messages` import if nothing else uses it. Add:

```ts
/** A displayed name's first letter, folded as search folds it: "Ägypten" is
 *  filed under A, "Égypte" under E. */
export function initialOf(name: string): string {
  return fold(name).charAt(0).toUpperCase();
}

/** One letter of the nations tab and its nations, in the displayed order. */
export interface NationSection {
  letter: string;
  squads: SquadManifestEntry[];
}

/** The nations tab grouped A–Z (#176), in the app's language: the visible
 *  nations in `visibleSquads`' order, under the first letter of their displayed
 *  name. A letter the locale's order would split (a folded "Ñ" after "N") still
 *  opens once: later names join its section. */
export function nationSections(
  squads: SquadManifestEntry[],
  names: SquadNames,
  query = '',
): NationSection[] {
  const sections: NationSection[] = [];
  const byLetter = new Map<string, NationSection>();
  for (const squad of visibleSquads(squads, 'nation', 'ALL', names, query)) {
    const letter = initialOf(names.nameOf(squad));
    let section = byLetter.get(letter);
    if (section === undefined) {
      section = { letter, squads: [] };
      byLetter.set(letter, section);
      sections.push(section);
    }
    section.squads.push(squad);
  }
  return sections;
}

/** Where a letter's heading sits in the scrolled content. */
export interface LetterOffset {
  letter: string;
  y: number;
}

/** The letter in view: the last heading at or above `y`, or the first
 *  letter before any heading is reached. `offsets` is in scroll order. */
export function letterAt(offsets: readonly LetterOffset[], y: number): string | null {
  let current = offsets[0]?.letter ?? null;
  for (const offset of offsets) {
    if (offset.y > y) break;
    current = offset.letter;
  }
  return current;
}

/** Each tab's count: the squads of that kind matching the search. The league
 *  filter does not narrow it. */
export function kindCounts(
  squads: SquadManifestEntry[],
  names: SquadNames,
  query = '',
): { club: number; nation: number } {
  return {
    club: visibleSquads(squads, 'club', 'ALL', names, query).length,
    nation: visibleSquads(squads, 'nation', 'ALL', names, query).length,
  };
}

/** What a row's right-hand side shows. `hydrating` shows nothing, so a row
 *  never claims "not played" for a squad whose scores are still loading. */
export type ScoreBlock =
  | { kind: 'hydrating' }
  | { kind: 'unplayed' }
  | { kind: 'played'; level: number; correct: number; total: number; flawless: boolean };

export function scoreBlock(progress: TeamProgress | null | undefined): ScoreBlock {
  if (progress === undefined) return { kind: 'hydrating' };
  if (progress === null) return { kind: 'unplayed' };
  return {
    kind: 'played',
    level: progress.level,
    correct: progress.correct,
    total: progress.total,
    flawless: progress.correct === progress.total,
  };
}
```

- [ ] **Step 4: Run them.** `npx vitest run lib/__tests__/pickerView.test.ts`. Expected: PASS. `npm run typecheck` fails until Task 5 because of `components/TeamRow.tsx`'s `teamMetaLine`. To keep this commit green, in this task replace that call in `TeamRow` with `{season}` alone; Task 5 rewrites the row.
- [ ] **Step 5: Commit:** `feat(picker): nations grouped A–Z, the letter in view, tab counts and the score block (#176)`.

---

### Task 3: Text, in five languages

**Files:**

- Modify: `i18n/en.ts`, `de.ts`, `es.ts`, `fr.ts`, `it.ts`, `i18n/budgets.ts`, and `i18n/__tests__/catalogs.test.ts` (SAME_AS_ENGLISH only, if needed)

**Interfaces:**

- Produces, in `picker`:
  - `allLeagues` ("All")
  - `title` ("Pick your squad")
  - `squadCount(n)` ("253 squads")
  - `clubs` ("Clubs")
  - `nations` ("Nations")
  - `allClubs` ("All clubs")
  - `listCaption(name, count)`
  - `bestSpoken(level, correct, total)`
  - `search`, `clearSearch`, `noTeams` and `noResults`
- Removes `picker.notPlayed`, `played`, `home`, `count` and `nationalTeams`.

- [ ] **Step 1: English.** Replace the `picker` block in `i18n/en.ts` with:

```ts
  picker: {
    /** ≤ 6 chars: the league pill that clears the filter. */
    allLeagues: 'All',
    /** ≤ 22 chars: the title, in display capitals on two lines. */
    title: 'Pick your squad',
    /** ≤ 14 chars: the top bar's count of every squad, in mono capitals. */
    squadCount: (count: number) => (count === 1 ? `${count} squad` : `${count} squads`),
    /** ≤ 10 chars each: a tab, in display capitals, beside its count. */
    clubs: 'Clubs',
    nations: 'Nations',
    /** ≤ 16 chars: the clubs list's caption with no league picked, in mono capitals. */
    allClubs: 'All clubs',
    /** The clubs list's caption: the league (or "All clubs") and how many it lists. */
    listCaption: (name: string, count: number) => `${name} · ${count}`,
    /** A played row's score block, spoken after the team's name. */
    bestSpoken: (level: number, correct: number, total: number) =>
      `Level ${level}, best ${correct} of ${total}`,
    /** The search field's placeholder and spoken name. */
    search: 'Search teams',
    clearSearch: 'Clear search',
    noTeams: 'No teams found',
    noResults: (query: string) => `No results for "${query}"`,
  },
```

- [ ] **Step 2: Budgets.** In `i18n/budgets.ts`, replace the picker groups with ones that match the comments above, in order:
  - 6: `picker.allLeagues`
  - 22: `picker.title`
  - 14: `picker.squadCount`, sampled at `(m) => m.picker.squadCount(253)`
  - 10: `picker.clubs` and `picker.nations`
  - 16: `picker.allClubs`

  Remove the groups for the deleted keys. Read `i18n/__tests__/budgets.test.ts` first, so the count of groups and comments still lines up.

- [ ] **Step 3: Callers.** Temporarily, until Task 6 rewrites the screen, make `app/team-picker.tsx` compile:
  - `t.picker.nationalTeams` → `t.picker.nations`
  - `t.picker.count(…)` → `t.picker.squadCount(…)`
  - `t.picker.home` → `t.common.back`

  Then grep for the other removed keys and fix any caller.

- [ ] **Step 4: Translate** in `de`, `es`, `fr` (France usage) and `it`, in the same key order:
  - Reuse each catalog's existing words: its `clubs`, `search`, `clearSearch`, `noTeams` and `noResults`; its old `nationalTeams` word where it fits 10 characters, or its plain word for "Nations"; its `allLeagues` in sentence case, as "All" is now.
  - `bestSpoken` follows each catalog's wording of a score; read its `common.scoreSpoken`.
  - `squadCount` writes each language's own plural.
  - Keep every budget.
- [ ] **Step 5: Verify.** Run `npm run typecheck && npx vitest run i18n`. The About hash must not change, since nothing in `about` moved. Add a `SAME_AS_ENGLISH` entry, with its reason, only for a text that is genuinely the same word: for example, `listCaption` has no words (`"{1} · {2}"`).
- [ ] **Step 6: Commit:** `feat(i18n): the team picker's text in five languages (#176)`.

---

### Task 4: Native-speaker review

The controller dispatches one fresh reviewer per language (de, es, fr with France usage, it), in parallel. Each reviews only the `picker` changes from Task 3, against `en.ts` and the rest of its catalog: meaning, idiom, budgets, plurals, register, and consistency with existing words. A finding goes to a fix implementer, unless it would change the meaning, in which case it goes to the owner. Repeat with fresh reviewers until every language is clean. Commit: `fix(i18n): the team picker's text after native review (#176)`.

---

### Task 5: The picker's components

**Files:**

- Create: `components/KindTabs.tsx`, `components/PickerPill.tsx`, `components/LetterRail.tsx`
- Rewrite: `components/TeamRow.tsx`
- Modify: `components/SearchField.tsx`, `components/Flag.tsx`, `components/TeamMarker.tsx`
- Delete: `components/SegmentedControl.tsx`, whose only user is the picker. Task 6 removes that use, so delete the file in Task 6 if it still has one here.

**Interfaces:**

- Consumes: the Task 1 tokens, `ScoreBlock`/`scoreBlock` (Task 2), and `t.picker.*` (Task 3).
- Produces:
  - `KindTabs({ value: 'club'|'nation', counts: {club:number;nation:number}, onChange })`
  - `PickerPill({ label, active, onPress })`
  - `TeamRow({ name, marker, flag?, progress, onPress })`, with `progress: TeamProgress | null | undefined`
  - `LetterRail({ letters: readonly string[], current: string | null, onJump: (letter: string) => void })`
  - `Flag` size `'picker'` and `TeamMarker` variant `'picker'`

- [ ] **Step 1: `Flag` and `TeamMarker`.**
  - `Flag`: add `picker: sizes.pickerMarker` to `DIMENSIONS`, and to the `FlagSize` type wherever that is declared. At `size === 'picker'`, use `borderRadius: sizes.pickerMarker.radius` and `borderColor: colors.markerRing`.
  - `TeamMarker`: add a `'picker'` variant, sized `sizes.pickerMarker`, with its radius, a hairline `markerRing` border and `overflow: 'hidden'`. It is drawn in the squad's own orientation, like `default`.
- [ ] **Step 2: `TeamRow`.** Rewrite the file:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flag } from './Flag';
import { ChevronGlyph } from './SettingsGlyphs';
import { TeamMarker } from './TeamMarker';
import type { FlagCode } from '@/assets/flags/generated';
import { useT } from '@/i18n/useT';
import { scoreBlock, type TeamProgress } from '@/lib/pickerView';
import type { TeamMarker as TeamMarkerData } from '@/types/squad';
import { borderWidths, opacity, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface TeamRowProps {
  name: string;
  marker: TeamMarkerData;
  /** A nation's flag, in place of the bands; never for a club (guardrail 2).
   *  Null when lib/flags.ts has no flag for it: the row falls back to the bands. */
  flag?: FlagCode | null;
  /** `undefined` while the store hydrates, `null` when never played. */
  progress: TeamProgress | null | undefined;
  onPress: () => void;
}

// A picker row (#176): the marker at 40 × 27, the name, and on the right the
// best of the highest level played, or a chevron when the team is unplayed.
export function TeamRow({ name, marker, flag, progress, onPress }: TeamRowProps) {
  const colors = useThemeColors();
  const t = useT();
  const block = scoreBlock(progress);
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      minHeight: sizes.pickerRow,
      borderBottomWidth: borderWidths.hairline,
      borderBottomColor: colors.hairline,
    },
    name: { ...typography.teamName, color: colors.textPrimary, flex: 1, minWidth: 0 },
    score: { alignItems: 'flex-end', gap: spacing.xxs / 2 },
    level: { ...typography.rowLevel, color: colors.textMuted },
    best: { ...typography.rowScore, color: colors.textPrimary },
    tail: { ...typography.rowScoreTail, color: colors.textMuted },
  });
  const spoken =
    block.kind === 'played'
      ? `${name}, ${t.picker.bestSpoken(block.level, block.correct, block.total)}`
      : name;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.settled }]}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {flag ? (
          <Flag code={flag} size="picker" label={name} />
        ) : (
          <TeamMarker marker={marker} variant="picker" />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {block.kind === 'played' && (
        <View style={styles.score}>
          <Text style={styles.level}>{t.common.level(block.level)}</Text>
          <Text style={[styles.best, block.flawless && { color: colors.successText }]}>
            {block.correct}
            <Text style={[styles.tail, block.flawless && { color: colors.successText }]}>
              /{block.total}
            </Text>
          </Text>
        </View>
      )}
      {block.kind === 'unplayed' && <ChevronGlyph color={colors.textMuted} />}
    </Pressable>
  );
}
```

The `"${name}, …"` template is a spoken label, not visible text. If lint flags it, add `picker.rowSpoken(name, best)` to the catalogs (Task 3's languages) instead of composing it here. Hiding the marker is safe, because the row's label carries the name.

- [ ] **Step 3: `KindTabs`.** A track of two buttons: grid columns, `gap: spacing.xxs`, `padding: spacing.xxs`, `radii.pill`, `surface` with a `hairline` outline. Each tab:
  - Height `sizes.pickerTab`, centred, laid out as a row with `gap: spacing.xs`.
  - The label in `typography.tabLabel`, followed by its count in `typography.statMonoTiny`.
  - Selected: `ctaBg` fill, with the label in `ctaText` and the count in `ctaMuted`.
  - Idle: no fill, with the label in `textSecondary` and the count in `textMuted`.
  - `testID` is `kind-club` or `kind-nation`.
  - `accessibilityRole="tab"`, `accessibilityState={{ selected }}` and `aria-selected={selected}`.
  - `accessibilityLabel` is the label and its count, for example `t.picker.clubs` and the count joined by ", ". If lint objects to the join, add a `picker.tabSpoken(name, count)` key.

  The track is `accessibilityRole="tablist"`. Labels come from `t.picker.clubs` and `t.picker.nations`.

- [ ] **Step 4: `PickerPill`.** Height `sizes.pickerPill`, `paddingHorizontal: spacing.md`, `radii.pill`, and a hairline border.
  - Idle: transparent, with a `border` outline and the label in `pillLabel` `textSecondary`.
  - Active: `ctaBg` fill and border, with the label in `pillLabelActive` `ctaText`.
  - `accessibilityRole="button"`, `accessibilityState={{ selected: active }}`, `aria-selected`.
- [ ] **Step 5: `LetterRail`.** A column `sizes.rail.width` wide, its letters centred, each `sizes.rail.letter` tall, in `railLetter`. The current letter is `accentLine`; the others are `textMuted`.
  - The whole column is the touch target. `onStartShouldSetResponder` and `onMoveShouldSetResponder` return true. On grant and on move, compute the index as `Math.floor((locationY - paddingTop) / sizes.rail.letter)`, clamp it to the letters, and call `onJump(letter)` when it changes.
  - Hidden from screen readers (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`), as spec decision 4 says.
  - `testID="letter-rail"`, plus `testID={`rail-${letter}`}` on each letter, so the shots script can tap one.
- [ ] **Step 6: `SearchField`.** Restyle the root only:
  - height `sizes.searchField`, `borderRadius: radii.pill`, `paddingHorizontal: spacing.md + 2`, `gap: spacing.sm - 2`;
  - `surface` fill with a `border` outline;
  - input `typography.searchInput`.

  Behaviour is unchanged.

- [ ] **Step 7: Verify.** Run `npm run typecheck && npm run lint && npx prettier --check components`. Expected: clean. The screen still renders the old layout until Task 6.
- [ ] **Step 8: Commit:** `feat(picker): rows with a score block, tabs with counts, pills and a letter rail (#176)`.

---

### Task 6: The screen

**Files:**

- Rewrite: `app/team-picker.tsx`
- Delete: `components/SegmentedControl.tsx`, if Task 5 left it.

**Interfaces:**

- Consumes everything above.
- Produces the testIDs `picker-back`, `kind-club` and `kind-nation` (from `KindTabs`), `letter-rail` and `rail-<L>`, and `picker-list`.

- [ ] **Step 1: Rewrite** `app/team-picker.tsx` as one `ScrollView` (`testID="picker-list"`, `keyboardShouldPersistTaps="handled"`, `scrollEventThrottle={16}`). Keep the existing state and handlers: `filter`, `league`, `query`, and `changeKind`, which resets the league.
  - **Content, top to bottom,** with `gap: spacing.md + 2` between blocks, as the canvas has 18:
    - **Top bar:** a row with `justifyContent: 'space-between'`. On the left, `<RoundBackButton testID="picker-back" label={t.common.back} onPress={() => router.dismissTo('/')} />`. On the right, `t.picker.squadCount(squads.length)` in `monoCaption` `textMuted`.
    - **Title:** `t.picker.title` in `displayTitle` `textPrimary`, `accessibilityRole="header"`.
    - **Search:** `<SearchField …/>`.
    - **Tabs:** `<KindTabs value={filter} counts={kindCounts(squads, names, query)} onChange={changeKind} />`.
    - **League pills (clubs only):** the horizontal `ScrollView` of `PickerPill`s, keeping the existing `leagueTrack`/`leagueRow` comments and their `flexShrink: 0` / `alignItems: 'center'` reasons. Its gap is `spacing.xs`.
    - **Your squads slot:** `<View testID="your-squads-slot" />`, with a comment that #179 fills it.
    - **Clubs:** the caption `t.picker.listCaption(league === 'ALL' ? t.picker.allClubs : leagueLabel(league, t), rows.length)` in `monoCaption` `textMuted`, then a `TeamRow` per club from `visibleSquads(...)`.
    - **Nations:** for each `nationSections(squads, names, query)` section, a heading `View` with `onLayout={(e) => offsets.current.set(letter, e.nativeEvent.layout.y)}`.
      - The heading's text is the letter in `letterHeading`: `accentLine` when it is the current letter, otherwise `textPrimary`. It has `accessibilityRole="header"`, with `paddingTop: spacing.md + 2` except on the first heading.
      - The section's `TeamRow`s follow the heading.
      - Each heading must be a **direct child of the ScrollView content**, so its `layout.y` is the scroll offset. Comment that, as `app/about.tsx` does.
    - **Empty state:** as today, when the visible list is empty.
  - **The rail:** an absolutely positioned sibling of the `ScrollView`, inside the root `View`: `right: 0`, vertically centred (`top: 0, bottom: 0, justifyContent: 'center'`), with `pointerEvents="box-none"` on the wrapper.
    - It shows only on Nations with more than one section.
    - `onJump(letter)` calls `scrollRef.current?.scrollTo({ y: offsets.current.get(letter) ?? 0, animated: false })` and sets the current letter.
    - `onScroll` sets the current letter to `letterAt(sortedOffsets, y + spacing.xs)`, where `sortedOffsets` are the recorded offsets in section order.
    - Reset the offsets when the tab or query changes.
  - **Right gutter:** on Nations, give the list's rows `paddingRight: sizes.rail.width - spacing.lg` (never below 0), so the rail never covers a score. Spec: the canvas pads the list for the rail.
  - **Names:** `const names = { nameOf: (s) => squadDisplayName(s, language), locale: language }`, memoized on `language`. Progress comes from `useProgress` and `useProgressHydrated`, as today, and is passed as `hydrated ? teamProgress(item.id, bestScores) : undefined`.
  - **A row's press** pushes `/team/[squadId]/difficulty`, as today.
- [ ] **Step 2: Remove the dead code.** Delete `components/SegmentedControl.tsx`. Grep for `SegmentedControl`, `segment-club`, `segment-nation`, `nationalTeams`, `teamMetaLine` and `rowHeightTall`, and delete any token or caller left without a user.
- [ ] **Step 3: Verify.** Run `npm run typecheck && npm run lint && npm test`. Start the web dev server and check by hand:
  - search on both tabs;
  - each league pill;
  - the rail jumping to a late letter;
  - the current letter following the scroll;
  - a row opening Difficulty.

  Say in the report what you checked.

- [ ] **Step 4: Commit:** `feat(picker): the redesigned team picker screen (#176)`.

---

### Task 7: Shots, docs and rules

**Files:**

- Modify: `scripts/capture-screens.mjs`, `design/SCREENS.md`, `design/screens/*`, and any rule that describes the picker.

- [ ] **Step 1: The capture script.** In `scripts/capture-screens.mjs`, the picker block:
  - `02-team-picker-clubs` stays.
  - Tap `kind-nation` (it was `segment-nation`) for `03-team-picker-nations`.
  - Then `tapId('rail-S', { wait: SWAP_MS })`, or another letter that exists in every language, and shoot `03b-team-picker-nations-jump`.
  - Read the file's helper first: if `tapId` cannot reach the rail (it uses the responder system, not `onPress`), use a Playwright mouse click on the element's centre.
- [ ] **Step 2: Regenerate.** Run `npm run shots`. Restore any PNG that changed only because a photo had not loaded (`git checkout -- <file>`). Use the Read tool on each new or changed picker PNG, dark and light, and compare it with the canvas artboards `Teams.dc.html` and `Clubs.dc.html`, saved at `/private/tmp/claude-501/-Users-khachaturtovmasyan-Projects-escuadra--claude-worktrees-175-settings-screen/db0bec4f-1e45-45c9-86f1-15dcdd229336/scratchpad/artifact-files/48702136-15ff-44ba-aebe-17e26506387c/project/`. Ignore the confederation pills, Your squads and OUTDATED, which are later issues.
- [ ] **Step 3: `design/SCREENS.md`.** Rewrite the team picker's route row and capture rows, and add `03b-team-picker-nations-jump`.
- [ ] **Step 4: Rules.** Grep `.claude/rules` and `docs/` for "team picker", "TeamRow", "sub-line", "NOT PLAYED" and `rowHeightTall`. Fix any sentence the change made untrue. `team-identity.md` names `TeamRow` rendering a marker at its true orientation, which still holds; check it.
- [ ] **Step 5: Verify.** Run `npm run check`, keep its output, and commit: `docs(picker): screens and docs for the redesigned team picker (#176)`.
