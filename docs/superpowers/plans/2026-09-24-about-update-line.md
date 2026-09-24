# About Shows the Running Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace About's dead `Version 1.0.0 (—)` line with one that names the running
update — the EAS update group when one is running, `built-in` for the embedded bundle, or
nothing when there's no id to show — closing out [GitHub issue #81](https://github.com/tovmassian/escuadra/issues/81).

**Architecture:** A single pure function, `versionLabel(version, update)` in a new
`lib/aboutView.ts`, takes the app's version string plus a plain `UpdateState` object
(the handful of `expo-updates` launch constants) and returns the finished label string.
`app/about.tsx` becomes a thin caller: it drops the two dead `Constants` reads that never
worked, and passes `expo-updates`'s real exports straight into `versionLabel`.

**Tech Stack:** `expo-updates` (`~57.0.22`, already a dependency — read only, no new
package), Vitest, TypeScript strict mode.

## Global Constraints

- **This is a locked release branch (`release/1.0.0`).** Nothing that moves the
  fingerprint may land here: no npm scripts, no dependency changes, no `.gitignore`
  lines, no `app.json`/`eas.json`/`fingerprint.config.js` edits. Every file this plan
  touches is a `.ts`/`.tsx` source file; `expo-updates` is already installed and already
  configured in `app.json`, so nothing here can move either platform's fingerprint.
  `release-gate` re-verifies this on the PR (iOS `8b8b8840`, Android `a616db89` must be
  unchanged) — that CI check is the source of truth, not a step in this plan.
- **`lib/aboutView.ts` stays pure**: no React, no Expo runtime imports. The only import
  from `expo-updates` is `import type { Manifest } from 'expo-updates';` — a type-only
  import, erased at compile time, exactly like the other `lib/*View.ts` modules
  (CLAUDE.md's Architecture rules).
- **No style changes** (CLAUDE.md guardrail 5). `versionLine`'s `StyleSheet` entry in
  `app/about.tsx` is untouched; only the text it renders changes.
- **No new disclosure** (CLAUDE.md guardrail 4). The values this reads
  (`Updates.isEnabled`, `isEmbeddedLaunch`, `updateId`, `channel`, `manifest`) are launch
  constants already resident on the device — nothing new leaves it, so the privacy
  policy, About's Privacy section, and the store declarations are untouched.
- **Tests live beside the code they cover** in `lib/`, not under `__tests__/` — this
  area of the repo hasn't moved to that layout yet (CLAUDE.md's Working conventions).
- Node 24+ required — run `nvm use` before any command in this plan.
- TypeScript is strict, including `noUncheckedIndexedAccess`, `noUnusedLocals`, and
  `noUnusedParameters`.
- Run `npm run check` before considering this plan done, and paste its actual output —
  don't claim success without it.
- No captured screen shows About, so `design/screens/` and the store captures
  (`design/store/`, `design/play/`) are unaffected — nothing to regenerate.
- Out of scope (per the spec): the native build number, showing runtime/fingerprint/
  publish time on About, changes to the release pipeline's PR comments, and preview
  builds for 1.0.0.

---

### Task 1: `lib/aboutView.ts` — the pure version-label function

**Files:**

- Create: `lib/aboutView.ts`
- Create: `lib/aboutView.test.ts`

**Interfaces:**

- Consumes: nothing from this codebase. Only a type-only import,
  `import type { Manifest } from 'expo-updates';` (already a dependency — confirmed
  its `build/index.d.ts` re-exports `Manifest` from `Updates.types`).
- Produces: `export type UpdateState = { isEnabled: boolean; isEmbeddedLaunch: boolean; updateId: string | null; channel: string | null; manifest: Partial<Manifest> }`
  and `export function versionLabel(version: string, update: UpdateState): string` — Task 2
  imports both.

This is the table from
`docs/superpowers/specs/2026-09-24-about-update-line-design.md` the function implements:

| The phone is running                                                  | Version line                         |
| --------------------------------------------------------------------- | ------------------------------------ |
| An update from the `production` channel                               | `Version 1.0.0 (e43368a2)`           |
| An update from another channel (a preview build)                      | `Version 1.0.0 (e43368a2 · preview)` |
| The bundle built into the binary: no update yet, or rolled back to it | `Version 1.0.0 (built-in)`           |
| Nothing to name: updates disabled (running from Metro), or on web     | `Version 1.0.0`                      |

A note on why the manifest read needs a cast: `Manifest` is a union,
`ExpoUpdatesManifest \| EmbeddedManifest`, and only `ExpoUpdatesManifest` carries
`metadata`. `Partial<Manifest>` accepts an object literal with a `metadata` field (TS
distributes `Partial` homomorphically over the union), but reading `.metadata` back off
a `Partial<Manifest>`-typed _variable_ directly does **not** type-check — TS refuses it
with "Property 'metadata' does not exist on type 'Partial<EmbeddedManifest>'" — because
plain property access on a union requires the property on every constituent. This was
verified directly against this repo's `expo-updates@57.0.22` types before writing the
steps below, so the cast in Step 3 is required, not defensive-programming-for-its-own-sake.

- [ ] **Step 1: Write the failing test file**

Create `lib/aboutView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { versionLabel, type UpdateState } from './aboutView';

function updateState(overrides: Partial<UpdateState> = {}): UpdateState {
  return {
    isEnabled: true,
    isEmbeddedLaunch: false,
    updateId: null,
    channel: 'production',
    manifest: {},
    ...overrides,
  };
}

describe('versionLabel', () => {
  it('shows the update group for an update on the production channel', () => {
    const update = updateState({
      manifest: { metadata: { updateGroup: 'e43368a2-1111-2222-3333-444455556666' } },
    });
    expect(versionLabel('1.0.0', update)).toBe('Version 1.0.0 (e43368a2)');
  });

  it('names the channel for an update from a non-production channel', () => {
    const update = updateState({
      channel: 'preview',
      manifest: { metadata: { updateGroup: 'e43368a2-1111-2222-3333-444455556666' } },
    });
    expect(versionLabel('1.0.0', update)).toBe('Version 1.0.0 (e43368a2 · preview)');
  });

  it('shows built-in for the embedded launch, ignoring any update id it carries', () => {
    // The embedded bundle has an update ID too, but it matches nothing on EAS,
    // so isEmbeddedLaunch wins outright over the id lookup below.
    const update = updateState({
      isEmbeddedLaunch: true,
      updateId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      manifest: { metadata: { updateGroup: 'ffffffff-1111-2222-3333-444455556666' } },
    });
    expect(versionLabel('1.0.0', update)).toBe('Version 1.0.0 (built-in)');
  });

  it('drops the parentheses when updates are disabled, e.g. running from Metro', () => {
    const update = updateState({ isEnabled: false });
    expect(versionLabel('1.0.0', update)).toBe('Version 1.0.0');
  });

  it('drops the parentheses on web, where there is no id to show', () => {
    // expo-updates on web reports isEnabled: true, isEmbeddedLaunch: false, an
    // empty channel, and no manifest metadata or update id.
    const update = updateState({ channel: '', updateId: null, manifest: {} });
    expect(versionLabel('1.0.0', update)).toBe('Version 1.0.0');
  });

  it('falls back to Updates.updateId when the manifest carries no metadata', () => {
    const update = updateState({
      updateId: 'bbbbbbbb-1111-2222-3333-444455556666',
      manifest: {},
    });
    expect(versionLabel('1.0.0', update)).toBe('Version 1.0.0 (bbbbbbbb)');
  });

  it('falls back to Updates.updateId when the metadata has no updateGroup field', () => {
    const update = updateState({
      updateId: 'bbbbbbbb-1111-2222-3333-444455556666',
      manifest: { metadata: {} },
    });
    expect(versionLabel('1.0.0', update)).toBe('Version 1.0.0 (bbbbbbbb)');
  });

  it('cuts the id to 8 characters, matching the pipeline comment format', () => {
    const update = updateState({
      manifest: { metadata: { updateGroup: '0123456789abcdef' } },
    });
    expect(versionLabel('1.0.0', update)).toBe('Version 1.0.0 (01234567)');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `nvm use && npx vitest run lib/aboutView.test.ts`
Expected: FAIL — `lib/aboutView.ts` does not exist yet, so the import errors (something
like "Failed to resolve import './aboutView'").

- [ ] **Step 3: Write the implementation**

Create `lib/aboutView.ts`:

```ts
// Pure model for the About screen's version line. Kept out of the screen so
// the update/embedded/disabled branching is unit-testable without a device,
// like the other lib/*View.ts modules.

