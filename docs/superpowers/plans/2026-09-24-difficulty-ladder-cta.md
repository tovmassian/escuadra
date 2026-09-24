# Difficulty ladder CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the difficulty screen's next level an obvious Play button by expanding the focused rung in place, compacting the others, and demoting Study to a text link (issue #67).

**Architecture:** A pure `focusedLevel()` in `lib/ladderView.ts` picks the rung to expand; the screen renders that rung as a new `DifficultyCard` (description + filled Play button) and every other rung as a slimmed-down `DifficultyRow`, both sharing a new `LadderBadge` and `BestPill`. Rungs stay in level order joined by the existing `LadderConnector`.

**Tech Stack:** Expo SDK 57, React Native, expo-router, Zustand, Vitest (node env, no RN renderer).

**Spec:** `docs/superpowers/specs/2026-09-24-difficulty-ladder-cta-design.md`

## Global Constraints

- Branch `fix/difficulty-cta`, cut from `origin/release/1.0.0`. The PR targets `release/1.0.0`, labelled `ota:ios` and `ota:android`.
- JavaScript only. Do not touch `package.json`, `package-lock.json`, `app.json`, `eas.json`, `.gitignore`, or anything native: the iOS fingerprint must stay `8b8b8840…` and Android `a616db89…`.
- No hardcoded colour, spacing or font size: everything from `theme/tokens.ts`; colours via `useThemeColors()` inside the component, never a module-scope `StyleSheet` with colours.
- Every animation under 300ms (this plan adds none).
- `noUncheckedIndexedAccess` stays on; don't weaken types to pass.
- Tests in `lib/` stay beside their code (`lib/ladderView.test.ts`), the layout that area already uses.
- Run `nvm use` (Node 24) in every new shell before `npm` commands.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File                                | Change | Responsibility                                            |
| ----------------------------------- | ------ | --------------------------------------------------------- |
| `lib/ladderView.ts`                 | Modify | + `focusedLevel`, `playLabel`, `rungAccessibilityLabel`   |
| `lib/ladderView.test.ts`            | Modify | Tests for the three functions                             |
| `theme/tokens.ts`                   | Modify | `ladderBadgeSize` replaces the per-level badge/title maps |
| `components/LadderBadge.tsx`        | Create | A rung's badge: number / mark / padlock, sized by state   |
| `components/BestPill.tsx`           | Create | The green `BEST n/10` pill                                |
| `components/DifficultyRow.tsx`      | Modify | Compact rung: badge, title, status; the row is the button |
| `components/DifficultyCard.tsx`     | Create | Expanded rung: title, description, filled Play button     |
| `app/team/[squadId]/difficulty.tsx` | Modify | Pick the focused rung, render card vs row, Study as link  |
| `design/screens/04-difficulty*.png` | Regen  | `npm run shots`                                           |
| `design/SCREENS.md`                 | Modify | Describe the new difficulty capture                       |

---

### Task 1: The focused-rung model

**Files:**

- Modify: `lib/ladderView.ts` (append after `ladderRows`, before `MONTHS`)
- Test: `lib/ladderView.test.ts`

**Interfaces:**

- Consumes: `LadderRow`, `ladderRows` (existing, `lib/ladderView.ts`); `Level` (`lib/questionEngine.ts`).
- Produces:
  - `focusedLevel(rows: LadderRow[]): Level`
  - `playLabel(row: LadderRow): string` → `'Play'` or `'Play Again'`
  - `rungAccessibilityLabel(row: LadderRow, title: string): string`

- [ ] **Step 1: Write the failing tests**

In `lib/ladderView.test.ts`, change the import line to:

```ts
import {
  focusedLevel,
  formatLastUpdated,
  ladderRows,
  playLabel,
  rungAccessibilityLabel,
} from './ladderView';
```

and append:

