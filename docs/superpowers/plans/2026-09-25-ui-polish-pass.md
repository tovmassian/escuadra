# UI Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four small UI/copy issues reported against the shipped 1.0.0 build (GitHub issue [#85](https://github.com/tovmassian/escuadra/issues/85)): inconsistent back/exit labelling, a missing retry path on the Missed Players screen, no back control on the team picker, and an unreadable active filter-chip text colour in dark mode.

**Architecture:** Every change is a targeted edit to an existing screen or component — no new screens, no new state stores, no new dependencies. The one behavioural addition (retry from Missed Players) reuses the exact `session.startRound` + `router.replace` pattern the Results screen already uses, threaded through a new `level` route param and a small pure parser in `lib/studyView.ts` (mirroring the existing `parsePlayerIds`).

**Tech Stack:** Expo Router, React Native, Zustand (`stores/session.ts`), Vitest for the one pure-function test.

## Global Constraints

- **This is a fix for the shipped 1.0.0 build.** Per `CLAUDE.md`, it starts on `release/1.0.0` (branch cut from `origin/release/1.0.0`, not `main`) and reaches `main` afterward by `git cherry-pick -x` of the squash commit — never developed directly on `main`.
- **Every change here is JS/TS/copy only** — no npm scripts, dependency changes, `.gitignore` lines, `app.json`, `eas.json`, or `fingerprint.config.js`. This keeps the fingerprint untouched, which is required for anything landing on the locked `release/1.0.0` branch (per `docs/release.md`).
- **No hardcoded colours, spacing, or font sizes** — every value comes from `theme/tokens.ts` (`CLAUDE.md` guardrail 5). The chip-colour fix in particular must use the existing `accentOn` role, not a new or inline value.
- **Verified in both light and dark mode** (issue notes) — the token fix must read correctly in both `theme/tokens.ts` palettes.
- **No text input, no keyboard** for any of these changes (guardrail 3) — not applicable here since nothing here touches quiz answering, but no task may introduce one.
- Run `npm run check` before considering any task done, and report its actual output.
- `design/screens/*.png` is a committed handoff surface; regenerate it with `npm run shots` after any screen-visible change, since `02-team-picker-*`, `04-difficulty`, and `05-study` (and their `-light` counterparts) are all touched by this plan.

---

### Task 1: Back/Exit label consistency — Choose Difficulty and Study screens

**Files:**

- Modify: `app/team/[squadId]/difficulty.tsx:73`
- Modify: `app/team/[squadId]/study.tsx:47`

**Interfaces:** None — pure copy change, no new props or functions.

**Context:** The issue asks for one consistent mapping: "Back" for a linear step back, "Exit" only when it truly abandons an in-progress round. Auditing every occurrence of this control:

| File                                       | Current text | Action performed                       | Abandons a round?                                                                                     | Correct label                          |
| ------------------------------------------ | ------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `app/about.tsx:76`                         | `‹ Back`     | `router.back()`                        | No                                                                                                    | `Back` (already correct)               |
| `app/team/[squadId]/difficulty.tsx:73`     | `‹ Exit`     | `router.back()`                        | No — no round has started yet                                                                         | `Back`                                 |
| `app/team/[squadId]/study.tsx:47`          | `‹ Exit`     | `router.back()`                        | No — Study is a read-only detour, reachable both before playing and after a round is already complete | `Back`                                 |
| `app/play/[squadId]/[level]/index.tsx:189` | `‹ Exit`     | `session.reset()` then `router.back()` | Yes — this is the only place that actually discards an in-progress round                              | `Exit` (already correct, do not touch) |

So this task only changes the two screens whose action is a plain `router.back()` but whose label currently says "Exit".

- [ ] **Step 1: Change the Choose Difficulty screen's label to "Back"**

In `app/team/[squadId]/difficulty.tsx`, line 73:

```tsx
<Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
  <Text style={styles.back}>‹ Back</Text>
</Pressable>
```

(Only the text inside `<Text>` changes, from `‹ Exit` to `‹ Back`. The `styles.back` key is already named `back`, so no style rename is needed.)

- [ ] **Step 2: Change the Study screen's label to "Back"**

In `app/team/[squadId]/study.tsx`, line 47:

