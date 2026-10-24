# Releasing Escuadra

How a change reaches users — an over-the-air (OTA) update of the JavaScript, or a new
store build — and how to take one back. The design behind it is
[`docs/superpowers/specs/2026-09-23-release-pipeline-design.md`](superpowers/specs/2026-09-23-release-pipeline-design.md).

## Start here

| I want to…                            | Go to                                                     |
| ------------------------------------- | --------------------------------------------------------- |
| Ship a JS fix to a released version   | [Ship a JS fix](#ship-a-js-fix)                           |
| Ship a new binary                     | [Cut a release](#cut-a-release)                           |
| Change the store listing              | [Change the store listing](#change-the-store-listing)     |
| Undo an update                        | [Roll back](#roll-back)                                   |
| Keep updates away from a store review | [Freeze during store review](#freeze-during-store-review) |

**The one rule: the fingerprint decides.** An update reaches only the builds whose runtime
equals the fingerprint of the commit it was published from, and a locked release branch
never changes its fingerprint.

**Where things stand.** What each version shipped: [`CHANGELOG.md`](../CHANGELOG.md).
Which builds are live, and on which runtime: EAS
(`npx eas-cli build:list --platform ios --build-profile production --status finished --limit 5`)
and the store consoles. A version in progress: its milestone and its release issue. None
of it is written here, because a copy goes stale.

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
Measured on Expo SDK 58 with the `strict` preset in `fingerprint.config.js`; re-measure if
either moves. `strict` keeps `version` in the fingerprint, so each version has its own
runtime and never receives another version's updates.

| Changes the fingerprint: store build                          | Leaves it alone: OTA                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| Installing, removing or upgrading a native package            | JS/TS code, screens, styles, theme tokens                   |
| Expo SDK or React Native upgrade                              | Squad data, the question engine, copy                       |
| Anything in `app.json` (even `version`, `name`) or `eas.json` | Images bundled by Metro (flags)                             |
| The app icon; the Android adaptive icon (Android only)        | A JS-only npm package added or upgraded                     |
| A new npm script or `.gitignore` line (false positives)       | `package-lock.json`; `package.json` edits not yet installed |
| `fingerprint.config.js`                                       | `.github/`, `scripts/ci/`, `docs/`, `CLAUDE.md`             |

- Only installed packages count, so run `npm ci` before computing a fingerprint.
- The false positives disappear with `sourceSkips: ['PackageJsonScriptsAll', 'GitIgnore']`
  in `fingerprint.config.js`, which is itself a fingerprint change: it lands on `main`
  before the next version is cut, never on a locked branch.
- To see what's inside a fingerprint: `npx expo-updates fingerprint:generate --platform android --debug`.

What the fingerprint can't see:

- **What data leaves the device** (guardrail 4 in `CLAUDE.md`). Analytics, crash
  reporting, a new endpoint — even in pure JS — ship in a store build, together with the
  privacy policy, App Privacy and Data safety.
- **Store reviews.** A reviewer's device receives updates for its runtime like anyone's.
- Store listing text and screenshots (`store/` holds the text and the screenshot list),
  entered in Play Console and App Store Connect from a paste sheet
  ([Change the store listing](#change-the-store-listing)),
  and the web privacy pages (`scripts/privacy-pages.ts`), published on `gh-pages`.
  The pages are versioned: `privacy.html` is the 1.x policy and
  2.0's go in `privacy/2/`. A store's privacy URL moves to a version's
  pages when that store's App Privacy or Data safety answers are updated for
  it (before review on Apple, when the build is uploaded on Play), because the
  answers and the URL both belong to the app, not to a version. The pages must
  be published first.

## Branches

- **`main`**: development, including the next version's features. Its fingerprint drifts;
  nothing is ever published or built from it.
- **`release/X.Y.Z`**: one per version, cut from `main` once the version's content is
  decided. Each platform on it is in one of two states, read from EAS:

| State  | When                                                                 | What may merge                         |
| ------ | -------------------------------------------------------------------- | -------------------------------------- |
| Open   | No production build of X.Y.Z exists for the platform                 | Any change, runtime changes included   |
| Locked | A production build of X.Y.Z exists (finished, queued or in progress) | Only changes that keep the fingerprint |

A locked branch is its version's OTA source. A change that needs another runtime is a new
version: `release/X.Y.(Z+1)`, branched from `release/X.Y.Z`.

**Flow.** A fix for a shipped version is written on its release branch, against the code
that shipped: a PR into `release/X.Y.Z` from a branch cut from it. Once merged, its squash
commit goes to `main` by `git cherry-pick -x`, like anything merged into an open branch:
`pick-to-main` opens that PR, and you review and merge it. (Picking a fix out of `main`
instead risks dragging unreleased work into an OTA.) Docs, CI,
and whatever an open branch still needs from `main` go the other way, also by cherry-pick.
Neither branch ever merges the other: `release-gate` refuses a PR that brings commits from
`main`'s history.

**Rules.** GitHub rulesets make `main` and `release/*` take changes only by PR, forbid
deleting or force-pushing them, and require the `check` job; `release/*` also requires
`release-gate`. Every PR is squash-merged, so a PR is one commit and a pick is one commit.
Keep GitHub's default squash message: it carries each commit's `(cherry picked from
commit …)` line. An admin may merge a PR into `main` past a red check; nobody can on
`release/*`.

## Procedures

### Ship a JS fix

1. Write the fix on a branch cut from the release branch:
   `git switch -c fix/<topic> origin/release/1.0.0`
2. Open a PR into `release/1.0.0` labelled `ota:ios`, `ota:android` or both. No label, no
   publish: right for docs and CI changes.
3. `release-gate` comments a verdict per platform, and a ❌ blocks the merge (see
   [Troubleshooting](#troubleshooting)). With a label, every push also publishes to
   `preview`; the comment links the preview build to install. Open the app twice to see it.
4. **Squash and merge.** `ota-production` publishes each labelled platform, checks the
   runtime it published and comments on the PR.
5. Open a store install twice to see it.
6. `pick-to-main` opens the fix's cherry-pick into `main` and links it on the PR. Drop
   anything that belongs to the release only (a patch version's `app.json`), then merge. On
   a conflict it opens nothing and comments the commands instead: resolve them on `main`,
   where nothing ships.
7. Add the change's line to its version's section of `CHANGELOG.md`, under the category
   that fits and with the date it shipped: in the fix's own PR when the release branch has
   `CHANGELOG.md`, otherwise in the `pick-to-main` PR on `main`.

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
     Step 7's paste sheet says when they changed.
   - Point the site's own Privacy nav link at the new folder once every live store
     ships the version.
6. **Actions → store-build**: `platforms: both`, `profile: production`, `submit` on. Both
   platforms build from one commit; each job checks the built runtime, opens the freeze
   and lists what's left.
7. Enter the listing. From a clean checkout of the branch, `node scripts/store-bundle.ts`
   writes `dist/store-listing/paste-sheet.md`, marking each field, the images and the
   declarations _paste_ or _skip_ against the last version's tag. When the first run
   marks the images _paste_, or stops for missing captures, capture every language once
   and run it again; the second run copies the fresh captures (they are gitignored, so
   ones left from an earlier run would otherwise be handed over):
   `for code in en es fr it de; do npm run shots:store -- --lang=$code && npm run shots:play -- --lang=$code && npm run gen:play-assets -- --lang=$code || break; done`.
   Enter what says _paste_: Apple's before Submit for Review, Play's when the build is
   uploaded.
8. iOS: Submit for Review in App Store Connect. Android: promote the build in Play
   Console. Close each freeze once approved.
   Then tag the commit the build came from (its `store-build` run names it) and publish its
   notes: `git tag vX.Y.Z <commit> && git push origin vX.Y.Z`, then
   `awk '/^## \[X.Y.Z\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md > "$RUNNER_TEMP/notes.md"`
   (locally, any temp path) and
   `gh release create vX.Y.Z --title X.Y.Z --notes-file "$RUNNER_TEMP/notes.md"`.
   The tag is also what the next version's paste sheet compares with. When step 7 copied
   images, attach them to the same Release:
   `(cd dist/store-listing && rm -f app-store.zip play.zip && zip -qr app-store.zip app-store && zip -qr play.zip play)`,
   then
   `gh release upload vX.Y.Z dist/store-listing/app-store.zip dist/store-listing/play.zip`.
   They stay out of git: they are large. No workflow runs on tags. Play's 12-tester,
   14-day closed test gates only a new app's first production release; later updates go
   straight to review.

A runtime-changing fix to a released version (1.0.1):

1. `git push origin origin/release/1.0.0:refs/heads/release/1.0.1`
2. A PR into `release/1.0.1` with the fix and `app.json` at `1.0.1`. The version's
   `CHANGELOG.md` section goes in that PR when `release/1.0.0` has a `CHANGELOG.md`,
   otherwise on `main` with the pick.
3. Its What's new with the `escuadra-store-listing` skill, on a branch from the new
   release branch and in a PR into it, which `pick-to-main` takes to `main`; then steps
   5–8 as above, and take the fix to `main`. A 1.x branch predates `store/`: there enter
   the What's new in the consoles by hand and skip step 7.

`store-build` refuses a production build when `app.json` doesn't match the branch, when the
platform is locked to another runtime, and on the same runtime unless `rebuild` is on,
which is only for embedding newer JS for a review.

### Change the store listing

The listing is `store/`: one Markdown file per language, the screenshot set and the
console declarations (`.claude/rules/store-listing.md`). The `escuadra-store-listing`
skill drafts a change with you, writes the reviewers' sheets
(`node scripts/store-bundle.ts --review`) and walks you through entering it. A version's
listing is [Cut a release](#cut-a-release), steps 4 and 7.

Between versions, such as promotional text for a tournament, the skill drafts the change
on `main`, and it merges after the native sign-offs. From the sheet
`node scripts/store-bundle.ts` writes on `main`, you enter Promotional text in App Store
Connect and the listing fields in Play Console; any other App Store field changes only with
a version, so it waits for the next version's sheet. The sheet written on `main` holds no
images and no declarations, and any What's new on it is not entered: they come only with a
version. Make such a
change before the next version's `app.json` bump lands on `main`; after it, the sheet also
marks that version's edits _paste_, and only the field this change edits is entered.
The next version's sheet marks the change _paste_ again, because only a version's tag
records what is live.

### Cut preview builds

**store-build** with `profile: preview`. On a locked branch the preview build's runtime
equals production's, so it receives the same OTAs through `preview`. Preview and store
builds share the app ID: a device holds one at a time, and on Android switching means
uninstalling (different signing keys), which wipes local data.

### Take a change from `main` to a release branch

Docs, CI, or something an open branch still needs:
`git switch -c pick/<topic> origin/release/X.Y.Z && git cherry-pick -x <squash commit>…`,
then a PR into `release/X.Y.Z`. On a locked branch, `release-gate` passes it only if it
keeps the fingerprint.

## Reference

### Workflows

| Workflow         | Runs on                                   | Does                                            | Token and environment                              |
| ---------------- | ----------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `release-gate`   | Every PR into `release/*`                 | Fingerprint verdict (required); preview publish | `EXPO_TOKEN_PREVIEW`                               |
| `ota-production` | Push to `release/*` (a merged PR); manual | Production publish per labelled platform        | `EXPO_TOKEN_PRODUCTION` in `production-<platform>` |
| `ota-rollback`   | Manual                                    | Roll back production or preview                 | production runs in `production-<platform>`         |
| `store-build`    | Manual                                    | Production or preview build, optional submit    | production runs in `production-<platform>`         |
| `pick-to-main`   | A PR merged into `release/*`              | Opens its cherry-pick into `main`, runs `check` | `GITHUB_TOKEN`                                     |

`pick-to-main` needs **Settings → Actions → General → Allow GitHub Actions to create and
approve pull requests**. A PR opened with `GITHUB_TOKEN` starts no workflows, so the job
dispatches `check` on it; that's why `check.yml` takes `workflow_dispatch`.

Both environments accept only `release/*` branches, so only a run on a release branch
reaches the production token. The logic lives in `scripts/ci/`, tested by `npm run check`.
To see the gate's verdict before opening a PR, from a checkout of the branch you would
merge:
`EAS_CLI="npx --yes eas-cli@24.7.0" node scripts/ci/gate.ts --base release/1.0.0 --dry-run`.

**Pinned actions.** These workflows name each action by full commit SHA, its version in a
comment. A tag like `v7` can be repointed at other code by whoever controls the action's
repository, and these jobs run with an Expo token in reach, the production one included;
`actions/checkout` v7.0.1 isn't even an immutable release. To move a pin, replace the SHA
and the comment together: `gh api repos/actions/checkout/commits/<tag> --jq .sha`. `check`
holds no token and keeps plain tags.

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
| pick-to-main: couldn't cherry-pick             | `main` conflicts, often with an earlier release fix not yet on `main`. Run the commands it commented, resolve, and open the PR.                                 |
| pick-to-main: couldn't open its PR             | The Actions setting above is off. The branch is pushed: open its PR into `main` by hand.                                                                        |
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