```ts
describe('focusedLevel', () => {
  it('focuses level 1 with no history at all', () => {
    expect(focusedLevel(ladderRows('bar', {}, {}))).toBe(1);
  });

  it('focuses the first level still to clear once earlier ones are played', () => {
    expect(focusedLevel(ladderRows('bar', { 'bar:1': 9 }, { 'bar:1': true }))).toBe(2);
  });

  it('focuses the last level, as a replay, once every level is played', () => {
    const rows = ladderRows(
      'bar',
      { 'bar:1': 9, 'bar:2': 7, 'bar:3': 8 },
      { 'bar:1': true, 'bar:2': true, 'bar:3': true },
    );
    expect(focusedLevel(rows)).toBe(3);
  });

  it('falls back to the highest played level when nothing is unlocked', () => {
    // A best score without its completion flag leaves the next level locked.
    const rows = ladderRows('bar', { 'bar:1': 9, 'bar:2': 7 }, { 'bar:1': true });
    expect(focusedLevel(rows)).toBe(2);
  });

  it('falls back to level 1 for an empty ladder', () => {
    expect(focusedLevel([])).toBe(1);
  });
});

describe('playLabel', () => {
  it('reads Play for a level not yet played', () => {
    expect(playLabel({ level: 1, status: 'unlocked' })).toBe('Play');
  });

  it('reads Play Again for a level with a best score', () => {
    expect(playLabel({ level: 1, status: 'best', best: { correct: 9, total: 10 } })).toBe(
      'Play Again',
    );
  });
});

describe('rungAccessibilityLabel', () => {
  it('announces a played rung with its best score', () => {
    const row = { level: 1, status: 'best', best: { correct: 9, total: 10 } } as const;
    expect(rungAccessibilityLabel(row, 'Name from Number')).toBe('Name from Number, best 9 of 10');
  });

  it('announces a locked rung with what unlocks it', () => {
    const row = { level: 3, status: 'locked', unlockHint: 'Clear L2' } as const;
    expect(rungAccessibilityLabel(row, 'Full Profile')).toBe('Full Profile, locked, Clear L2');
  });

  it('announces an unlocked rung by its title alone', () => {
    expect(rungAccessibilityLabel({ level: 2, status: 'unlocked' }, 'Name + Position')).toBe(
      'Name + Position',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/ladderView.test.ts`
Expected: FAIL — `focusedLevel` / `playLabel` / `rungAccessibilityLabel` are not exported.

- [ ] **Step 3: Implement**

In `lib/ladderView.ts`, insert after the closing `}` of `ladderRows` (before `const MONTHS`):

```ts
/** The rung the ladder expands into a Play card: the first level still to
 *  clear, else the highest one played (a replay), else level 1. */
export function focusedLevel(rows: LadderRow[]): Level {
  const next = rows.find((r) => r.status === 'unlocked');
  if (next) return next.level;
  const played = rows.filter((r) => r.status !== 'locked');
  return played[played.length - 1]?.level ?? 1;
}

export function playLabel(row: LadderRow): string {
  return row.status === 'best' ? 'Play Again' : 'Play';
}

/** What a screen reader announces for a compact rung, whose status is
 *  otherwise carried only by its badge and pill. */
export function rungAccessibilityLabel(row: LadderRow, title: string): string {
  if (row.best) return `${title}, best ${row.best.correct} of ${row.best.total}`;
  if (row.status === 'locked') {
    return row.unlockHint ? `${title}, locked, ${row.unlockHint}` : `${title}, locked`;
  }
  return title;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/ladderView.test.ts`
Expected: PASS, all `ladderRows`, `formatLastUpdated`, `focusedLevel`, `playLabel` and `rungAccessibilityLabel` tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/ladderView.ts lib/ladderView.test.ts
git commit -m "feat: model which difficulty rung expands into a Play card (#67)"
```

---

### Task 2: Expanded card, compact rows, Study as a link

**Files:**

- Modify: `theme/tokens.ts` (lines ~383–397 and the `iconSize` comments at ~463 and ~467–470)
- Create: `components/LadderBadge.tsx`, `components/BestPill.tsx`, `components/DifficultyCard.tsx`
- Modify (full rewrite): `components/DifficultyRow.tsx`
- Modify: `app/team/[squadId]/difficulty.tsx`

**Interfaces:**

- Consumes (Task 1): `focusedLevel(rows)`, `playLabel(row)`, `rungAccessibilityLabel(row, title)`, plus existing `LadderRow`, `DifficultyStatus`, `ladderRows`, `formatLastUpdated`.
- Produces:
  - `ladderBadgeSize: { compact: 32; expanded: 48 }` (tokens)
  - `<LadderBadge level status expanded />`
  - `<BestPill correct total />`
  - `<DifficultyRow row title onPress? />`
  - `<DifficultyCard row title description onPlay />`

There is no RN renderer under Vitest, so this task is verified by typecheck, lint and the browser.

- [ ] **Step 1: Tokens**

In `theme/tokens.ts` replace:

```ts
export const badgeSize = { 1: 40, 2: 48, 3: 56 } as const;
export const difficultyTitleSize = { 1: 15, 2: 17, 3: 19 } as const;
export const difficultyTitleWeight = { 1: '400', 2: '600', 3: '800' } as const;
```

with:

```ts
// Difficulty-ladder badge diameters. Size follows the rung's state, not its
// level: the focused rung, expanded into a Play card, carries the large badge;
// every other rung the compact one.
export const ladderBadgeSize = { compact: 32, expanded: 48 } as const;
```

In `sizes`, replace the `difficultyBadgeColumn` and `difficultyConnectorHeight` entries (and their comments) with:

```ts
  // Width of the difficulty ladder's badge column. Both badge sizes centre
  // inside this fixed-width slot, so the badges — and the connector segments
  // between them — share one vertical axis. Matches the larger badge so
  // nothing overflows it.
  difficultyBadgeColumn: ladderBadgeSize.expanded,
  // Height of one connector segment between two ladder rungs. Drawn only in
  // the gap, never behind a badge — see `LadderConnector`.
  difficultyConnectorHeight: 16,