```tsx
<Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
  <Text style={styles.back}>‹ Back</Text>
</Pressable>
```

- [ ] **Step 3: Verify there are no other stray "Exit" labels left mislabeled**

Run:

```bash
grep -rn "‹ Exit\|‹ Back" app
```

Expected output — exactly these two lines, confirming only the intentional Exit (the in-round quiz screen) remains:

```
app/about.tsx:76:          <Text style={styles.back}>‹ Back</Text>
app/team/[squadId]/study.tsx:47:        <Text style={styles.back}>‹ Back</Text>
app/team/[squadId]/difficulty.tsx:73:        <Text style={styles.back}>‹ Back</Text>
app/play/[squadId]/[level]/index.tsx:189:            <Text style={styles.exit}>‹ Exit</Text>
```

- [ ] **Step 4: Typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: both pass with no errors.

- [ ] **Step 5: Commit**

```bash
git add app/team/[squadId]/difficulty.tsx "app/team/[squadId]/study.tsx"
git commit -m "fix: use consistent Back label on Difficulty and Study screens"
```

---

### Task 2: Add a back control to the Choose a Team screen

**Files:**

- Modify: `app/team-picker.tsx`

**Interfaces:** None — pure UI addition, no new props or functions. Consumes `router.back()` from `expo-router` (already imported in this file) and `typography.secondary` / `spacing.md` from `@/theme/tokens` (already imported).

**Context:** Every other screen in the navigation stack (About, Choose Difficulty, Study/Missed Players) shows a `‹ Back` control in the top-left; only `app/team-picker.tsx` has none, relying solely on the OS swipe-back gesture. `app/index.tsx` (Home) is the only screen that pushes into `/team-picker` (`router.push('/team-picker')`, both from "Start Training" with no continue-card and from "Browse All Teams"), so `router.back()` here always returns to Home — a plain linear step back, so per Task 1's mapping this gets the "Back" label, not "Exit".

- [ ] **Step 1: Add the back control above the title**

In `app/team-picker.tsx`, add `Pressable` to the existing `react-native` import and add a `back` style, then render the control immediately above the title:

```tsx
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
```

```tsx
  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
    back: { ...typography.secondary, color: colors.textSecondary },
    title: {
      ...typography.screenTitle,
      color: colors.textPrimary,
      marginTop: spacing.md,
      marginBottom: spacing.xxs,
    },
```

(Only `title` gains `marginTop: spacing.md`, matching the same back-control-then-title spacing used in `app/about.tsx` and `app/team/[squadId]/difficulty.tsx`. Every other style in the object is unchanged.)

```tsx
  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Choose a Team</Text>
```

- [ ] **Step 2: Typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: both pass with no errors.

- [ ] **Step 3: Manually verify in the running app**

```bash
npx expo start --web
```

Open `/team-picker`, confirm a `‹ Back` control appears above "Choose a Team", and tapping it returns to Home. Confirm the league filter row and list still render below it without visual overlap.

- [ ] **Step 4: Commit**

```bash
git add app/team-picker.tsx
git commit -m "feat: add a Back control to the Choose a Team screen"
```

---

### Task 3: Fix active filter-chip text colour

**Files:**

- Modify: `components/FilterPill.tsx`

**Interfaces:** None — internal style fix only.

**Context:** `FilterPill` (used for league filters on the team picker and position filters on Study/Full Squad) renders its active-state label in `colors.background`, which is dark-grey-on-accent in the dark palette — hard to read. `SegmentedControl` (the "Clubs"/"National Teams" tabs on the same screen) renders its active label in `colors.accentOn`, which both palettes define specifically as "text/icon colour to place on top of `accent`" (`theme/tokens.ts`). `FilterPill` should use the same role so both active states match.

- [ ] **Step 1: Confirm the current mismatch**

```bash
grep -n "accentOn\|colors.background" components/SegmentedControl.tsx components/FilterPill.tsx
```

Expected output:

```
components/SegmentedControl.tsx:50:            <Text style={[styles.label, { color: active ? colors.accentOn : colors.textMuted }]}>
components/FilterPill.tsx:32:      <Text style={[styles.label, { color: active ? colors.background : colors.textMuted }]}>
```