import type { Manifest } from 'expo-updates';

export type UpdateState = {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  channel: string | null;
  manifest: Partial<Manifest>;
};

const GROUP_ID_LENGTH = 8;
const PRODUCTION_CHANNEL = 'production';

/**
 * EAS sets `metadata.updateGroup` on a published update's manifest, but
 * `expo-manifests` types `metadata` as a bare `object` — and an embedded
 * manifest has no `metadata` field at all — so this is read defensively
 * rather than assumed.
 */
function updateGroupFromManifest(manifest: Partial<Manifest>): string | null {
  const metadata = (manifest as { metadata?: unknown }).metadata;
  if (metadata === null || typeof metadata !== 'object') return null;
  const updateGroup = (metadata as { updateGroup?: unknown }).updateGroup;
  return typeof updateGroup === 'string' && updateGroup.length > 0 ? updateGroup : null;
}

/**
 * The About screen's version line: see
 * docs/superpowers/specs/2026-09-24-about-update-line-design.md for the
 * table of cases this implements.
 */
export function versionLabel(version: string, update: UpdateState): string {
  if (!update.isEnabled) {
    return `Version ${version}`;
  }

  if (update.isEmbeddedLaunch) {
    return `Version ${version} (built-in)`;
  }

  const id = updateGroupFromManifest(update.manifest) ?? update.updateId;
  if (!id) {
    return `Version ${version}`;
  }

  const shortId = id.slice(0, GROUP_ID_LENGTH);
  const channelSuffix =
    update.channel && update.channel !== PRODUCTION_CHANNEL ? ` · ${update.channel}` : '';

  return `Version ${version} (${shortId}${channelSuffix})`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `nvm use && npx vitest run lib/aboutView.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Typecheck**

Run: `nvm use && npm run typecheck`
Expected: no errors. (This is what confirms the `as { metadata?: unknown }` cast
compiles under this project's real `tsconfig.json`, not just the ad hoc check used
while designing this plan.)

- [ ] **Step 6: Commit**

```bash
git add lib/aboutView.ts lib/aboutView.test.ts
git commit -m "$(cat <<'EOF'
feat: add versionLabel, the pure model for About's update line

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire `versionLabel` into `app/about.tsx`

**Files:**

- Modify: `app/about.tsx`

**Interfaces:**

- Consumes: `versionLabel` and `UpdateState` from `@/lib/aboutView` (Task 1); `Updates.isEnabled`,
  `Updates.isEmbeddedLaunch`, `Updates.updateId`, `Updates.channel`, `Updates.manifest` from
  `expo-updates`.
- Produces: nothing further downstream — this is the leaf that renders the string.

`app/about.tsx` currently has no automated coverage (`vitest.config.ts` excludes
`app/` and `components/` — no RN test renderer is configured in this repo). Verify this
task by running the app, not by writing a component test.

- [ ] **Step 1: Update the imports**

Find (top of `app/about.tsx`):

```tsx
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
```

Change to:

```tsx
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { versionLabel } from '@/lib/aboutView';
import { radii, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
```

- [ ] **Step 2: Drop the dead `version`/`build` reads**

Find:

```tsx
const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';
const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? '—';
```

Change to:

```tsx
const version = Constants.expoConfig?.version ?? '—';
```

(`Constants.nativeAppVersion` and `Constants.nativeBuildVersion` were both removed from
`expo-constants` — see the spec's Problem section — and `build` no longer has any use
once the version line reads from `versionLabel` instead.)

- [ ] **Step 3: Render `versionLabel` in the existing version line**

Find:

```tsx
<Text style={styles.versionLine}>
  Version {version} ({build})
</Text>
```

Change to:

```tsx
<Text style={styles.versionLine}>
  {versionLabel(version, {
    isEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    channel: Updates.channel,
    manifest: Updates.manifest,
  })}
</Text>
```

- [ ] **Step 4: Typecheck**

Run: `nvm use && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Verify on the running app**

Run: `nvm use && npx expo start --web` (or scan the QR code into Expo Go if you'd rather
check a device)

Navigate to the About screen (from Home) and confirm the version line reads
`Version 1.0.0` — no trailing `(—)`, no parentheses at all. This is the expected result
both on web (`expo-updates`'s web shim reports no update id) and in Expo Go / a dev
client (`Updates.isEnabled` is false under Metro) — the "nothing to name" row of the
table. Seeing an update group here would actually be surprising in this environment;
`(e43368a2)`-style ids only appear on a build that received a real OTA (verified in Task
3's PR, once merged).

- [ ] **Step 6: Commit**

```bash
git add app/about.tsx
git commit -m "$(cat <<'EOF'
feat: show the running update on About, not a dead build number

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Full verification pass and PR

**Files:** none (verification and process only)

- [ ] **Step 1: Run the full check suite**

Run: `nvm use && npm run check`
Expected: PASS end-to-end (typecheck, lint, format:check, vitest, squadctl registry
check, gen:squads/gen:flags with no diff). If `format:check` fails on the files this
plan wrote, run `npm run format` and re-run `npm run check` — the code snippets above
are correct but Prettier may re-wrap a line differently than shown. Paste the actual
`npm run check` output when reporting this task done; don't claim success without it.

- [ ] **Step 2: Commit this plan document**

The spec (`docs/superpowers/specs/2026-09-24-about-update-line-design.md`) is already
committed on this branch. This plan travels with it, so both reach `main` together with
the code once this PR is squash-merged and cherry-picked (per the spec's Verification
section).

```bash
git add docs/superpowers/plans/2026-09-24-about-update-line.md
git commit -m "$(cat <<'EOF'
docs(plan): About shows the running update

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Open the PR into `release/1.0.0`**

This branch (`feat/81-about-update`) already tracks `release/1.0.0`. Push it and open a
PR into `release/1.0.0`, labelled `ota:ios` and `ota:android` (per `docs/release.md`'s
release flow) so `release-gate` runs and `ota-production` publishes both platforms on
merge. Reference `Closes #81`.

```bash
git push -u origin feat/81-about-update
gh pr create --base release/1.0.0 --title "About shows the running update" --label ota:ios --label ota:android --body "$(cat <<'EOF'
## Summary
- Replaces About's dead `Version 1.0.0 (—)` line with the running EAS update group
  (or `built-in` for the embedded bundle, or nothing when there's no id to show).
- Adds `lib/aboutView.ts`'s pure `versionLabel`, unit-tested for every case in the
  spec's table plus the updateId fallback and the 8-character cut.

Closes #81

## Test plan
- [x] `npm run check` passes (typecheck, lint, format, vitest, squadctl/gen checks)
- [ ] `release-gate` passes on both platforms once opened
- [ ] On a store install after `ota-production` publishes, the version line reads
      `Version 1.0.0 (<group>)`, matching the pipeline's PR comment
EOF
)"
```

- [ ] **Step 4: After merge, cherry-pick to `main`**

Per CLAUDE.md's release rules, a fix on a release branch reaches `main` by
`git cherry-pick -x`. Once the PR above is squash-merged into `release/1.0.0`:

```bash
git fetch origin
git checkout -b fix/81-about-update-main origin/main
git cherry-pick -x <squash-commit-sha>
```

`main`'s `app/about.tsx` also carries the telemetry opt-out UI (added after 1.0.0
shipped), but its version line is unchanged from `release/1.0.0`'s, so the pick should
apply cleanly. If it doesn't, resolve around the telemetry section only — the version
line's own diff shouldn't conflict. Open a PR of this cherry-pick into `main`.