```

In `iconSize`, change the `chevron` comment to `// TeamRow disclosure chevron` (DifficultyRow never had one), and replace the `lockGlyphRatio` comment with:

```ts
// The locked-badge padlock scales with its badge rather than sitting at one
// fixed size — 32 * 0.46 ≈ 15.
```

- [ ] **Step 2: `components/BestPill.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface BestPillProps {
  correct: number;
  total: number;
}

// A played rung's best score, on the success wash.
export function BestPill({ correct, total }: BestPillProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    pill: {
      paddingVertical: spacing.xxs - 1,
      paddingHorizontal: spacing.xs,
      backgroundColor: colors.successBg,
      borderRadius: radii.pill,
      flexShrink: 0,
    },
    label: { ...typography.captionEyebrow, color: colors.success },
  });

  return (
    <View style={styles.pill}>
      <Text style={styles.label}>
        BEST {correct}/{total}
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: `components/LadderBadge.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { LockGlyph } from '@/components/LockGlyph';
import { VerdictGlyph } from '@/components/VerdictGlyph';
import type { DifficultyStatus } from '@/lib/ladderView';
import type { Level } from '@/lib/questionEngine';
import { borderWidths, iconSize, ladderBadgeSize, radii, sizes, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface LadderBadgeProps {
  level: Level;
  status: DifficultyStatus;
  expanded: boolean;
}

// A rung's badge: its number while playable, the mark once played, a padlock
// while locked. Centred in the ladder's fixed-width column so both badge
// sizes, and the connector segments between them, share one vertical axis.
export function LadderBadge({ level, status, expanded }: LadderBadgeProps) {
  const colors = useThemeColors();
  const size = expanded ? ladderBadgeSize.expanded : ladderBadgeSize.compact;
  const styles = StyleSheet.create({
    column: { width: sizes.difficultyBadgeColumn, alignItems: 'center', flexShrink: 0 },
    badge: {
      width: size,
      height: size,
      borderRadius: radii.pill,
      borderWidth: borderWidths.thick,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locked: { backgroundColor: colors.surface, borderColor: colors.border },
    unlocked: { backgroundColor: colors.accent, borderColor: colors.accent },
    best: { backgroundColor: colors.success, borderColor: colors.success },
    number: { ...typography.badgeNumber, color: colors.accentOn },
  });

  return (
    <View style={styles.column}>
      <View style={[styles.badge, styles[status]]}>
        {status === 'locked' ? (
          <LockGlyph size={Math.round(size * iconSize.lockGlyphRatio)} />
        ) : status === 'best' ? (
          <VerdictGlyph
            correct
            size={expanded ? iconSize.markLarge : iconSize.markSmall}
            color={colors.accentOn}
          />
        ) : (
          <Text style={styles.number}>{level}</Text>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Rewrite `components/DifficultyRow.tsx` as the compact rung**

Replace the whole file with:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BestPill } from '@/components/BestPill';
import { LadderBadge } from '@/components/LadderBadge';
import { type LadderRow, rungAccessibilityLabel } from '@/lib/ladderView';
import { borderWidths, opacity, radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface DifficultyRowProps {
  row: LadderRow;
  title: string;
  /** Absent for a locked rung, which can't be played. */
  onPress?: () => void;
}

// A rung the ladder isn't focused on: one line of badge, title and status. A
// played rung is still a button — tapping it starts that level directly,
// without moving the expanded card.
export function DifficultyRow({ row, title, onPress }: DifficultyRowProps) {
  const colors = useThemeColors();
  const locked = row.status === 'locked';
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    locked: { opacity: opacity.disabled },
    pressed: { opacity: opacity.settled },
    card: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      borderRadius: radii.md,
    },
    title: { ...typography.rowTitle, color: colors.textPrimary, flex: 1 },
    hint: { ...typography.captionEyebrow, color: colors.textMuted, flexShrink: 0 },
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={locked || !onPress}
      accessibilityRole="button"
      accessibilityLabel={rungAccessibilityLabel(row, title)}
      accessibilityState={{ disabled: locked }}
      style={({ pressed }) => [styles.row, locked && styles.locked, pressed && styles.pressed]}
    >
      <LadderBadge level={row.level} status={row.status} expanded={false} />
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {row.best && <BestPill correct={row.best.correct} total={row.best.total} />}
        {locked && row.unlockHint && <Text style={styles.hint}>{row.unlockHint}</Text>}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 5: `components/DifficultyCard.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { BestPill } from '@/components/BestPill';
import { Button } from '@/components/Button';
import { LadderBadge } from '@/components/LadderBadge';
import { type LadderRow, playLabel } from '@/lib/ladderView';
import { borderWidths, radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface DifficultyCardProps {
  row: LadderRow;
  title: string;
  description: string;
  onPlay: () => void;
}

// The focused rung, expanded in its own slot on the ladder: what the level
// asks, and a real Play button, so the way in is a labelled button rather
// than a card the player has to guess is pressable.
export function DifficultyCard({ row, title, description, onPlay }: DifficultyCardProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    // Drops the badge level with the title line rather than the card's top edge.
    badge: { paddingTop: spacing.md },
    card: {
      flex: 1,
      gap: spacing.sm,
      padding: spacing.xl,
      backgroundColor: colors.surfaceRaised,
      borderWidth: borderWidths.emphasis,
      borderColor: colors.accent,
      borderRadius: radii.xl,
    },
    header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
    title: { ...typography.sectionHead, color: colors.textPrimary },
    description: { ...typography.secondary, color: colors.textSecondary },
    action: { marginTop: spacing.xxs },
  });

  return (
    <View style={styles.row}>
      <View style={styles.badge}>
        <LadderBadge level={row.level} status={row.status} expanded />
      </View>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {row.best && <BestPill correct={row.best.correct} total={row.best.total} />}
        </View>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.action}>
          <Button label={playLabel(row)} variant="filled" onPress={onPlay} />
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Wire the screen**

In `app/team/[squadId]/difficulty.tsx`:

Imports — add `DifficultyCard` and `focusedLevel`:

```tsx
import { Button } from '@/components/Button';
import { DifficultyCard } from '@/components/DifficultyCard';
import { DifficultyRow } from '@/components/DifficultyRow';
import { LadderConnector } from '@/components/LadderConnector';
import type { Level } from '@/lib/questionEngine';
import { focusedLevel, formatLastUpdated, ladderRows } from '@/lib/ladderView';
```

In the `StyleSheet.create`, replace `studyButton: { marginTop: spacing.lg },` with:

```tsx
    studyLink: { marginTop: spacing.lg, alignItems: 'center' },
```

Replace everything from `const squad = getSquad(squadId);` to the end of the component with:

```tsx
  const squad = getSquad(squadId);
  if (!squad) return null;

  const rows = ladderRows(squad.id, bestScores, completedLevels);
  const focused = focusedLevel(rows);
  const play = (level: Level) =>
    router.push({
      pathname: '/play/[squadId]/[level]',
      params: { squadId: squad.id, level: String(level) },
    });

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
        <Text style={styles.back}>‹ Exit</Text>
      </Pressable>
      <Text style={styles.eyebrow}>{squad.name.toUpperCase()}</Text>
      <Text style={styles.title}>Choose Difficulty</Text>

      <View>
        {rows.map((row, i) => {
          const copy = LEVEL_COPY[row.level];
          return (
            <React.Fragment key={row.level}>
              {row.level === focused ? (
                <DifficultyCard
                  row={row}
                  title={copy.title}
                  description={copy.description}
                  onPlay={() => play(row.level)}
                />
              ) : (
                <DifficultyRow
                  row={row}
                  title={copy.title}
                  onPress={row.status === 'locked' ? undefined : () => play(row.level)}
                />
              )}
              {i < rows.length - 1 && <LadderConnector active={row.status !== 'locked'} />}
            </React.Fragment>
          );
        })}
      </View>
      <View style={styles.spacer} />

      <View style={styles.studyLink}>
        <Button
          label="Study This Squad"
          variant="text"
          onPress={() =>
            router.push({ pathname: '/team/[squadId]/study', params: { squadId: squad.id } })
          }
        />
      </View>

      <Text style={styles.updated}>Updated {formatLastUpdated(squad.lastUpdated)} · Wikipedia</Text>
    </View>
  );
}
```

- [ ] **Step 7: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npx prettier --write components/LadderBadge.tsx components/BestPill.tsx components/DifficultyCard.tsx components/DifficultyRow.tsx "app/team/[squadId]/difficulty.tsx" theme/tokens.ts && npm test`
Expected: no type errors (in particular no remaining import of `badgeSize`, `difficultyTitleSize` or `difficultyTitleWeight`), lint clean, all tests pass.

- [ ] **Step 8: Verify in the browser**

Start the `web` preview (`.claude/launch.json`, port 8081) and open `/team/rma/difficulty`. Check, in both light and dark (`resize_window` `colorScheme`):

1. **Fresh progress:** level 1 is the expanded card with a **Play** button; levels 2 and 3 are compact, dimmed, showing `CLEAR L1` / `CLEAR L2`; Study is a centred text link.
2. **Level 1 played:** in the page, run

   ```js
   const k = 'escuadra-progress';
   const v = JSON.parse(localStorage.getItem(k));
   v.state.bestScores = { 'rma:1': 9 };
   v.state.completedLevels = { 'rma:1': true };
   localStorage.setItem(k, JSON.stringify(v));
   location.reload();
   ```

   Level 1 is compact with a check badge and `BEST 9/10`; level 2 is expanded with **Play**; level 3 compact and locked.

3. **All played:** same snippet with `{ 'rma:1': 9, 'rma:2': 7, 'rma:3': 8 }` and all three completed. Level 3 expanded with `BEST 8/10` and **Play Again**; levels 1–2 compact with their best pills.
4. Tapping a compact played rung opens `/play/rma/<level>`; tapping a locked rung does nothing; tapping **Play** opens the focused level.
5. No console errors. Restore progress afterwards with `localStorage.removeItem('escuadra-progress')`.

- [ ] **Step 9: Commit**

```bash
git add theme/tokens.ts components/LadderBadge.tsx components/BestPill.tsx components/DifficultyCard.tsx components/DifficultyRow.tsx "app/team/[squadId]/difficulty.tsx"
git commit -m "fix: the next difficulty level expands into a Play card (#67)"
```

---

### Task 3: Design handoff, fingerprint, check

**Files:**

- Regenerate: `design/screens/04-difficulty*.png`
- Modify: `design/SCREENS.md:83`

- [ ] **Step 1: Regenerate the screen captures**

Stop the `web` preview first (the capture script starts its own server on 8082). Run: `npm run shots`
Expected: the difficulty PNGs change; other screens don't (captures are deterministic). Check with `git status --short design/screens/`. If any non-difficulty PNG moved, investigate before committing.

Also run `npm run shots:store` to refresh the local, gitignored App Store captures. Nothing to commit from it.

- [ ] **Step 2: Update `design/SCREENS.md`**

Replace the row-3 description (line 83, last column) with:

```
The difficulty ladder in level order: the focused level expanded into a card with its description and a Play button, the other levels compact (locked ones stating their unlock condition), and Study as a text link.
```

Run `npx prettier --write design/SCREENS.md` (it re-pads the table).

- [ ] **Step 3: Confirm the fingerprint is unchanged**

Run:

```bash
npx expo-updates fingerprint:generate --platform ios | head -c 200
npx expo-updates fingerprint:generate --platform android | head -c 200
```

Expected: the iOS hash starts `8b8b8840`, the Android hash starts `a616db89`. If either differs, stop: something non-JS changed.

- [ ] **Step 4: Full check**

Run: `npm run check`
Expected: exits 0 (typecheck, lint, format, tests, registry, generators with no diff).

- [ ] **Step 5: Commit**

```bash
git add design/screens design/SCREENS.md
git commit -m "docs(design): recapture the difficulty screen (#67)"
```

---

### Finish (needs the user's go-ahead)

Pushing publishes to the `preview` channel on every push once the PR carries the OTA labels, so ask before pushing. Then:

```bash
git push -u origin fix/difficulty-cta
gh pr create --base release/1.0.0 --label ota:ios --label ota:android --title "fix: the next difficulty level expands into a Play card" --body-file <body>
```

The body links #67, the spec, and the design canvas. After merge: `git cherry-pick -x` the squash commit onto a branch from `main` (per `docs/release.md`).
