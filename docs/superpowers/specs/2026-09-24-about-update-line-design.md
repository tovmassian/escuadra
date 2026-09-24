# About shows the running update

**Status:** design, approved 2026-09-24 (#81) and revised the same day: the update goes
inside the version line's parentheses, which never showed a build number. Ships as an
OTA to 1.0.0 through the release pipeline (#73), then is cherry-picked to `main`.

## Problem

Nothing on a phone says which JavaScript it's running, so checking whether a device
picked up an OTA means guessing from behaviour. About's version line was meant to name
the binary: `Version 1.0.0 (<build>)`. On both platforms it shows `Version 1.0.0 (—)`:

- `app.json` carries no build number, because EAS keeps it remotely
  (`appVersionSource: remote`), so `Constants.expoConfig.ios.buildNumber` is absent;
- the fallback, `Constants.nativeBuildVersion`, was removed from `expo-constants`
  (expo/expo#26329, with `nativeAppVersion`). Its types end in `Record<string, any>`,
  which is why TypeScript never flagged the read.

The pipeline reports every publish by its update group (`group e43368a2` in the PR
comments, and first in `eas update:list`); the phone should show the same thing.

## Design

The parentheses carry the update instead of the build number:

| The phone is running                                                  | Version line                         |
| --------------------------------------------------------------------- | ------------------------------------ |
| An update from the `production` channel                               | `Version 1.0.0 (e43368a2)`           |
| An update from another channel (a preview build)                      | `Version 1.0.0 (e43368a2 · preview)` |
| The bundle built into the binary: no update yet, or rolled back to it | `Version 1.0.0 (built-in)`           |
| Nothing to name: updates disabled (running from Metro), or on web     | `Version 1.0.0`                      |

- **The ID** is the update group, from the launched manifest's `metadata.updateGroup`.
  EAS sets it (the live 1.0.0 iOS manifest carries
  `{"updateGroup":"e43368a2-…","branchName":"production"}`), but `expo-manifests` types
  `metadata` as `object`, so it is read defensively. Without it, `Updates.updateId`
  stands in. The line shows the first 8 characters, as the pipeline does.
- **The channel** is named only when it isn't `production`, so store users see the
  shortest line and a preview build says what it is. On web, `expo-updates` reports an
  empty channel and no ID, so the parentheses go.
- **Built-in** comes from `Updates.isEmbeddedLaunch`. The embedded bundle has an update
  ID too, but it matches nothing on EAS, so it isn't shown.
- **Why not fix the build number:** iOS could still read it
  (`Constants.platform.ios.buildNumber`, from `CFBundleVersion`), but `expo-constants`
  no longer provides Android's `versionCode`: that takes `expo-application`, a native
  module, and a new dependency moves the fingerprint, so it can't ship as an OTA. The
  update says more about what's running anyway.

## Code

- `lib/aboutView.ts`: `versionLabel(version: string, update: UpdateState): string`,
  where `UpdateState` holds `isEnabled`, `isEmbeddedLaunch`, `updateId`, `channel` and
  `manifest` as `expo-updates` exports them. Pure — no React, no Expo imports — like the
  other `lib/*View.ts` modules.
- `lib/aboutView.test.ts`: a test per table row, plus the fallback to `updateId` and the
  8-character cut. `lib/` keeps its tests beside the code until it moves to
  `__tests__/` as a whole (CLAUDE.md).
- `app/about.tsx`: drops the dead `build` constant and the removed `nativeAppVersion`
  fallback (the version comes from `Constants.expoConfig.version`), and renders
  `versionLabel(version, …)` in the existing version line. No style changes.

## Constraints

- **Fingerprint:** `expo-updates` is already a dependency, and nothing native or
  configured changes, so `release-gate` must show iOS `8b8b8840` and Android `a616db89`.
- **Guardrail 4:** the values are launch constants read on the device; nothing new
  leaves it.
- **Guardrail 5:** no style changes.
- **Screens:** no captured screen shows About, so `design/screens/` and the store
  captures stay as they are.

## Verification

1. Vitest covers `versionLabel`; `npm run check` passes.
2. A PR into `release/1.0.0` from `feat/81-about-update`, labelled `ota:ios` and
   `ota:android`: `release-gate` ✅ on both platforms. The preview step reports no
   preview build: there is none on 1.0.0's runtimes, and none is made, because the
   Android phone stays on the Play closed-test build.
3. Squash merge: `ota-production` publishes both platforms, verifies each runtime and
   comments each group on the PR.
4. On a store install of each platform, the second launch after the publish shows
   `Version 1.0.0 (<group>)`, matching the comment.
5. The squash commit goes to `main` by `git cherry-pick -x`, in a PR of its own. About
   on `main` carries the telemetry opt-out; its version line is the same, so the pick
   should apply cleanly.

This spec and its plan travel in the same PR as the code, so they reach `main` with it.

## Out of scope

The native build number; runtime, fingerprint or publish time on About; changes to the
pipeline's comments; preview builds for 1.0.0.
