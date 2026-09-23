# Release pipeline — OTA updates and store builds through GitHub Actions

**Status:** design, approved 2026-09-23 (#73) and revised the same day: release branches
are cut from `main`, and a fix for a shipped version starts on its branch (§4).
Self-contained — every decision and its rationale is recorded here.

## 1. Problem

Escuadra ships a change one of two ways: an over-the-air (OTA) JavaScript update
through EAS Update, or a new store build. Both are run by hand from a Mac today,
following `docs/eas-update.md`, and the hand process has already failed once: on
2026-09-16 an update was published from `main`, whose fingerprint had drifted from
every shipped binary. `eas update` printed "Published!" and the update reached
nobody.

State on 2026-09-23: iOS 1.0.0 is live, Android 1.0.0 is in the Play closed test,
`release/1.0.0` is the OTA source for both, and `release-1.1.0` integrates the next
version. JS fixes are waiting for 1.0.0 (first: show the update ID on About), and
1.1.0 is to be the first version built through CI.

Goals:

- Automate both paths, OTA and store build.
- Workflows run manually or when a PR lands on `release/<version>` — never on `main`.
- A PR says which platforms it ships to.
- A fingerprint check runs on every PR into a release branch and again before every
  publish, so nothing is published against a runtime it doesn't match.
- Stay on the Expo Free plan.
- One front-door release document; CLAUDE.md keeps only a pointer.

## 2. Measured facts this design rests on

Measured 2026-09-23 unless noted.

| Fact                                                                                                                                                                                                   | Evidence                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The fingerprint depends on commit and platform only — not on channel or build profile                                                                                                                  | `release/1.0.0` computes iOS `8b8b8840…` and Android `a616db89…` under both `--build-profile preview` and `production`, equal to the shipped build 3 runtimes. `eas.json` is hashed as one file; `app.json` is static; EAS has no environment variables. |
| A 1.0.0 OTA published to `preview` today reaches nobody                                                                                                                                                | The only preview build (`d9f54943`, iOS) was cut from `release-1.1.0` commit `1add0764`; runtime `5c76669c`.                                                                                                                                             |
| One channel serves several runtimes at once                                                                                                                                                            | EAS Update matches updates to a device by runtime, so 1.0.0 and 1.1.0 updates can share `preview` and `production`.                                                                                                                                      |
| `fingerprint:compare` explains a mismatch                                                                                                                                                              | `main` against iOS build 3 lists `.gitignore` and the two added npm scripts.                                                                                                                                                                             |
| Free plan: unlimited publishing; 1,000 update users a month (hard cap, no overage); 100 GiB bandwidth; 20 GiB storage (semantics undocumented); 15 + 15 builds a month                                 | expo.dev/pricing. `eas account:usage` this cycle: 44 users, 260 MiB, 5 iOS + 2 Android builds.                                                                                                                                                           |
| A device counts once a month however many updates it downloads                                                                                                                                         | Expo usage-based pricing docs.                                                                                                                                                                                                                           |
| An update is about 4 MiB per platform (≈1.7 MiB compressed); unchanged images aren't downloaded again                                                                                                  | `expo export` on `main`.                                                                                                                                                                                                                                 |
| Android `distribution: internal` builds an installable APK by default                                                                                                                                  | Expo internal distribution docs — the `preview` profile needs no `eas.json` change.                                                                                                                                                                      |
| The repo is public                                                                                                                                                                                     | Rulesets, environments with branch policies, and Actions minutes cost nothing.                                                                                                                                                                           |
| Files under `.github/` and standalone `scripts/ci/*` leave the fingerprint unchanged; npm scripts, `.gitignore` lines, `app.json`, `eas.json`, native dependencies and `fingerprint.config.js` move it | The matrix in `docs/eas-update.md`, measured 2026-09-16 and 2026-09-21.                                                                                                                                                                                  |
| Vitest runs `scripts/**/*.test.ts` and `tsc` checks `**/*.ts` on `main` and `release/1.0.0`                                                                                                            | `vitest.config.ts`, `tsconfig.json`.                                                                                                                                                                                                                     |
| `release-1.1.0`'s `app.json` still says version `1.0.0`                                                                                                                                                | `git diff origin/main origin/release-1.1.0 -- app.json`.                                                                                                                                                                                                 |

## 3. Decisions

| Question           | Decision                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Preview lane       | Automatic: each push to a labelled PR publishes to `preview` when a preview build with the same fingerprint exists |
| Platform selection | Opt-in PR labels `ota:ios`, `ota:android`; no label, nothing published                                             |
| Branch model       | One convention, `release/X.Y.Z` cut from `main`, with a per-platform lifecycle (open → locked) read from EAS       |
| Branch protection  | Rulesets on `main` and `release/*`; a bypass only on `main`, only for PR merges                                    |
| Review freeze      | Freeze issues (label `ota-freeze`), keyed `platform@version`                                                       |
| Production guard   | Environments `production-ios` and `production-android`, deployable from `release/*` only                           |
| Implementation     | Thin workflows; every decision in tested TypeScript under `scripts/ci/`                                            |
| Production publish | A fresh publish from the merged commit                                                                             |
| Docs               | One front door, `docs/release.md`, absorbing what is still needed from `docs/eas-update.md`                        |

Rejected:

- **Expo's `continuous-deploy-fingerprint` actions.** Untested here, and they answer
  "is there _a_ build with this fingerprint?" — nothing about versions, locks, freezes
  or labels. The auto-build variant would also skip the store-build decision.
- **EAS Workflows.** 60 minutes a month on Free, `.eas/` never measured for fingerprint
  impact, and every control chosen above is GitHub-native.
- **Promoting the tested preview group to production.** If another PR merged after the
  last preview push, the promoted group lacks it and silently reverts it in production.

## 4. Branch model

### Lifecycle

A version gets its `release/X.Y.Z` branch when it is cut from `main`, once its content is
decided. Each platform on the branch is in one of two states, read from EAS and never set
by hand:

| State  | Condition                                                                                  | What may merge                                                                                         | Publishing                          |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Open   | No production build of X.Y.Z exists for the platform                                       | Anything: fixes, syncs from `main`                                                                     | Preview, if a preview build matches |
| Locked | A production build of X.Y.Z exists for the platform — finished, new, queued or in progress | Only PRs whose fingerprint equals the latest such build's runtime and that bring no commit from `main` | Preview and production              |

- Errored and cancelled builds don't count. "Latest" is by creation time: iOS 1.0.0
  locks to build 3 (`8b8b8840`), not build 2 (`1875cdee`).
- Queued and in-progress builds lock, so a PR can't move the runtime while a build waits
  in the Free queue. If EAS doesn't report the runtime of an unfinished build yet, PRs
  wait until it finishes (§12).
- The lock is per platform: an iOS-only build leaves Android open.
- Branch names must match `^release/(\d+)\.(\d+)\.(\d+)$`. The `app.json` version must
  equal the branch's: a warning on an open branch, a hard stop for store builds. A
  production build cut from the 1.1.0 branch while `app.json` says `1.0.0` would be
  recorded as the newest 1.0.0 build and lock `release/1.0.0` to the wrong runtime.
- After the lock, a runtime change is always a new version, e.g. `release/1.0.1`
  branched from `release/1.0.0`.

### Flow

- Development, the next version's features included, happens on `main`. A version's
  branch is cut only once its content is decided, so nothing locks early.
- A fix for a shipped version starts on its release branch: a PR from a branch cut from
  `release/X.Y.Z`, previewed through the labels. Once merged, a PR of `git cherry-pick -x`
  commits takes it to `main`, as it does anything merged into an open branch.
- Why that direction: `main` carries unreleased work. A fix written there and picked back
  can conflict in the same files, and resolving that on a shipping branch can drag
  unreleased code — TelemetryDeck today — into an OTA, which guardrail 4 forbids and the
  fingerprint can't see. Conflicts on the way to `main` are resolved where nothing ships.
  The cost, remembering the pick to `main`, is carried by the gate's comment (§6).
- Docs and CI changes start on `main` and reach release branches by cherry-pick.
- An open branch may sync from `main` by PR, with a merge commit. A release branch never
  merges into `main`; after its lock it lives on as its version's OTA source.

### 1.1.0

`release-1.1.0` was renamed `release/1.1.0` through GitHub's branch rename, then merged
into `main` and deleted when this flow replaced the long-lived integration branch. The
next version, its number still TBD, is cut from `main` once #54 and #55 have landed; #60
builds it.

## 5. Repository and EAS setup

### Rulesets

| Rule                          | `main`                | `release/*`                                            |
| ----------------------------- | --------------------- | ------------------------------------------------------ |
| Block deletion and force-push | ✓                     | ✓                                                      |
| Require a PR (0 approvals)    | ✓                     | ✓                                                      |
| Required checks               | `check`               | `check`, `release-gate`                                |
| Merge methods                 | unchanged             | merge commit, rebase — no squash                       |
| Bypass                        | admin, PR merges only | none; the escape is editing the ruleset (audit-logged) |

- The repo deletes a merged PR's head branch automatically; deletion protection keeps a
  release branch alive if one is ever a PR's head.
- No squash: a sync from `main` needs a real merge commit, and a rebase merge keeps each
  cherry-pick's `-x` line.
- Rulesets match `release/*` with wildcards; the version-shaped regex is enforced by
  `release-gate`, so `release/1.1` fails loudly instead of passing as an open branch.
- `main`'s ruleset goes live in rollout step 2. `release/*`'s waits until
  `release-gate` exists (step 4); before that, nothing could merge.

### Environments

`production-ios` and `production-android`, deployment branches `release/*`, no required
reviewers. Every production publish, production rollback and production build runs in
one of them, so none can run from `main` or a feature branch.

### Tokens

| Secret                  | EAS robot role | Stored as                                          | Used by                                                                     |
| ----------------------- | -------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| `EXPO_TOKEN_PREVIEW`    | Developer      | repository secret                                  | `release-gate`, preview publish, preview builds and preview rollback drills |
| `EXPO_TOKEN_PRODUCTION` | Admin          | environment secret in both production environments | production publish, rollback and builds                                     |

Plus `eas channel:protect production`, so only Admins can publish there. A workflow
edited inside a PR runs with repository secrets; with this split it still can't publish
to production.

### Labels and credentials

- Labels: `ota:ios` and `ota:android` for PRs, `ota-freeze` for issues.
- Store submission credentials (App Store Connect API key, Play service account) live on
  EAS, not in GitHub.

## 6. `release-gate` — the PR check

`release-gate.yml` runs on `pull_request` (opened, synchronize, reopened, labeled,
unlabeled) into `release/**`. It has no `paths:` filter: a workflow skipped by a path
filter never reports, and a required check would wait forever. Runs are grouped per PR,
and a new push cancels the old run.

The job `release-gate` (required) checks out the PR's merge commit with full history,
runs `npm ci`, then:

1. Parses the base branch; fails if it isn't `release/X.Y.Z`. Warns if the `app.json`
   version differs.
2. Computes both fingerprints:
   `eas fingerprint:generate --platform <p> --environment production --json --non-interactive`.
3. Reads the lock state per platform from
   `eas build:list --build-profile production --app-version X.Y.Z --platform <p> --json`.
4. Gives a verdict per platform:
   - locked, fingerprint matches — ✅;
   - locked, fingerprint differs — ❌, with the `fingerprint:compare --build-id` explanation
     and "put it on a new version: `release/X.Y.(Z+1)` from this branch";
   - open — ✅, "no X.Y.Z build yet";
   - a production build unfinished and its runtime unknown — ❌, "wait for build N".
5. On a locked branch, fails if the PR contains any commit that is in `origin/main`'s
   history but not on the base branch. This catches a sync from `main` and a branch cut
   from `main` by mistake. After 1.1.0 ships, `main` and `release/1.1.0` will often share
   a runtime, so the fingerprint alone would let 1.2.0 work reach 1.1.0 users.
6. Reports, without blocking: labels; open freezes for the labelled platforms; with an
   `ota:*` label, the guardrail-4 line; changed dependencies and added network-looking
   code (`fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, URL literals) in files the
   app bundles — everything outside `docs/`, `.github/`, `scripts/`, `tools/` and tests;
   and a reminder that whatever isn't on `main` yet goes there by cherry-pick once merged.
7. Writes one PR comment, updated in place on each run (found by a hidden marker), and
   the job summary. If EAS can't be reached, the check fails and is re-run later.

The job `preview` (after `release-gate`, not required) runs once per `ota:*` label:

- Skips if every changed file is docs or CI (`docs/**`, `**/*.md`, `.github/**`,
  `scripts/ci/**`).
- Skips if no finished `preview` build has this fingerprint
  (`build:list --build-profile preview --fingerprint-hash …`), saying "cut one with
  store-build (profile: preview)".
- Otherwise publishes the same merge commit:
  `eas update --channel preview --platform <p> --environment preview --message "PR #N: <title> @ <sha7>" --non-interactive --json`,
  and adds the update group ID to the comment.
- A manual re-publish is a re-run of the workflow from the PR.

The comment, for a PR that moves the Android runtime:

```
release-gate · release/1.0.0 (1.0.0)
| Platform | State  | Shipped build      | This PR  |                   |
| iOS      | locked | build 3 · 8b8b8840 | 8b8b8840 | ✅ OTA-compatible  |
| Android  | locked | build 3 · a616db89 | c0a62aca | ❌ runtime changed |
Android: 📁 .gitignore modified · 📝 package.json scripts + "gen:play-assets"
→ Not an OTA for 1.0.0. Put it on a new version: release/1.0.1 from release/1.0.0.
Labels: ota:ios · Freeze: none · Preview: iOS → group 1a2b3c4d (open the preview app twice)
ota:* confirms this PR doesn't change what data leaves the device (guardrail 4).
```

## 7. Production publishing

`ota-production.yml` has two triggers:

- **`push` to `release/**`.** The rulesets make every such push a merged PR, except the
  push that creates a branch. The run finds the PR through
  `GET /repos/{owner}/{repo}/commits/{sha}/pulls`, takes the platforms from its `ota:*`
  labels and the message `<PR title> (#N)`. No PR or no label: nothing is published, and
  the summary says so.
- **`workflow_dispatch`** on a release branch, with inputs `platforms` (`ios` | `android`
  | `both`) and an optional `message`. It publishes the branch head: the second platform
  of a staggered release, a publish after a freeze, a re-publish.

One job per platform runs in `production-<platform>`. Jobs share a concurrency group per
branch and platform, without cancel-in-progress: a running publish always finishes, and a
newer queued run replaces an older queued one — harmless, because the newer commit on the
same branch contains the older one. (One group across branches would let a queued 1.1.0
publish replace a queued 1.0.0 publish.) Each job:

1. Checks again on the exact commit: the platform is locked and the fingerprint equals
   the locked build's runtime. On an open platform, a push-triggered run skips with a
   note and a manual run fails.
2. Fails if an open `ota-freeze` issue is titled `OTA freeze: <platform>@<version>`:
   "frozen by #NN — close it when the review passes, then Re-run failed jobs".
3. Skips if the newest production update for this platform and runtime came from this
   commit, so "Re-run all jobs" can't publish twice.
4. Publishes: `eas update --channel production --platform <p> --environment production --message … --non-interactive --json`.
5. Verifies that `eas fingerprint:compare --build-id <locked build> --update-id <new update>`
   matches. If not, the job fails loudly and points to rollback.
6. Prints update users and bandwidth from `eas account:usage --json`, with a warning at
   80% of the Free caps.
7. Reports in the job summary and as a PR comment; GitHub records the deployment.

Left out on purpose: automatic rollback (a failed verification means something
unexplained, and a person decides) and `--rollout-percentage` (no benefit at 44 update
users a month; it can become a dispatch input later).

## 8. Review freeze

- An open issue labelled `ota-freeze` and titled `OTA freeze: <platform>@<version>`
  (`^OTA freeze: (ios|android)@(\d+\.\d+\.\d+)`) blocks production publishes for exactly
  that platform and version. Other versions keep flowing: a reviewer's device runs the
  binary under review, and only updates for its runtime can reach it.
- `store-build` opens one for a production build with `submit` on; `ota-rollback` opens
  one on every production rollback. Anything done outside CI — a Play Console promotion (#51), a
  manual upload — gets one by hand: a single `gh issue create`.
- Closed by hand when the review passes. A forgotten issue blocks for too long; it never
  lets anything ship early.
- `release-gate` shows open freezes; publishing enforces them. A freeze never blocks a
  rollback.

## 9. Rollback

`ota-rollback.yml` is started manually on a release branch, also from the GitHub mobile
app. Inputs: `platforms` (`ios` | `android` | `both`), `channel` (`production` by default,
or `preview` for drills), `mode` (`previous` by default, `group`, `embedded`), `group_id`,
and a required `reason`. Production jobs run in `production-<platform>`; preview jobs use
the preview token. The platform must be locked.

| Mode       | Action                                                                                                 | Use when                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `previous` | `eas update:republish --group <prior>` — the group before the newest one for this platform and runtime | The latest update broke something. Earlier OTA fixes stay.                                                                   |
| `group`    | Republish the named group, checked to match the platform and runtime                                   | You know which update was last good                                                                                          |
| `embedded` | `eas update:roll-back-to-embedded --runtime-version <runtime>`                                         | No earlier update, or the whole chain is suspect. Last resort on 1.0.0: it drops #61's corrected privacy text (guardrail 4). |

Steps:

1. Takes the runtime from the branch's locked build for the platform.
2. Production only: opens the freeze issue first, with the reason and "revert the bad
   change here, then close". The bad commit is still on the branch, and the next merged
   PR would publish it again. A preview rollback opens no freeze — the next push to the PR
   re-publishes preview anyway, and a `platform@version` freeze would block production.
3. Production only: waits until no `ota-production` run for this branch and platform is
   queued or in progress. Rollback has its own concurrency group: in GitHub Actions a
   newly queued run cancels a pending run in the same group, so a shared group would let
   a merge-triggered publish cancel a waiting rollback.
4. Rolls back, one platform per command.
5. Verifies that the newest update for the platform and runtime is the rollback; for a
   republish, `fingerprint:compare` against the build also matches.
6. Reports from → to, the new group, the runtime, the freeze link, and "devices switch
   after two launches".

Recovery: a revert or fix PR into the release branch, close the freeze, merge, then pick
it to `main`. Merging first also works: the publish fails as frozen, and "Re-run failed
jobs" after closing the freeze publishes it.

## 10. Store builds

`store-build.yml` is started manually on a release branch. Inputs: `platforms` (`ios` |
`android` | `both`), `profile` (`production` | `preview`), `submit` (production only, on
by default) and `rebuild` (off by default). One run builds every chosen platform from the
same commit.

Production checks, per platform, before anything reaches EAS:

1. The branch is `release/X.Y.Z` and the job runs in `production-<platform>`.
2. The `app.json` version equals the branch version.
3. The platform is open. If it is locked, a different runtime is refused ("needs a new
   version") and the same runtime is refused unless `rebuild` is on — for a review that
   needs JS fixes built in rather than delivered by OTA.
4. `npm run check` passes.

Then `eas build --profile production --platform <p> --non-interactive [--auto-submit]`,
waiting for the result, since minutes are free and waiting lets the job finish:

- Verifies that the build's `runtime.version` equals the fingerprint the runner computed
  before building, which answers on every build whether a Linux runner and EAS agree.
- With `submit`: opens `OTA freeze: <platform>@<version>`.
- Reports the build number, runtime, links and the manual steps left: iOS — Submit for
  Review in App Store Connect; Android — promote in Play Console; both — close the freeze
  once approved.

Preview builds check only the branch name, use the preview token, never submit or
freeze, and on a locked branch verify that their runtime equals the production one.

Procedures this enables (written out in `docs/release.md`):

- **Feature release (1.1.0):** the version bump and `fingerprint.config.js`
  (`sourceSkips: ['PackageJsonScriptsAll', 'GitIgnore']`) land on `main`; cut
  `release/1.1.0` from it; run with `both`; the branch locks (#60).
- **Runtime-changing fix to 1.0.0:**
  `git push origin origin/release/1.0.0:refs/heads/release/1.0.1`; PR with the fix and
  the version bump; run; the branch locks; pick the fix to `main`.

Stays manual: Submit for Review, Play promotions and their freezes, closing freezes.

## 11. Code layout and testing

```
.github/actions/setup/action.yml   Node from .nvmrc, npm ci, pinned eas-cli
.github/workflows/
  check.yml            + actionlint
  release-gate.yml     §6
  ota-production.yml   §7
  ota-rollback.yml     §9
  store-build.yml      §10
scripts/ci/
  lib/                 pure decisions, no I/O
  flows/               gate, publish, rollback, build, over an injected Runner
  fixtures/            real EAS output from 2026-09-23, trimmed to the fields the code reads
  gate.ts  publish.ts  rollback.ts  build.ts   entry points
```

- `lib/`: parse `release/X.Y.Z`; lock state from a build list; the per-platform verdict;
  platforms from labels; freeze matching; docs-only detection; choosing the rollback
  target; rendering the comment and summaries.
- `flows/`: sequence the steps through a `Runner` (`eas`, `gh`, `git`). Tests pass a fake
  that records calls.
- Entry points read the event payload and environment, wire the real runner
  (`child_process.execFile`), and write `$GITHUB_OUTPUT` and `$GITHUB_STEP_SUMMARY`.
  Workflows run them as `node scripts/ci/<name>.ts`, with Node 24 type stripping, like
  `scripts/gen-squads.ts`.
- Dry run on a Mac: `node scripts/ci/gate.ts --base release/1.0.0 --dry-run` prints the
  verdict using the local EAS login and posts nothing.

The rules are unit tests, run by Vitest inside `npm run check` on every branch:

- publish: frozen, open or mismatched means `eas update` is never called; a failed
  verification exits non-zero;
- gate: locked with a mismatch fails; `main` commits on a locked branch fail; an
  unfinished build with an unknown runtime fails;
- rollback: the freeze issue is created before the rollback command; `previous` with no
  earlier group fails without calling EAS;
- build: a version mismatch, a locked platform without `rebuild`, or `rebuild` with a
  different runtime means `eas build` is never called.

The fixtures carry the edge cases: iOS 1.0.0 builds 2 and 3 with different runtimes; the
#53 preview build that says 1.0.0 but came from the 1.1.0 branch (preview builds never
lock); the production history with the orphaned `c0a62aca` update. Build JSON is trimmed
to the fields the code reads, so no artifact URLs land in a public repo.

Constraints:

- No npm scripts and no new dependencies: Node built-ins, the `eas`, `gh` and `git` CLIs,
  and the Vitest already installed.
- TypeScript that Node can strip: no enums, no parameter properties, relative imports end
  in `.ts`. Strict mode and `noUncheckedIndexedAccess` stay on.
- Temporary files go to `$RUNNER_TEMP`.
- Least-privilege `permissions:` per workflow; third-party actions pinned to commit SHAs;
  PR titles, labels and messages reach scripts through the environment or the event
  file, never interpolated into `run:`; eas-cli pinned to one version.

## 12. To verify during implementation

| Item                                                                                                          | If it doesn't hold                                                                             |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| EAS reports the runtime or fingerprint of an unfinished build                                                 | PRs wait while a production build of the version is unfinished — already the designed fallback |
| EAS robot users can hold the Developer and Admin roles, and an Admin robot can publish to a protected channel | The production token is the owner's personal token, kept in the production environments        |
| Submission credentials exist on EAS                                                                           | The owner adds them to EAS once                                                                |
| `commits/{sha}/pulls` returns the PR for rebase-merged commits                                                | Find the PR from the push payload's commit list                                                |
| `eas update --json` and `update:view --json` expose the group and update IDs and the git commit               | The duplicate guard compares messages instead of commits                                       |
| Environment branch policies admit `push` and `workflow_dispatch` runs on `release/*`                          | The scripts' own branch check remains the guard                                                |

## 13. Documentation

`docs/release.md` becomes the one front door and replaces `docs/eas-update.md`, which is
deleted; the links in CLAUDE.md and README.md follow. It should read in about ten minutes:
overview first, then concepts, procedures and reference, and nothing said twice —
procedures link to concepts instead of restating them.

1. **Start here** — the three flows (labelled PR → preview → merge → production; store
   build; rollback) and the one rule: the fingerprint decides, and a locked branch never
   moves it.
2. **How an update reaches a device** — channel, platform and runtime must all match;
   two launches; nothing in Expo Go or development builds; reading `Updates.updateId`.
3. **OTA or store build?** — one table of what moves the fingerprint and what doesn't,
   the two false positives, what the fingerprint can't see (guardrail 4, store review),
   and `fingerprint.config.js` at the next version's build.
4. **Branches** — lifecycle, rules, flow, and a current-releases table (version,
   platform, build, runtime, state).
5. **Procedures** — ship a JS fix; release one platform first or publish after a freeze;
   review freeze; roll back; cut a feature release; runtime-changing fix; cut preview
   builds; sync `main` into an open branch.
6. **Reference** — workflows (trigger, inputs, environment, token), labels, the freeze
   format, commands, troubleshooting by workflow message, and the manual fallback for
   when Actions is down.

What survives from `docs/eas-update.md`:

| Section                                     | Fate                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| The short version                           | Replaced by "Start here"                                                                                    |
| How updates work, timing, Expo Go           | Kept, condensed into §2                                                                                     |
| The fingerprint matrix and its explanations | One table and three one-line caveats; provenance in one line (SDK 57, eas-cli 24 — re-measure if they move) |
| Store build or OTA?                         | Merged into §3                                                                                              |
| Branches, one per shipped version           | Replaced by the lifecycle                                                                                   |
| Manual OTA and store-build walkthroughs     | Replaced by procedures; a short manual fallback stays in §6                                                 |
| Verification reference                      | Trimmed into §6                                                                                             |
| Troubleshooting                             | Rewritten around workflow messages; the timing items move to §2                                             |
| Automation plan                             | Replaced by what exists                                                                                     |
| The 2026-09-16 incident narrative           | One sentence of "why"                                                                                       |

**CLAUDE.md.** The release status, branches and flow paragraphs, and the "EAS: builds,
channels and over-the-air updates" subsection — about 115 of its 473 lines — become a
short **Releases** section with a link to `docs/release.md` and only the rules no session
may break:

- OTA updates go out only through a PR into `release/X.Y.Z` with an `ota:*` label; store
  builds only through `store-build`; `eas update` and `eas build` by hand only per the
  release doc's fallback.
- On a locked branch, nothing that moves the fingerprint: npm scripts, dependency
  changes, `.gitignore` lines, `app.json`, `eas.json`, `fingerprint.config.js`.
- A fix for a shipped version starts on its release branch and reaches `main` by
  `cherry-pick -x`; docs and CI changes go the other way.
- CI calls tools directly — never through new npm scripts — and writes temporary files
  to `$RUNNER_TEMP`.

The SDK-pin and `userInterfaceStyle` warnings stay under Environment. `release/1.0.0`'s
header note shrinks to the same pointer. Splitting the rest of CLAUDE.md is separate work.

## 14. Rollout

Each step proves something before the next depends on it. 👤 marks the owner's steps;
every GitHub or EAS settings change is confirmed with the owner before it's made.

1. **Rename and docs.** Rename `release-1.1.0` to `release/1.1.0`. One PR on `main`:
   `docs/release.md` (the model, the current manual procedures) replaces
   `docs/eas-update.md`; CLAUDE.md gets its Releases section; README.md's link follows.
   Then `release/1.1.0` merges into `main` and is deleted (§4), and the docs are
   cherry-picked to `release/1.0.0` by PR.
2. **Accounts and settings.** 👤 Create the two EAS robot tokens and store them as GitHub
   secrets. 👤 Confirm submission credentials on EAS. Then labels, environments,
   `eas channel:protect production`, and `main`'s ruleset.
3. **Build on `main`.** One PR: `scripts/ci/` with tests, the setup action, the four
   workflows, actionlint, and the pipeline sections of `docs/release.md`. Dry run against
   `release/1.0.0`, expecting ✅ `8b8b8840` / `a616db89`.
4. **Run it on its own introduction.** A cherry-pick PR into `release/1.0.0`:
   `release-gate` runs on the PR that adds it and must show both fingerprints unchanged,
   and the fingerprints it prints on a Linux runner answer the runner-vs-Mac question.
   Then switch on `release/*`'s ruleset.
5. **Preview lane.** `store-build` with profile `preview` and `both` on `release/1.0.0`:
   one build per platform from the Free quota. 👤 Install them. A preview build and a
   store build share the app ID, so a device holds one at a time; on Android, switching
   means uninstalling (different signing keys), which wipes best scores.
6. **First real OTA: the About update-ID fix**, first because it makes every later
   on-device check instant. PR into `release/1.0.0` with `ota:ios` and `ota:android`;
   preview publish; 👤 open the app twice; merge, which publishes to production; 👤 verify
   on a store install; pick it to `main`.
7. **Failure drills.** A throwaway PR adding an npm script fails `release-gate` with the
   diff. An open freeze blocks a publish; closing it and re-running publishes. A manual
   run from `main` is refused. A rollback drill on `preview` rolls back and verifies.
8. **Docs final**, then close #73.

The next store version (#60) is then the first production use of `store-build`.

## 15. Acceptance criteria

From #73:

- A JS fix merged into `release/1.0.0` reaches production users through CI with no local
  `eas` command (step 6).
- CI refuses to publish when no production build matches the fingerprint and while the
  platform is frozen (unit tests in §11; drills in step 7).
- Nothing CI adds to `release/1.0.0` moves its fingerprints `8b8b8840` / `a616db89`
  (step 4).
- Guardrail 4 stays human: an `ota:*` label is the owner's statement; CI never infers it.

From this design:

- Every PR into `release/*` shows a verdict per platform, and a red verdict blocks the
  merge.
- A rollback drill on `preview` rolls back and verifies; the production rollback's
  freeze-first ordering is covered by unit tests.
- `docs/release.md` replaces `docs/eas-update.md`; CLAUDE.md's release material is a
  short section with a link.

## 16. Out of scope

- Automatic rollback and partial rollouts.
- Bots that open cherry-pick PRs (a PR opened with `GITHUB_TOKEN` wouldn't trigger
  `release-gate` anyway).
- EAS Workflows and Expo's continuous-deploy actions.
- Reading review status from the App Store Connect or Play APIs; freezes are closed by
  hand.
- Pruning old preview updates for storage; revisit if the 20 GiB ever matters.
- The About update-ID fix itself: a separate issue, and the first payload through the
  pipeline.
- Splitting the rest of CLAUDE.md.