- [ ] **Step 2: Switch FilterPill's active text colour to `accentOn`**

In `components/FilterPill.tsx`, line 32:

```tsx
<Text style={[styles.label, { color: active ? colors.accentOn : colors.textMuted }]}>{label}</Text>
```

- [ ] **Step 3: Typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: both pass with no errors.

- [ ] **Step 4: Manually verify in both themes**

```bash
npx expo start --web
```

Open `/team-picker`, switch to the "Clubs" tab, select a league pill, and confirm its label now renders in the same white/light tone as the active "Clubs" tab label. Toggle dark/light mode (the toggle on Home) and confirm both read clearly in each theme. Repeat on `/team/int/study` (Full Squad) with a position filter (e.g. "GK") selected.

- [ ] **Step 5: Commit**

```bash
git add components/FilterPill.tsx
git commit -m "fix: match active filter-chip text colour to active tab colour"
```

---

### Task 4: Add "Retry This Round" to the Missed Players screen

**Files:**

- Modify: `lib/studyView.ts`
- Modify: `lib/studyView.test.ts`
- Modify: `app/play/[squadId]/[level]/results.tsx`
- Modify: `app/team/[squadId]/study.tsx`

**Interfaces:**

- Consumes: `Level` (`1 | 2 | 3`) from `@/lib/questionEngine`; `useSession` from `@/stores/session`, specifically `startRound: (squad: Squad, roster: RosterEntry[], level: Level, seed?: number) => void` (`stores/session.ts:37`); `getRoster(squadId: string): RosterEntry[]` from `@/lib/squads` (already imported in `study.tsx`); `Button` from `@/components/Button` (`label: string; variant: ButtonVariant; onPress: () => void`).
- Produces: `parseLevel(param: string | undefined): Level | null`, exported from `lib/studyView.ts`, for any future screen that needs to read a `?level=` route param the same way `parsePlayerIds` reads `?players=`.

