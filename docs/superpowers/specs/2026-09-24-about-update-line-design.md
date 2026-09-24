# About shows the running update

**Status:** design, approved 2026-09-24 (#81). Ships as an OTA to 1.0.0 through the
release pipeline (#73), then is cherry-picked to `main`.

## Problem

Nothing on a phone says which JavaScript it's running. About's version line
(`Version 1.0.0 (3)`) names the installed binary, not the update on top of it, so
checking whether a device picked up an OTA means guessing from behaviour. The pipeline
reports every publish by its update group (`group e43368a2` in the PR comments, and
first in `eas update:list`); the phone should show the same thing.

## Design

A second line under the version line, in the same muted mono style:

| The phone is running                                                  | Line                        |
| --------------------------------------------------------------------- | --------------------------- |
| An update from the `production` channel                               | `Update e43368a2`           |
| An update from another channel (a preview build)                      | `Update e43368a2 · preview` |
| The bundle built into the binary: no update yet, or rolled back to it | `Update: built-in`          |
| Nothing to name: updates disabled (running from Metro), or on web     | no line                     |

- **The ID** is the update group, from the launched manifest's `metadata.updateGroup`.
  EAS sets it (the live 1.0.0 iOS manifest carries
  `{"updateGroup":"e43368a2-…","branchName":"production"}`), but `expo-manifests` types
  `metadata` as `object`, so it is read defensively. Without it, `Updates.updateId`
  stands in. The line shows the first 8 characters, as the pipeline does.
- **The channel** is named only when it isn't `production`, so store users see the
  shortest line and a preview build says what it is. On web, `expo-updates` reports an
  empty channel, and no ID, so no line.
- **Built-in** comes from `Updates.isEmbeddedLaunch`. The embedded bundle has an update
  ID too, but it matches nothing on EAS, so it isn't shown.

## Code

- `lib/aboutView.ts`: `updateLine(state: UpdateState): string | null`, where
  `UpdateState` holds `isEnabled`, `isEmbeddedLaunch`, `updateId`, `channel` and
  `manifest` exactly as `expo-updates` exports them. Pure — no React, no Expo imports —
  like the other `lib/*View.ts` modules.
- `lib/aboutView.test.ts`: a test per table row, plus the fallback to `updateId` and the
  8-character cut. `lib/` keeps its tests beside the code until it moves to
  `__tests__/` as a whole (CLAUDE.md).
- `app/about.tsx`: passes `expo-updates`' constants to `updateLine` and renders the line
  under the version when it isn't `null`. The two lines share the version line's
  vertical margins; spacing and colour come from existing tokens.

## Constraints

- **Fingerprint:** `expo-updates` is already a dependency, and nothing native or
  configured changes, so `release-gate` must show iOS `8b8b8840` and Android `a616db89`.
- **Guardrail 4:** the values are launch constants read on the device; nothing new
  leaves it.
- **Guardrail 5:** no new colour, spacing or font value.
- **Screens:** `npm run shots` captures the web build, which shows no line, so the
  committed screenshots stay as they are.

## Verification

1. Vitest covers `updateLine`; `npm run check` passes.
2. A PR into `release/1.0.0` from `feat/81-about-update`, labelled `ota:ios` and
   `ota:android`: `release-gate` ✅ on both platforms. The preview step reports no
   preview build: there is none on 1.0.0's runtimes, and none is made, because the
   Android phone stays on the Play closed-test build.
3. Squash merge: `ota-production` publishes both platforms, verifies each runtime and
   comments each group on the PR.
4. On a store install of each platform, the second launch after the publish shows
   `Update <group>`, matching the comment.
5. The squash commit goes to `main` by `git cherry-pick -x`, in a PR of its own. About
   on `main` carries the telemetry opt-out; its version line is the same, so the pick
   should apply cleanly.

This spec and its plan travel in the same PR as the code, so they reach `main` with it.

## Out of scope

Runtime, fingerprint or publish time on About; changes to the pipeline's comments;
preview builds for 1.0.0.
