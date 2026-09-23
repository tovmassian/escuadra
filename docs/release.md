# Releasing Escuadra

How a change reaches users — an over-the-air (OTA) update of the JavaScript, or a new
store build — and how to take one back. The design behind it is
[`docs/superpowers/specs/2026-09-23-release-pipeline-design.md`](superpowers/specs/2026-09-23-release-pipeline-design.md).

## Start here

| I want to…                            | Go to                                                     |
| ------------------------------------- | --------------------------------------------------------- |
| Ship a JS fix to a released version   | [Ship a JS fix](#ship-a-js-fix)                           |
| Ship a new binary                     | [Cut a release](#cut-a-release)                           |
| Undo an update                        | [Roll back](#roll-back)                                   |
| Keep updates away from a store review | [Freeze during store review](#freeze-during-store-review) |

**The one rule: the fingerprint decides.** An update reaches only the builds whose runtime
equals the fingerprint of the commit it was published from, and a locked release branch
never changes its fingerprint.

| Version    | Platform | Build          | Runtime    | Branch          | State                           |
| ---------- | -------- | -------------- | ---------- | --------------- | ------------------------------- |
| 1.0.0      | iOS      | 3 · `ef36adae` | `8b8b8840` | `release/1.0.0` | locked · live on the App Store  |
| 1.0.0      | Android  | 3 · `1973200b` | `a616db89` | `release/1.0.0` | locked · Play closed test (#49) |
| next (TBD) | both     | —              | —          | not cut yet     | in development on `main`        |

Keep this table current whenever a build is cut or a store status changes. Play's
12-tester, 14-day closed test is a one-time gate before a new app's first production
release; later updates go straight to review.

## How an update reaches a device

`eas.json` has four build profiles — `development`, `ios-simulator`, `preview`,
`production` — each on a channel of the same name. A device downloads an update only when
all three match:

```
build's channel  == update's channel    (production | preview)
build's platform == update's platform   (ios | android)
build's runtime  == update's runtime    (the fingerprint)
```

- One channel serves several runtimes at once: every shipped version's updates share
  `production`.
- The app checks on launch without blocking, downloads in the background, and applies the
  update on the next cold start. To check by hand: open, wait, close fully, open again.
- `expo-updates` does nothing in Expo Go or development builds; test delivery on a
  `preview` or store build.
- In code, `Updates.updateId` and `Updates.isEmbeddedLaunch` say what's running
  (`isEmbeddedLaunch: true` means no OTA).

`eas update` never warns about a mismatch. On 2026-09-16 an update published from `main`
printed "Published!" and reached nobody: `main`'s fingerprint had drifted from every
shipped binary. Every check in this document exists because of that.

## OTA or store build?

The fingerprint hashes, per platform, everything that affects the native runtime.
Measured on Expo SDK 57 and eas-cli 24; re-measure if either moves.

| Changes the fingerprint: store build                          | Leaves it alone: OTA                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| Installing, removing or upgrading a native package            | JS/TS code, screens, styles, theme tokens                   |
| Expo SDK or React Native upgrade                              | Squad data, the question engine, copy                       |
| Anything in `app.json` (even `version`, `name`) or `eas.json` | Images bundled by Metro (flags)                             |
| The app icon; the Android adaptive icon (Android only)        | A JS-only npm package added or upgraded                     |
| A new npm script or `.gitignore` line (false positives)       | `package-lock.json`; `package.json` edits not yet installed |
| `fingerprint.config.js`                                       | `.github/`, `scripts/ci/`, `docs/`, `CLAUDE.md`             |

- Only installed packages count, so run `npm ci` before computing a fingerprint.
- The false positives disappear with a `fingerprint.config.js`
  (`sourceSkips: ['PackageJsonScriptsAll', 'GitIgnore']`), which is itself a fingerprint
  change: it lands on `main` before the next version is cut, never on a locked branch.
- To see what's inside a fingerprint: `npx expo-updates fingerprint:generate --platform android --debug`.

What the fingerprint can't see:

- **What data leaves the device** (guardrail 4 in `CLAUDE.md`). Analytics, crash
  reporting, a new endpoint — even in pure JS — ship in a store build, together with the
  privacy policy, App Privacy and Data safety.
- **Store reviews.** A reviewer's device receives updates for its runtime like anyone's.
- Store listing text and screenshots, and the web privacy page: those change in Play
  Console, App Store Connect and on `gh-pages`.

## Branches

- **`main`**: development, including the next version's features. Its fingerprint drifts;
  nothing is ever published or built from it.
- **`release/X.Y.Z`**: one per version, cut from `main` once the version's content is
  decided. Each platform on it is in one of two states, read from EAS:

| State  | When                                                                 | What may merge                                                        |
| ------ | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Open   | No production build of X.Y.Z exists for the platform                 | Anything: fixes, syncs from `main`                                    |
| Locked | A production build of X.Y.Z exists (finished, queued or in progress) | Cherry-picks that keep the fingerprint; nothing from `main`'s history |

A locked branch is its version's OTA source. A change that needs another runtime is a new
version: `release/X.Y.(Z+1)`, branched from `release/X.Y.Z`.

**Flow.** A fix for a shipped version is written on its release branch, against the code
that shipped: a PR into `release/X.Y.Z` from a branch cut from it. Once merged, it goes to
`main` as a PR of `git cherry-pick -x` commits, like anything merged into an open branch.
(Picking a fix out of `main` instead risks dragging unreleased work into an OTA.) Docs and
CI changes go the other way. An open branch may sync from `main` by PR, with a merge
commit; a release branch never merges into `main`.

**Rules.** GitHub rulesets make `main` and `release/*` take changes only by PR, forbid
deleting or force-pushing them, and require the `check` job. `release/*` also requires
`release-gate` and refuses squash merges: a sync needs a real merge commit, and a rebase
keeps each cherry-pick's `-x` line. An admin may merge a PR into `main` past a red check;
nobody can on `release/*`.

## Procedures

### Ship a JS fix

1. Write the fix on a branch cut from the release branch:
   `git switch -c fix/<topic> origin/release/1.0.0`
2. Open a PR into `release/1.0.0` labelled `ota:ios`, `ota:android` or both. No label, no
   publish: right for docs and CI changes.
3. `release-gate` comments a verdict per platform, and a ❌ blocks the merge (see
   [Troubleshooting](#troubleshooting)). With a label, every push also publishes to
   `preview`: open the preview app twice to see it.
4. Merge with rebase or a merge commit. `ota-production` publishes each labelled platform,
   checks the runtime it published and comments on the PR.
5. Open a store install twice to see it.
6. Take the fix to `main`:
   `git switch -c fix/<topic>-main origin/main && git cherry-pick -x <sha>…`, then a PR
   into `main`. Conflicts get resolved here, where nothing ships.

### Release one platform first, or publish later

Label only the first platform. For the other one, or after a freeze lifts, run
**Actions → ota-production → Run workflow** on the release branch. A manual run publishes
the branch head.

### Freeze during store review

A reviewer's device picks up updates for its runtime, so updates to a build under review
must stop. An open issue labelled `ota-freeze` and titled `OTA freeze: <platform>@<version>`
blocks production publishes for exactly that platform and version.

- `store-build` opens one when it submits a production build.
- Anything outside CI, such as a Play Console promotion, needs one by hand:
  `gh issue create --label ota-freeze --title "OTA freeze: android@1.0.0" --body "Play production review (#51)"`
- Close it when the review passes. A publish it blocked goes out with **Re-run failed jobs**.

### Roll back

Run **Actions → ota-rollback** on the release branch, first with `dry_run` on to see the
target: when the history holds test updates, `previous` may not be what you expect.

| Mode       | Effect                                         | Use when                                                                  |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `previous` | Republishes the update before the newest one   | The latest update broke something                                         |
| `group`    | Republishes the group you name                 | You know the last good group (`eas update:list --branch production`)      |
| `embedded` | Sends devices back to the JS inside the binary | Nothing else is good. On 1.0.0 it also drops #61's corrected privacy text |

A production rollback opens a freeze first, because the bad commit is still on the branch,
and waits for running publishes. Devices switch after two launches. Then revert or fix in
a PR into the release branch, close the freeze, merge, and take the fix to `main`.
`channel: preview` rolls back preview builds for drills and never freezes.

### Cut a release

A new version from `main`:

1. The `app.json` version bump (and, the first time, `fingerprint.config.js`) lands on
   `main` by PR.
2. Cut the branch: `git push origin origin/main:refs/heads/release/X.Y.Z`. Fixes found
   from here on go into it by PR and on to `main` by cherry-pick.
3. **Actions → store-build**: `platforms: both`, `profile: production`, `submit` on. Both
   platforms build from one commit; each job checks the built runtime, opens the freeze
   and lists what's left.
4. iOS: Submit for Review in App Store Connect. Android: promote the build in Play
   Console. Close each freeze once approved, and update [Start here](#start-here).

A runtime-changing fix to a released version (1.0.1):

1. `git push origin origin/release/1.0.0:refs/heads/release/1.0.1`
2. A PR into `release/1.0.1` with the fix and `app.json` at `1.0.1`.
3. `store-build` as above, then take the fix to `main`.

`store-build` refuses a production build when `app.json` doesn't match the branch, when the
platform is locked to another runtime, and on the same runtime unless `rebuild` is on,
which is only for embedding newer JS for a review.

### Cut preview builds

**store-build** with `profile: preview`. On a locked branch the preview build's runtime
equals production's, so it receives the same OTAs through `preview`. Preview and store
builds share the app ID: a device holds one at a time, and on Android switching means
uninstalling (different signing keys), which wipes local data.

### Sync `main` into an open branch

`git switch -c sync/main-into-X.Y.Z origin/release/X.Y.Z && git merge origin/main`, resolve,
push, and open a PR into `release/X.Y.Z`; merge it with a merge commit. `release-gate`
refuses this once the branch is locked.

## Reference

### Workflows

| Workflow         | Runs on                                   | Does                                            | Token and environment                              |
| ---------------- | ----------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `release-gate`   | Every PR into `release/*`                 | Fingerprint verdict (required); preview publish | `EXPO_TOKEN_PREVIEW`                               |
| `ota-production` | Push to `release/*` (a merged PR); manual | Production publish per labelled platform        | `EXPO_TOKEN_PRODUCTION` in `production-<platform>` |
| `ota-rollback`   | Manual                                    | Roll back production or preview                 | production runs in `production-<platform>`         |
| `store-build`    | Manual                                    | Production or preview build, optional submit    | production runs in `production-<platform>`         |

Both environments accept only `release/*` branches, so only a run on a release branch
reaches the production token. The logic lives in `scripts/ci/`, tested by `npm run check`.
To see the gate's verdict before opening a PR, from a checkout of the branch you would
merge:
`EAS_CLI="npx --yes eas-cli@24.7.0" node scripts/ci/gate.ts --base release/1.0.0 --dry-run`.

### Manual fallback (when Actions is down)

Do what the workflows do, from a clean checkout of the release branch, one platform per
command (`--platform` defaults to `all`), and respect open freezes:

```bash
npm ci
npx eas-cli build:list --platform ios --build-profile production --app-version 1.0.0 --status finished --limit 3
npx eas-cli fingerprint:compare --build-id <build-id> --environment production   # continue only on ✅
npx eas-cli update --channel production --platform ios --environment production --message "<what> (#PR)"
npx eas-cli update:list --branch production --platform ios --limit 5            # the newest group is yours
npx eas-cli update:republish --group <last-good-group> --platform ios          # roll back
```

Don't publish while that platform's build is in store review.

### Troubleshooting

| Symptom                                        | Cause and fix                                                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ❌ runtime changed                             | The PR changes something in the left column of [OTA or store build?](#ota-or-store-build); the comment's details say what. Drop it, or put it on a new version. |
| ❌ brings commits from `main`                  | The branch was cut from `main` or merged it. Re-cut it from the release branch and cherry-pick.                                                                 |
| ❌ wait for the build                          | A production build of this version is running; re-run the check after it finishes.                                                                              |
| Preview skipped: no preview build on runtime … | [Cut preview builds](#cut-preview-builds).                                                                                                                      |
| Frozen by #N                                   | Close the freeze when the review passes, then **Re-run failed jobs**.                                                                                           |
| 🚨 … reaches nobody / runner and EAS disagree  | Shouldn't happen after the checks. Roll back if something shipped, then investigate before publishing again.                                                    |
| "Published!" but no device gets it             | The update's runtime matches no build: published from the wrong branch, or a stale `node_modules`.                                                              |
| Still the old version after one launch         | Updates apply on the next cold start: close fully and reopen.                                                                                                   |
| Works in Expo Go, not on the phone             | Expo Go runs your local bundle and ignores runtimes.                                                                                                            |

### Commands

| Question                           | Command                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| What runtime would I publish to?   | `npx expo-updates fingerprint:generate --platform ios`                              |
| Does this tree match a build?      | `npx eas-cli fingerprint:compare --build-id <id> --environment production`          |
| Which build has this runtime?      | `npx eas-cli build:list --fingerprint-hash <hash> --platform ios --status finished` |
| What's published?                  | `npx eas-cli update:list --branch production --limit 5`                             |
| How much of the Free plan is used? | `npx eas-cli account:usage tovmassian27`                                            |