**Context:** The Missed Players screen is `app/team/[squadId]/study.tsx` when it receives a `players` param (title becomes "Missed Players" instead of "Full Squad" — see `study.tsx:50`). It's reached from the Results screen's "Study These N" button (`results.tsx`'s `studyMissed`), which currently passes only `squadId` and `players` — no `level`. Once there, the only control is `‹ Back`, so retrying the same squad/difficulty means backing out twice (to Results, which does have its own "Retry This Round" action) or all the way to Choose Difficulty. This task threads `level` through so the Missed Players screen can retry directly, using the same `session.startRound` + `router.replace` pattern `results.tsx`'s own `retry()` already uses.

- [ ] **Step 1: Write the failing test for `parseLevel`**

In `lib/studyView.test.ts`, add a new `describe` block (after the existing `parsePlayerIds` block, before `studyRows`):

```ts
import { parseLevel, parsePlayerIds, studyRows } from './studyView';
```

(replaces the existing `import { parsePlayerIds, studyRows } from './studyView';` line)

```ts
describe('parseLevel', () => {
  it('returns null when the param is absent', () => {
    expect(parseLevel(undefined)).toBeNull();
  });

  it('returns null for a non-numeric param', () => {
    expect(parseLevel('abc')).toBeNull();
  });

  it('returns null for a level outside 1..3', () => {
    expect(parseLevel('0')).toBeNull();
    expect(parseLevel('4')).toBeNull();
  });

  it('parses a valid level', () => {
    expect(parseLevel('1')).toBe(1);
    expect(parseLevel('2')).toBe(2);
    expect(parseLevel('3')).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/studyView.test.ts
```

Expected: FAIL — `parseLevel` is not exported from `./studyView`.

- [ ] **Step 3: Implement `parseLevel`**

In `lib/studyView.ts`, add the import and function (after `parsePlayerIds`, before `studyRows`):

```ts
import type { Level } from '@/lib/questionEngine';
import type { Position, RosterEntry } from '@/types/squad';
```

(replaces the existing `import type { Position, RosterEntry } from '@/types/squad';` line)

```ts
/**
 * The `?level=` route param as a `Level`, or null when absent or invalid.
 *
 * Mirrors `parsePlayerIds`: a malformed or missing param means "no level
 * known" rather than throwing, so a caller can fall back to not offering a
 * level-scoped action (e.g. retry) instead of crashing the screen.
 */
export function parseLevel(param: string | undefined): Level | null {
  if (param === undefined) return null;
  const n = Number(param);
  return n === 1 || n === 2 || n === 3 ? n : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run lib/studyView.test.ts
```

Expected: PASS, all tests including the four new `parseLevel` cases.

- [ ] **Step 5: Commit the pure function**

```bash
git add lib/studyView.ts lib/studyView.test.ts
git commit -m "feat: add parseLevel to studyView for route-param parsing"
```

- [ ] **Step 6: Pass `level` from the Results screen's "Study These N" action**

In `app/play/[squadId]/[level]/results.tsx`, update `studyMissed` (around line 220):

```tsx
const studyMissed = () => {
  router.push({
    pathname: '/team/[squadId]/study',
    params: {
      squadId,
      players: missed.map((r) => r.question.playerId).join(','),
      level: String(level),
    },
  });
};
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: passes — `results.tsx` doesn't change any types, only adds a route param.

- [ ] **Step 8: Add the Retry button to the Study screen**

In `app/team/[squadId]/study.tsx`, update the imports:

```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { FilterPill } from '@/components/FilterPill';
import { StudyHeaderRow, StudyRow } from '@/components/StudyRow';
import { flagFor } from '@/lib/flags';
import type { Level } from '@/lib/questionEngine';
import { getRoster, getSquad } from '@/lib/squads';
import { parseLevel, parsePlayerIds, studyRows } from '@/lib/studyView';
import { track } from '@/lib/telemetry';
import { useSession } from '@/stores/session';
import type { Position } from '@/types/squad';
import { spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
```

Update the component to read the `level` param, add the retry handler, and constrain the list so a bottom action row has room:

```tsx
export default function Study() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const {
    squadId,
    players,
    level: levelParam,
  } = useLocalSearchParams<{
    squadId: string;
    players?: string;
    level?: string;
  }>();
  const [filter, setFilter] = useState<'ALL' | Position>('ALL');
  const startRound = useSession((s) => s.startRound);

  const styles = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingBottom: insets.bottom + spacing.lg,
    },
    back: { ...typography.secondary, color: colors.textSecondary },
    eyebrow: { ...typography.captionEyebrow, color: colors.textMuted, marginTop: spacing.md },
    title: { ...typography.sectionHead, color: colors.textPrimary, marginBottom: spacing.md },
    filters: { flexDirection: 'row', gap: spacing.xs - 2, marginBottom: spacing.sm },
    list: { flex: 1 },
    retryButton: { marginTop: spacing.md },
  });

  const squad = getSquad(squadId);
  const roster = useMemo(() => getRoster(squadId), [squadId]);
  const kind = squad?.kind;
  useEffect(() => {
    if (kind) track('study.opened', { kind });
  }, [squadId, kind]);
  if (!squad) return null;

  const playerIds = parsePlayerIds(players);
  const level: Level | null = parseLevel(levelParam);
  const rows = studyRows(roster, filter, playerIds);
  const canRetry = playerIds !== null && level !== null;

  const affiliationLabel = squad.kind === 'club' ? 'NAT' : 'CLUB';

  const retryRound = () => {
    if (level === null) return;
    const fullRoster = getRoster(squad.id);
    startRound(squad, fullRoster, level);
    router.replace({
      pathname: '/play/[squadId]/[level]',
      params: { squadId: squad.id, level: String(level) },
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.eyebrow}>{squad.name.toUpperCase()}</Text>
      <Text style={styles.title}>{playerIds === null ? 'Full Squad' : 'Missed Players'}</Text>

      {playerIds === null && (
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <FilterPill key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
      )}

      <StudyHeaderRow affiliationLabel={affiliationLabel} />
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(r) => r.player.id}
        renderItem={({ item }) => (
          <StudyRow
            number={item.member.no}
            name={item.player.name}
            position={item.player.position}
            affiliation={
              squad.kind === 'club' ? item.player.nationality : (item.player.club ?? '—')
            }
            flag={squad.kind === 'club' ? flagFor(item.player.nationality) : undefined}
          />
        )}
      />
      {canRetry && (
        <View style={styles.retryButton}>
          <Button label="Retry This Round" variant="outline" onPress={retryRound} />
        </View>
      )}
    </View>
  );
}
```

(This replaces the whole component body from `export default function Study()` through the closing `);\n}` — the `roster` local inside `retryRound` is deliberately re-fetched via `getRoster(squad.id)` rather than reusing the outer `roster`, matching `results.tsx`'s own `retry()`, which does the same rather than trusting a roster fetched for a possibly-filtered squad id.)

Note: `FILTERS` stays as the existing module-level `const FILTERS: ('ALL' | Position)[] = ['ALL', 'GK', 'DF', 'MF', 'FW'];` above the component — unchanged.

- [ ] **Step 9: Typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: both pass with no errors.

- [ ] **Step 10: Manually verify the round trip**

```bash
npx expo start --web
```

Play a round of any squad at level 1, answer at least one question wrong, reach Results, tap "Study These N". Confirm the screen title reads "Missed Players" and a "Retry This Round" button appears below the list. Tap it and confirm it starts a fresh level-1 round for the same squad (navigates to the question screen, score reset to 0). Separately, open `/team/int/study` directly (no `players`/`level` params — e.g. via Difficulty's "Study This Squad") and confirm no Retry button appears there (Full Squad mode).

- [ ] **Step 11: Commit**

```bash
git add "app/play/[squadId]/[level]/results.tsx" "app/team/[squadId]/study.tsx"
git commit -m "feat: add Retry This Round to the Missed Players screen"
```

---

### Task 5: Regenerate the design handoff screenshots and run the full check

**Files:**

- Modify (regenerated, not hand-edited): `design/screens/02-team-picker-clubs.png`, `design/screens/02-team-picker-clubs-light.png`, `design/screens/03-team-picker-nations.png`, `design/screens/03-team-picker-nations-light.png`, `design/screens/04-difficulty.png`, `design/screens/04-difficulty-light.png`, `design/screens/05-study.png`, `design/screens/05-study-light.png`

**Interfaces:** None — this task runs existing tooling, it doesn't change source.

**Context:** `CLAUDE.md` requires regenerating `design/screens/` whenever a captured screen changes visually; Tasks 1–4 touch every screen `scripts/capture-screens.mjs` captures except Home and the in-round question/results screens (see the route list in `scripts/capture-screens.mjs:288-307`), so those PNGs are now stale.

- [ ] **Step 1: Regenerate the screenshots**

```bash
nvm use
npm run shots
```

Expected: exits 0, and prints a capture for each of `01-home` through `09-results` in both themes.

- [ ] **Step 2: Confirm only the expected files changed**

```bash
git status --short design/screens
```

Expected: modifications only under `02-team-picker-*`, `03-team-picker-*`, `04-difficulty*`, `05-study*` (dark and light each). If `01-home*`, `06-*` through `09-*` show as modified, stop and investigate — those screens were not touched by this plan and a diff there means something unexpected changed.

- [ ] **Step 3: Run the full check suite**

```bash
npm run check
```

Expected: exits 0. This runs `typecheck`, `lint`, `format:check`, the full `vitest` suite (including the new `parseLevel` tests), the squad registry check, and the squad/flag generators' drift check — report its actual output.

- [ ] **Step 4: Commit the regenerated screenshots**

```bash
git add design/screens
git commit -m "chore: regenerate design screenshots for the UI polish pass"
```

---

## Handoff to release

This plan's commits belong on a branch cut from `origin/release/1.0.0` (not `main`) per `CLAUDE.md`'s release rules — none of these changes touch the fingerprint, so they're safe for the locked branch. After all five tasks are committed:

1. Push the branch and open a PR into `release/1.0.0`, labelled `ota:ios` and `ota:android` (see `docs/release.md`'s [Ship a JS fix](../../release.md#ship-a-js-fix) procedure) so `release-gate` and the preview/production OTA publish run.
2. Once merged, cherry-pick the squash commit to `main`: `git switch -c fix/ui-polish-pass-main origin/main && git cherry-pick -x <squash commit>`, then open a second PR into `main`.

This handoff is not one of the five tasks above — it happens after this plan's execution, once the branch is ready for review.
