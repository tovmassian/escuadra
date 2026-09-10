# About Screen + Surface `squad.season` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new `app/about.tsx` route (disclaimer, data attribution, inline privacy policy, version/build) reachable from Home, and surface `squad.season` on the team picker and the results screen — closing out [GitHub issue #26](https://github.com/tovmassian/escuadra/issues/26).

**Architecture:** `app/about.tsx` is a new, self-contained scrollable screen using only design tokens and `useThemeColors()`, with no store or data dependency beyond `expo-constants` for version/build. The picker's `squad.season` display goes through a new pure helper in `lib/pickerView.ts` (unit-tested), consumed by `components/TeamRow.tsx`. The results screen's season display is three inline string edits in `app/play/[squadId]/[level]/results.tsx` — no new pure logic needed there, since the values are already plain strings on `Squad`.

**Tech Stack:** Expo Router (file-based routes), React Native, `expo-constants`, Zustand (untouched by this plan), Vitest for the one pure-logic addition.

## Global Constraints

- All About-screen copy is **final and approved** — paste every disclaimer/data/privacy paragraph in this plan verbatim. Do not reword, summarise, or expand it.
- Privacy text is **embedded inline, not a link** — hard constraint #4 (no network calls) depends on this.
- **Tokens only, both palettes** — colour via `useThemeColors()` inside the component body, never a module-scope `StyleSheet.create` that captures a colour value (CLAUDE.md hard constraint #5).
- **No player photos, crests, badges, or shield shapes** anywhere added by this plan (hard constraints #1, #2) — not applicable to this feature's copy, but keep in mind if a mockup is later added.
- No new `fetch`, `openURL`, `WebBrowser`, or `XMLHttpRequest` calls (hard constraint #4).
- `nvm use` before any command in this plan; Node 24+ required.
- Screens and components have no automated test coverage in this repo (`vitest.config.ts` intentionally excludes `app/` and `components/` — "no RN test renderer is configured here on purpose"). Verify screen tasks by running the app (Expo web preview or `expo start`) and by regenerating `npm run shots`, not by writing component tests. Only the new pure helper in `lib/pickerView.ts` gets a Vitest test.
- Run `npm run check` before considering the plan done, and paste its actual output.

---

### Task 1: Add `app/about.tsx` and reach it from Home

**Files:**

- Create: `app/about.tsx`
- Modify: `app/index.tsx`

**Interfaces:**

- Consumes: `useThemeColors()` (`theme/useTheme.ts`), `spacing`/`radii`/`typography`/`sizes` (`theme/tokens.ts`), `router` from `expo-router`, `Constants` from `expo-constants` (already a project dependency — `expo-constants@~57.0.17` — not yet imported anywhere in the repo).
- Produces: route `/about`, pushed from Home via a new "About" text link.

This task has no automated test (screens are verified on-device per the Global Constraints note above). Steps 1–2 build the screen; steps 3–5 wire up Home and verify by hand.

- [ ] **Step 1: Write `app/about.tsx`**

```tsx
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

export default function About() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';
  const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? '—';

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: spacing.lg },
    back: { ...typography.secondary, color: colors.textSecondary },
    title: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.md },
    section: {
      marginTop: spacing.xl,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
    },
    sectionHeading: {
      ...typography.sectionHead,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    subHeading: {
      ...typography.body,
      color: colors.textPrimary,
      marginTop: spacing.md,
      marginBottom: spacing.xxs,
    },
    paragraph: {
      ...typography.secondary,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    paragraphEmphasis: {
      ...typography.bodyEmphasis,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    versionLine: {
      ...typography.statMonoTiny,
      color: colors.textMuted,
      marginTop: spacing.xl,
      marginBottom: spacing.xl,
      textAlign: 'center',
    },
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>About</Text>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Escuadra is an independent, unofficial app. It is not affiliated with, endorsed by, or
            associated with FIFA, UEFA, any league, any national football association, or any club.
            Club and national team names are used for identification only and remain the property of
            their respective owners.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Squad data is compiled from Wikipedia and reflects the season shown on each team.
            Wikipedia content is available under CC BY-SA.
          </Text>
          <Text style={[styles.paragraph, { marginBottom: 0 }]}>
            Flag images are from flagpedia.net and are in the public domain.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Privacy</Text>

          <Text style={styles.paragraphEmphasis}>
            Escuadra does not collect any data about you.
          </Text>

          <Text style={styles.paragraph}>
            The app works entirely offline. It makes no network requests of any kind. There is no
            account, no sign-in, and no analytics or tracking software. Nothing you do in the app is
            transmitted anywhere, because the app has no way to transmit anything.
          </Text>

          <Text style={styles.subHeading}>What is stored on your device</Text>
          <Text style={styles.paragraph}>
            Escuadra saves four things locally, on your device only: your best score for each team
            and difficulty level; which levels you have completed; the last team and level you
            played; and your light or dark appearance preference.
          </Text>
          <Text style={styles.paragraph}>
            This lives in the app&apos;s own private storage and never leaves your phone. Deleting
            the app deletes it. There is no backup and no sync, and no way for anyone — including
            the developer — to read it.
          </Text>

          <Text style={styles.subHeading}>Crash reports</Text>
          <Text style={styles.paragraph}>
            If you have chosen to share analytics and diagnostics with Apple in your iOS settings,
            Apple may pass on anonymised crash reports about this app. That is handled entirely by
            Apple and controlled by your iOS settings. Escuadra itself sends nothing.
          </Text>

          <Text style={styles.subHeading}>Children</Text>
          <Text style={[styles.paragraph, { marginBottom: 0 }]}>
            Escuadra collects no data from anyone, including children.
          </Text>
        </View>

        <Text style={styles.versionLine}>
          Version {version} ({build})
        </Text>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `nvm use && npm run typecheck`
Expected: no errors mentioning `app/about.tsx`.

- [ ] **Step 3: Add an "About" link to Home, reachable without disturbing the existing cascade**

In `app/index.tsx`, the top row currently holds only the `ThemeToggle`, column-aligned to the end:

```tsx
<View style={styles.toggleRow}>
  <ThemeToggle />
</View>
```

Change it to a row with "About" on the left and the toggle on the right — this sits outside the `Animated.View` cascade below, so no `homeCascade` delay needs touching:

```tsx
<View style={styles.toggleRow}>
  <Pressable onPress={() => router.push('/about')} accessibilityRole="button" hitSlop={12}>
    <Text style={styles.aboutLink}>About</Text>
  </Pressable>
  <ThemeToggle />
</View>
```

Update the `styles` object in the same file:

```tsx
toggleRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
aboutLink: { ...typography.secondarySmall, color: colors.textMuted },
```

(This replaces the old `toggleRow: { alignItems: 'flex-end' }` entry and adds `aboutLink` alongside the other style keys already in that `StyleSheet.create` call.)

Add `Pressable` and `Text` to the existing `react-native` import in `app/index.tsx` if not already present (`Text` already is; `Pressable` already is too — both are already imported per the current file, so this is a JSX-only change).

- [ ] **Step 4: Manually verify navigation in both themes**

Run: `nvm use && npx expo start --web`

In the opened browser preview:

1. Confirm "About" appears top-left on Home, next to the theme toggle.
2. Tap it — confirm it navigates to `/about` and the `‹ Back` link returns to Home.
3. Toggle dark/light from Home, revisit About, confirm every section (disclaimer, data, privacy, version line) reads correctly in both palettes — no invisible text, no clipped content.
4. Confirm the About screen scrolls fully to the version line without content cut off by the safe area.

- [ ] **Step 5: Commit**

```bash
git add app/about.tsx app/index.tsx
git commit -m "feat: add About screen with disclaimer, attribution, and inline privacy policy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Surface `squad.season` on the team picker

**Files:**

- Modify: `lib/pickerView.ts`
- Test: `lib/pickerView.test.ts`
- Modify: `components/TeamRow.tsx`
- Modify: `app/team-picker.tsx`

**Interfaces:**

- Consumes: `TeamProgress` (already defined in `lib/pickerView.ts`), `SquadManifestEntry.season` (`types/squad.ts`, already present).
- Produces: `teamMetaLine(season: string, progress: TeamProgress | null | undefined): string`, exported from `lib/pickerView.ts`. `TeamRow` gains a required `season: string` prop and calls this function internally instead of building the meta string itself.

- [ ] **Step 1: Write the failing test for `teamMetaLine`**

Add to `lib/pickerView.test.ts` (append after the existing `teamProgress` describe block):

```ts
describe('teamMetaLine', () => {
  it('shows only the season while progress is still hydrating', () => {
    expect(teamMetaLine('2025/26', undefined)).toBe('2025/26');
  });

  it('shows the season plus NOT PLAYED for a team with no recorded progress', () => {
    expect(teamMetaLine('2025/26', null)).toBe('2025/26 · NOT PLAYED');
  });

  it('shows the season plus level and best score for a played team', () => {
    const progress = { level: 2, correct: 7, total: 10, cleared: false };
    expect(teamMetaLine('2025/26', progress)).toBe('2025/26 · LEVEL 2 · BEST 7/10');
  });

  it('uses the nation-style season string unchanged', () => {
    expect(teamMetaLine('2026', null)).toBe('2026 · NOT PLAYED');
  });
});
```

Update the top of `lib/pickerView.test.ts` to import the new function:

```ts
import { leagueFilters, teamMetaLine, teamProgress, visibleSquads } from './pickerView';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `nvm use && npx vitest run lib/pickerView.test.ts`
Expected: FAIL — `teamMetaLine is not a function` (or a TypeScript error if run through `vitest run`, which still reports as a failure).

- [ ] **Step 3: Implement `teamMetaLine` in `lib/pickerView.ts`**

Add this function after `teamProgress` (same file, same section — it consumes `TeamProgress` defined just above it):

```ts
/** The team picker row's mono meta line: the season, plus progress once it's
 *  known. `undefined` progress (still hydrating) shows the season alone
 *  rather than a placeholder dash, since the season itself needs no store
 *  read and is available immediately. */
export function teamMetaLine(season: string, progress: TeamProgress | null | undefined): string {
  if (progress === undefined) return season;
  if (progress === null) return `${season} · NOT PLAYED`;
  return `${season} · LEVEL ${progress.level} · BEST ${progress.correct}/${progress.total}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `nvm use && npx vitest run lib/pickerView.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Update `TeamRow` to take `season` and use `teamMetaLine`**

In `components/TeamRow.tsx`, add the import and prop:

```tsx
import { teamMetaLine, type TeamProgress } from '@/lib/pickerView';
```

(replace the existing `import type { TeamProgress } from '@/lib/pickerView';` line with the above)

Add `season: string;` to `TeamRowProps`, right after `marker: TeamMarkerData;`:

```tsx
interface TeamRowProps {
  name: string;
  marker: TeamMarkerData;
  season: string;
  flag?: FlagCode | null;
  progress: TeamProgress | null | undefined;
  onPress: () => void;
}
```

Update the function signature and the meta `<Text>`:

```tsx
export function TeamRow({ name, marker, season, flag, progress, onPress }: TeamRowProps) {
```

```tsx
<Text style={[styles.meta, progress?.cleared === true && styles.metaCleared]}>
  {teamMetaLine(season, progress)}
</Text>
```

(This replaces the existing three-way ternary that built the string inline.)

- [ ] **Step 6: Pass `season` from the team picker screen**

In `app/team-picker.tsx`, add `season={item.season}` to the `<TeamRow>` call:

```tsx
<TeamRow
  name={item.name}
  marker={item.marker}
  season={item.season}
  flag={item.kind === 'nation' ? flagFor(item.name) : undefined}
  progress={hydrated ? teamProgress(item.id, bestScores) : undefined}
  onPress={() =>
    router.push({ pathname: '/team/[squadId]/difficulty', params: { squadId: item.id } })
  }
/>
```

- [ ] **Step 7: Run typecheck and the full pure-logic test suite**

Run: `nvm use && npm run typecheck && npx vitest run`
Expected: both pass with no errors.

- [ ] **Step 8: Manually verify on the team picker**

Run: `nvm use && npx expo start --web` (if not already running from Task 1)

In the browser preview, open the team picker, and confirm every row's mono meta line now reads e.g. `2025/26 · NOT PLAYED` or `2025/26 · LEVEL 2 · BEST 7/10` for a club, and `2026 · ...` for a nation — in both themes, and that long rows still truncate the name (not the meta line) with an ellipsis.

- [ ] **Step 9: Commit**

```bash
git add lib/pickerView.ts lib/pickerView.test.ts components/TeamRow.tsx app/team-picker.tsx
git commit -m "feat: surface squad season on the team picker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Surface `squad.season` on the results screen

**Files:**

- Modify: `app/play/[squadId]/[level]/results.tsx`

**Interfaces:**

- Consumes: `squad.season` (`Squad`, already present via `getSquad(squadId)`, already in scope as `squad` in this file).
- Produces: no new exports — three inline string edits, one per result tier (`fail`, `passed`, `excellent`).

No automated test for this file (screens are verified on-device, per the Global Constraints note). Verify by hand in step 4.

- [ ] **Step 1: Add the season to the fail-tier eyebrow**

In `app/play/[squadId]/[level]/results.tsx`, find:

```tsx
<Animated.Text entering={riseIn(cascade.title)} style={styles.eyebrow}>
  {squad.name.toUpperCase()} · LEVEL {level} · ROUND COMPLETE
</Animated.Text>
```

Change to:

```tsx
<Animated.Text entering={riseIn(cascade.title)} style={styles.eyebrow}>
  {squad.name.toUpperCase()} · {squad.season} · LEVEL {level} · ROUND COMPLETE
</Animated.Text>
```

- [ ] **Step 2: Add the season to the passed-tier and excellent-tier verdict lines**

Find:

```tsx
<Animated.Text entering={riseIn(cascade.subtitle)} style={styles.verdict}>
  {tier === 'excellent'
    ? `${squad.name}, level ${level}. Nothing missed.`
    : verdictSentence(score.correct, score.attempted)}
</Animated.Text>
```

Change to:

```tsx
<Animated.Text entering={riseIn(cascade.subtitle)} style={styles.verdict}>
  {tier === 'excellent'
    ? `${squad.name} · ${squad.season}, level ${level}. Nothing missed.`
    : `${squad.name} · ${squad.season}. ${verdictSentence(score.correct, score.attempted)}`}
</Animated.Text>
```

(The `tier !== 'fail'` branch this sits in only ever renders for `'passed'` or `'excellent'`, so the `else` arm above is always the passed tier — this does not touch the fail tier's own verdict text a few lines below, which keeps calling `verdictSentence` unchanged.)

- [ ] **Step 3: Run typecheck**

Run: `nvm use && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify all three tiers in both themes**

Run: `nvm use && npx expo start --web` (if not already running)

Play a round three times against any squad to hit each tier, checking each in both light and dark theme:

1. **Fail** (score below the pass ratio): confirm the eyebrow reads `TEAM NAME · SEASON · LEVEL N · ROUND COMPLETE`.
2. **Passed, not flawless**: confirm the verdict line reads `Team Name · Season. <verdict sentence>`.
3. **Excellent / a la escuadra** (flawless): confirm the verdict line reads `Team Name · Season, level N. Nothing missed.`

Confirm no text wraps awkwardly or clips on a narrow screen width, and that season reads correctly for both a club season string (`2025/26`) and a nation season string (`2026`).

- [ ] **Step 5: Commit**

```bash
git add "app/play/[squadId]/[level]/results.tsx"
git commit -m "feat: surface squad season on the results screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full check suite**

Run: `nvm use && npm run check`
Expected: PASS end-to-end (typecheck, lint, format:check, vitest, squadctl registry check, gen:squads/gen:flags with no diff). Paste the actual output when reporting this task done — per the Global Constraints note, do not claim success without it.

- [ ] **Step 2: Regenerate screenshots**

Run: `nvm use && npm run shots`
Expected: `design/screens/` updates to reflect the new About screen, the Home screen's new "About" link, the team picker's season line, and the results screen's season line. Confirm with `git status` that the expected screenshot files changed (and no unrelated ones did).

- [ ] **Step 3: Commit the regenerated screenshots**

```bash
git add design/screens
git commit -m "data: update screenshots for About screen and season display

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Close out the issue**

Once all tasks are committed and `npm run check` output has been pasted, this plan implements everything in [GitHub issue #26](https://github.com/tovmassian/escuadra/issues/26) except the two already-satisfied checklist items (`squad.season` already existed as a field before this plan — this plan is what makes it visible). Open a PR referencing `Closes #26`.
