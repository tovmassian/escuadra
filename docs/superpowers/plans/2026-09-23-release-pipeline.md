# Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship OTA updates and store builds for Escuadra through GitHub Actions, gated by the fingerprint of every PR into a `release/X.Y.Z` branch, with preview publishing, production publishing, review freezes, rollback and gated store builds — and one front-door release document.

**Architecture:** Thin workflow files call `node scripts/ci/<name>.ts`. Every decision lives in pure functions under `scripts/ci/lib/`; `scripts/ci/flows/` sequences the `eas`, `gh` and `git` calls through an injected `Runner`, so a fake runner in tests proves what a flow did and never did. Nothing added touches the native fingerprint.

**Tech Stack:** Node 24 with native type stripping, TypeScript (strict, `noUncheckedIndexedAccess`), Vitest, GitHub Actions, `eas-cli` 24.7.0, `gh`, `git`.

**Spec:** `docs/superpowers/specs/2026-09-23-release-pipeline-design.md` — read it first.

## Global Constraints

- Run `nvm use` before anything (Node 24, `.nvmrc`). Scripts run as `node scripts/ci/<name>.ts`; `scripts/package.json` makes them ES modules.
- **Fingerprint-inert only:** no new npm scripts, no new dependencies, no `.gitignore` lines, no edits to `app.json`, `eas.json` or `package.json`, no `fingerprint.config.js`. Temporary files go to `$RUNNER_TEMP`.
- TypeScript: strict and `noUncheckedIndexedAccess` stay on. Erasable syntax only — no `enum`, `namespace` or constructor parameter properties. Relative imports end in `.ts`; type-only imports use `import type` or inline `type`.
- Output with `process.stdout.write`, never `console.log` (the lint config warns on it).
- Module headers explain _why_, like `scripts/gen-squads.ts`.
- Tests: Vitest, `scripts/ci/**/*.test.ts`, run by `npm run check`. Before every commit: `npx prettier --write <files>` then `npm run check`, and report its output.
- Pinned versions: `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1), `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020` (v7.0.0), `docker://rhysd/actionlint:1.7.12`, `eas-cli@24.7.0`.
- Names that must match everywhere: labels `ota:ios`, `ota:android`, `ota-freeze`; freeze title `OTA freeze: <platform>@<version>`; branch regex `^release/(\d+)\.(\d+)\.(\d+)$`; required checks `check` and `release-gate`; environments `production-ios`, `production-android`; secrets `EXPO_TOKEN_PREVIEW` (repository) and `EXPO_TOKEN_PRODUCTION` (environments); EAS account `tovmassian27`, project `escuadra`.
- PR titles, labels and inputs reach scripts through `env:` or the event file — never `${{ }}` inside a `run:` script.
- Never handle a token, password or API key yourself: steps marked 👤 are the owner's. Confirm with the owner before every GitHub or EAS settings change, every push, every PR and every merge.

## Differences from the spec, and why

- **Rollback gains a `dry_run` input.** The real `production` history shows that `previous` on Android today would republish the #44 "OTA marker" test update (fixture test in Task 7). A dry run shows the target first.
- **One `preview` job publishes every labelled platform in turn** instead of one job per label, so two jobs never edit the gate's comment at once. Same behaviour.
- **Publish verification compares runtimes directly:** the published update's `runtimeVersion` must equal the locked build's runtime. That is the delivery rule itself, and it is parseable; `fingerprint:compare --update-id` prints prose.
- **Syncs from `main` come from a `sync/…` branch**, not a PR from `main` itself: conflicts can't be resolved on `main`.

## File map

| Path                                                                           | Responsibility                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `docs/release.md`                                                              | The front door: how releases work and every procedure (Tasks 2, 16)     |
| `docs/eas-update.md`                                                           | Deleted (Task 2)                                                        |
| `CLAUDE.md`, `README.md`                                                       | Releases section and links (Task 2); banner on `release/1.0.0` (Task 3) |
| `scripts/ci/fixtures/{load.ts,builds.json,updates-production.json}`            | Real EAS output, trimmed; loader for tests                              |
| `scripts/ci/lib/release.ts`                                                    | Branch → version, lock state, per-platform verdicts, gate errors        |
| `scripts/ci/lib/pr.ts`                                                         | Platforms from labels and inputs; docs-only; guardrail-4 hints          |
| `scripts/ci/lib/freeze.ts`                                                     | Freeze issue title and matching                                         |
| `scripts/ci/lib/updates.ts`                                                    | Update history: rollback target, duplicate guard                        |
| `scripts/ci/lib/usage.ts`                                                      | Free-plan usage line and warnings                                       |
| `scripts/ci/lib/outcome.ts`                                                    | `done` / `skipped` / `failed` results                                   |
| `scripts/ci/lib/render.ts`                                                     | The gate's PR comment                                                   |
| `scripts/ci/flows/runner.ts`, `fake-runner.ts`                                 | Command execution and its test double                                   |
| `scripts/ci/flows/{eas,github,git}.ts`                                         | Typed CLI calls                                                         |
| `scripts/ci/flows/{gate,preview,publish,rollback,build}.ts`                    | The five flows                                                          |
| `scripts/ci/flows/actions.ts`                                                  | Event, env, outputs, job summary                                        |
| `scripts/ci/{gate,preview,publish,rollback,build}.ts`                          | Entry points                                                            |
| `.github/actions/setup/action.yml`                                             | Node, `npm ci`, eas-cli                                                 |
| `.github/workflows/{release-gate,ota-production,ota-rollback,store-build}.yml` | The workflows                                                           |
| `.github/workflows/check.yml`                                                  | Gains actionlint                                                        |

---

## Phase 1 — Rename and docs (spec §14, step 1)

### Task 1: Rename `release-1.1.0` to `release/1.1.0`

**Files:** none (GitHub and local git state).

- [ ] **Step 1: Confirm nothing targets the old name**

Run: `gh pr list --base release-1.1.0 --state open --json number`
Expected: `[]`

- [ ] **Step 2: Rename on GitHub** (confirm with the owner first)

Run: `gh api -X POST repos/tovmassian/escuadra/branches/release-1.1.0/rename -f new_name=release/1.1.0 --jq .name`
Expected: `release/1.1.0`

- [ ] **Step 3: Follow locally**

```bash
git fetch --prune origin
git branch -m release-1.1.0 release/1.1.0
git branch -u origin/release/1.1.0 release/1.1.0
git ls-remote --heads origin 'release*'
```

Expected: exactly two heads, `refs/heads/release/1.0.0` and `refs/heads/release/1.1.0`.

---

### Task 2: `docs/release.md` replaces `docs/eas-update.md` on `main`

**Files:**

- Create: `docs/release.md`
- Delete: `docs/eas-update.md`
- Modify: `CLAUDE.md` (Current state, Environment → EAS, Reference docs), `README.md:19`

Work on branch `ci/73-release-pipeline` (it already holds the spec and this plan).

- [ ] **Step 1: Write `docs/release.md`**

````markdown
# Releasing Escuadra

How a change reaches users — an over-the-air (OTA) update of the JavaScript, or a new
store build — and how to take one back. The design behind it is
[`docs/superpowers/specs/2026-09-23-release-pipeline-design.md`](superpowers/specs/2026-09-23-release-pipeline-design.md).

## Start here

The release pipeline (#73) is being built. Until it lands, releases are manual: follow
[Manual procedures](#manual-procedures).

**The one rule: the fingerprint decides.** An update reaches only the builds whose runtime
equals the fingerprint of the commit it was published from, and a locked release branch
never changes its fingerprint.

| Version | Platform | Build          | Runtime    | Branch          | State                           |
| ------- | -------- | -------------- | ---------- | --------------- | ------------------------------- |
| 1.0.0   | iOS      | 3 · `ef36adae` | `8b8b8840` | `release/1.0.0` | locked · live on the App Store  |
| 1.0.0   | Android  | 3 · `1973200b` | `a616db89` | `release/1.0.0` | locked · Play closed test (#49) |
| 1.1.0   | both     | —              | —          | `release/1.1.0` | open                            |

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

- One channel serves several runtimes at once: 1.0.0 and 1.1.0 updates share `production`.
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
  change: it lands on `release/1.1.0` before that version's build, never on a locked branch.
- To see what's inside a fingerprint: `npx expo-updates fingerprint:generate --platform android --debug`.

What the fingerprint can't see:

- **What data leaves the device** (guardrail 4 in `CLAUDE.md`). Analytics, crash
  reporting, a new endpoint — even in pure JS — ship in a store build, together with the
  privacy policy, App Privacy and Data safety.
- **Store reviews.** A reviewer's device receives updates for its runtime like anyone's.
- Store listing text and screenshots, and the web privacy page: those change in Play
  Console, App Store Connect and on `gh-pages`.

## Branches

- **`main`**: development. Its fingerprint drifts; nothing is ever published from it.
- **`release/X.Y.Z`**: one per version, from the day work on it starts. Each platform on
  it is in one of two states, read from EAS:

| State  | When                                                                 | What may merge                                                        |
| ------ | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Open   | No production build of X.Y.Z exists for the platform                 | Anything: feature PRs, syncs from `main`                              |
| Locked | A production build of X.Y.Z exists (finished, queued or in progress) | Cherry-picks that keep the fingerprint; nothing from `main`'s history |

A locked branch is its version's OTA source. A change that needs another runtime is a new
version: `release/X.Y.(Z+1)`, branched from `release/X.Y.Z`.

**Flow.** Fixes land on `main` first, by PR. They reach a locked branch as a PR of
`git cherry-pick -x` commits on a branch cut from the release branch; a hotfix written
there first goes back to `main` the same way. An open branch syncs from `main` by PR, with
a merge commit. A feature release ends with a PR from `release/X.Y.Z` into `main`.

## Reference

### Manual procedures

From a clean checkout of the release branch, one platform per command (`--platform`
defaults to `all`):

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

| Symptom                                | Cause and fix                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| "Published!" but no device gets it     | The update's runtime matches no build: published from the wrong branch, or a stale `node_modules`. |
| Still the old version after one launch | Updates apply on the next cold start: close fully and reopen.                                      |
| Works in Expo Go, not on the phone     | Expo Go runs your local bundle and ignores runtimes.                                               |

### Commands

| Question                           | Command                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| What runtime would I publish to?   | `npx expo-updates fingerprint:generate --platform ios`                              |
| Does this tree match a build?      | `npx eas-cli fingerprint:compare --build-id <id> --environment production`          |
| Which build has this runtime?      | `npx eas-cli build:list --fingerprint-hash <hash> --platform ios --status finished` |
| What's published?                  | `npx eas-cli update:list --branch production --limit 5`                             |
| How much of the Free plan is used? | `npx eas-cli account:usage tovmassian27`                                            |
````

- [ ] **Step 2: Delete the old guide**

Run: `git rm docs/eas-update.md`

- [ ] **Step 3: Replace the release paragraphs in CLAUDE.md's "Current state"**

Replace everything from the line starting `**Release status (2026-09-21):**` through the line `into `main`'s CLAUDE.md.` (the end of the "Flow" paragraph, just before `## Scope and roadmap`) with:

```markdown
## Releases

How changes reach users (OTA updates and store builds), the branch model and which
versions are live: [`docs/release.md`](docs/release.md). The rules no session may break:

- **Nothing is published or built from `main`.** OTA updates and store builds come only
  from `release/X.Y.Z` branches, as `docs/release.md` describes.
- **Nothing that moves the fingerprint lands on a locked release branch:** npm scripts,
  dependency changes, `.gitignore` lines, `app.json`, `eas.json`, `fingerprint.config.js`.
  A change that needs one is a new version.
- **Fixes land on `main` first** and reach a locked branch by `git cherry-pick -x`.
- **`runtimeVersion` stays on the `fingerprint` policy.** `appVersion` would hand
  JavaScript to binaries that can't run it.
- **CI calls tools directly** (`node scripts/ci/…`, `npx eas-cli …`), never through new npm
  scripts, and writes temporary files to `$RUNNER_TEMP`, never new `.gitignore` lines.
```

- [ ] **Step 4: Remove the EAS subsection**

Delete from the line `### EAS: builds, channels and over-the-air updates` through the line `build, never by reading the config.` and the blank line after it, so `## Working conventions` follows the paragraph ending `what each captured file shows.` with one blank line. Everything that subsection said now lives in `docs/release.md` or the Releases rules.

- [ ] **Step 5: Point Reference docs and README at the new doc**

In CLAUDE.md's `## Reference docs`, replace

```markdown
- [`docs/eas-update.md`](docs/eas-update.md): store build vs OTA update,
  fingerprint verification, release branches, CI rules.
```

with

```markdown
- [`docs/release.md`](docs/release.md): releasing — OTA updates, store builds, the
  fingerprint, release branches, rollback.
```

In `README.md`, replace ``[`docs/eas-update.md`](docs/eas-update.md)`` with ``[`docs/release.md`](docs/release.md)``.

- [ ] **Step 6: Check for stale references**

Run: `git grep -n -e "eas-update.md" -e "release-1.1.0" -- CLAUDE.md README.md docs/release.md`
Expected: no output.

- [ ] **Step 7: Format and check**

Run: `npx prettier --write docs/release.md CLAUDE.md README.md && npm run check`
Expected: every step passes; the final `git diff --exit-code` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add docs/release.md CLAUDE.md README.md
git commit -m "docs: one front door for releasing — docs/release.md replaces docs/eas-update.md (#73)"
```

- [ ] **Step 9: PR to `main`** (confirm first)

```bash
git push -u origin ci/73-release-pipeline
gh pr create --base main --title "docs: release pipeline spec, plan and docs/release.md (#73)" \
  --body "Spec and plan for #73, and docs/release.md as the single release doc (replaces docs/eas-update.md). CLAUDE.md keeps only the release rules and a link."
```

The owner merges with **Rebase and merge**, so the docs commit stays a single commit on `main`.

---

### Task 3: Land `release/1.1.0` on `main`; carry the docs to `release/1.0.0`

Revised during execution: release branches are now cut from `main` (spec §4), so the open `release/1.1.0` merges into `main` and is deleted instead of taking syncs.

**Files:** `CLAUDE.md`, `docs/release.md`, the spec and this plan on `main`; `CLAUDE.md` and the Task 2 files on `release/1.0.0`.

- [ ] **Step 1: Merge `main` into a branch cut from `release/1.1.0`**

```bash
git fetch origin
git switch -c merge/1.1.0-into-main origin/release/1.1.0
git merge origin/main
```

Expected: no conflict. `main`'s `## Releases` section lands directly above the branch's paragraph that starts `⚠️ **On `release-1.1.0` today, the About privacy text is out of date.**`, and the branch's guardrail 4 wording and Telemetry rule stay.

- [ ] **Step 2: Reword that paragraph for `main`**

```markdown
⚠️ **On `main` today, the About privacy text is out of date.** It still says
"no advertising, analytics or tracking software" while TelemetryDeck (#53) is
in the code. `release/1.1.0` is cut from `main` only after #54 rewrites that
text and the web policy together and #55 updates the store declarations; then
#60 builds it.
```

- [ ] **Step 3: Describe the new flow, in two commits**

Commit 1, `docs/release.md` (the 1.1.0 row, where `fingerprint.config.js` lands, Branches and Flow) and `CLAUDE.md` (the paragraph above and rule 3); commit 2, the spec and this plan. Only commit 1 goes to `release/1.0.0`.

- [ ] **Step 4: Check and open the PR** (confirm first)

```bash
npm ci && npx prettier --write CLAUDE.md docs && npm run check
git push -u origin merge/1.1.0-into-main
gh pr create --base main --title "Land release/1.1.0 on main; cut release branches from main (#73)"
```

The owner merges with **Create a merge commit**.

- [ ] **Step 5: Delete `release/1.1.0`** (confirm first)

```bash
git fetch origin
git merge-base --is-ancestor origin/release/1.1.0 origin/main && git push origin --delete release/1.1.0
git branch -D release/1.1.0
```

- [ ] **Step 6: Cherry-pick the docs onto the locked `release/1.0.0`**

```bash
git switch -c docs/release-md-1.0.0 origin/release/1.0.0
git cherry-pick -x 5654c67f <commit 1 of Step 3, as merged>
```

Resolve `CLAUDE.md` to `main`'s text below the banner. If `docs/eas-update.md` reports modify/delete, resolve with `git rm docs/eas-update.md`.

- [ ] **Step 7: Shrink the `release/1.0.0` banner**

Replace the whole blockquote at the top of `CLAUDE.md` (from `> ⚠️ **You are on `release/1.0.0`` through `> `app/store/feature-graphic.tsx`— exist only on`main`.`) with the text below, where `<main-sha>` is the output of `git rev-parse --short origin/main`:

```markdown
> ⚠️ **You are on `release/1.0.0`, the locked OTA branch for the shipped 1.0.0
> binaries** (iOS build 3 = runtime `8b8b8840…`, Android build 3 = runtime
> `a616db89…`). Only changes that keep both fingerprints belong here; see
> "Branches" in `docs/release.md`.
>
> The rest of this file is `main`'s CLAUDE.md (as of `<main-sha>`). What it describes that
> came after the 1.0.0 build — TelemetryDeck and its privacy notes, `shots:play`,
> `gen:play-assets`, `design/play/`, `app/store/feature-graphic.tsx` — exists only on `main`.
```

- [ ] **Step 8: Prove both fingerprints are unchanged**

```bash
npm ci
for p in ios android; do npx expo-updates fingerprint:generate --platform $p | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).hash+"\n"))'; done
```

Expected, in order: `8b8b8840bd6e265b91976ef4690a9ef5cb632508` and `a616db8911b507fe2e4b9502b1d48e24a397a84b`. Stop if either differs.

- [ ] **Step 9: Check, commit, PR** (confirm first)

```bash
npx prettier --write CLAUDE.md && npm run check
git add CLAUDE.md && git commit -m "docs(claude-md): banner points at docs/release.md"
git push -u origin docs/release-md-1.0.0
gh pr create --base release/1.0.0 --title "docs: docs/release.md on release/1.0.0" --body "Cherry-picks of the docs commits from main (fingerprint-inert: iOS 8b8b8840 and Android a616db89 unchanged), plus a shorter banner."
```

The owner merges with **Rebase and merge**.

---

## Phase 2 — Accounts and settings (spec §14, step 2)

### Task 4: EAS tokens, GitHub settings and the `main` ruleset

**Files:** none. Every step changes account state: confirm each with the owner.

- [ ] **Step 1: 👤 Create two EAS robot users and their tokens**

At expo.dev, account `tovmassian27` → Settings → Robot users: create `escuadra-ci-preview` with role **Developer** and `escuadra-ci-production` with role **Admin**, and an access token for each. Check each in your terminal: `EXPO_TOKEN=<token> npx eas-cli whoami` prints the robot's name.

- [ ] **Step 2: Labels and environments**

```bash
gh label create "ota:ios" --color 0e8a16 --description "Publish this PR's OTA update to iOS"
gh label create "ota:android" --color 0e8a16 --description "Publish this PR's OTA update to Android"
gh label create "ota-freeze" --color b60205 --description "Blocks production OTA publishes for the platform@version in the title"
for p in ios android; do
  echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
    | gh api -X PUT "repos/tovmassian/escuadra/environments/production-$p" --input -
  gh api -X POST "repos/tovmassian/escuadra/environments/production-$p/deployment-branch-policies" \
    -f name='release/*' -f type=branch
done
gh api repos/tovmassian/escuadra/environments --jq '.environments[].name'
```

Expected last output includes `production-ios` and `production-android`.

- [ ] **Step 3: 👤 Store the tokens as GitHub secrets**

```bash
gh secret set EXPO_TOKEN_PREVIEW                            # paste the Developer robot's token
gh secret set EXPO_TOKEN_PRODUCTION --env production-ios    # paste the Admin robot's token
gh secret set EXPO_TOKEN_PRODUCTION --env production-android
```

- [ ] **Step 4: 👤 Confirm store submission credentials on EAS**

`npx eas-cli credentials --platform ios` → `production` → App Store Connect API Key must be set up; `npx eas-cli credentials --platform android` → `production` → Google Service Account Key must be set up. If either is missing, add it there (it stays on EAS, never in GitHub).

- [ ] **Step 5: Protect the production channel**

Run: `npx eas-cli channel:protect production --non-interactive` then `npx eas-cli channel:view production --non-interactive | grep Protection`
Expected: `Protection  Protected` (wording may differ; it must not say Unprotected).

- [ ] **Step 6: The `main` ruleset**

```bash
gh api -X POST repos/tovmassian/escuadra/rulesets --input - <<'EOF'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "check" }] } }
  ],
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }]
}
EOF
```

Expected: JSON with `"name": "main"` and `"enforcement": "active"`. (`actor_id` 5 is the admin role; `pull_request` mode allows merging a PR past a red check, never a direct push.)

---

## Phase 3 — Pipeline code on `main` (spec §14, step 3)

Work on a new branch from the updated `main`: `git switch -c ci/73-pipeline-code origin/main`.

### Task 5: Release model — `lib/release.ts`

**Files:**

- Create: `scripts/ci/fixtures/load.ts`, `scripts/ci/fixtures/builds.json`, `scripts/ci/lib/release.ts`
- Test: `scripts/ci/lib/release.test.ts`

**Interfaces:**

- Produces: `PLATFORMS`, `type Platform = 'ios' | 'android'`, `PLATFORM_NAMES: Record<Platform, string>`, `parseReleaseBranch(ref: string): string | null`, `nextPatch(version: string): string`, `short(hash: string | null | undefined): string`, `interface EasBuild`, `type LockState`, `buildRuntime(build: EasBuild): string | null`, `lockState(builds: EasBuild[], platform: Platform, version: string): LockState`, `type Verdict`, `verdictFor(platform: Platform, lock: LockState, fingerprint: string): Verdict`, `gateErrors(verdicts: Verdict[], version: string, bringsMainCommits: boolean): string[]`; `fixture<T>(name: string): T`.

- [ ] **Step 1: Add the fixture loader and the real build list**

`scripts/ci/fixtures/load.ts`:

```ts
// Test fixtures are real EAS output captured on 2026-09-23 and trimmed to the fields the
// pipeline reads — no artifact URLs in a public repo.
import { readFileSync } from 'node:fs';

export function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')) as T;
}
```

`scripts/ci/fixtures/builds.json`:

```json
[
  {
    "id": "d9f54943-647e-4145-b4d7-4e1e2eea3e76",
    "status": "FINISHED",
    "platform": "IOS",
    "buildProfile": "preview",
    "appVersion": "1.0.0",
    "appBuildVersion": "3",
    "runtime": { "version": "5c76669c2371687527b7f8e87928d531cab40f21" },
    "fingerprint": { "hash": "5c76669c2371687527b7f8e87928d531cab40f21" },
    "gitCommitHash": "1add0764b8d73d0df6a79864431f528bb33e371d",
    "createdAt": "2026-09-18T13:33:46.097Z"
  },
  {
    "id": "1973200b-2b3c-48f1-ad3e-4b14da20b838",
    "status": "FINISHED",
    "platform": "ANDROID",
    "buildProfile": "production",
    "appVersion": "1.0.0",
    "appBuildVersion": "3",
    "runtime": { "version": "a616db8911b507fe2e4b9502b1d48e24a397a84b" },
    "fingerprint": { "hash": "a616db8911b507fe2e4b9502b1d48e24a397a84b" },
    "gitCommitHash": "c5633fbcd25206a103cf0e5fd3a9ac9c820dc983",
    "createdAt": "2026-09-14T16:15:42.625Z"
  },
  {
    "id": "7e4e77fa-d745-4d65-8973-a737aa72b37f",
    "status": "FINISHED",
    "platform": "ANDROID",
    "buildProfile": "production",
    "appVersion": "1.0.0",
    "appBuildVersion": "2",
    "runtime": { "version": "a616db8911b507fe2e4b9502b1d48e24a397a84b" },
    "fingerprint": { "hash": "a616db8911b507fe2e4b9502b1d48e24a397a84b" },
    "gitCommitHash": "c5633fbcd25206a103cf0e5fd3a9ac9c820dc983",
    "createdAt": "2026-09-13T18:52:28.040Z"
  },
  {
    "id": "ef36adae-098e-4928-9565-c36e98ae7f3e",
    "status": "FINISHED",
    "platform": "IOS",
    "buildProfile": "production",
    "appVersion": "1.0.0",
    "appBuildVersion": "3",
    "runtime": { "version": "8b8b8840bd6e265b91976ef4690a9ef5cb632508" },
    "fingerprint": { "hash": "8b8b8840bd6e265b91976ef4690a9ef5cb632508" },
    "gitCommitHash": "4ee49b31e30b753abdcec977df2e38eeb2a4f8ac",
    "createdAt": "2026-09-11T16:47:34.947Z"
  },
  {
    "id": "33e09c02-b7c3-490e-9341-56f61b2bc6d6",
    "status": "FINISHED",
    "platform": "IOS",
    "buildProfile": "production",
    "appVersion": "1.0.0",
    "appBuildVersion": "2",
    "runtime": { "version": null },
    "fingerprint": { "hash": "1875cdeef966b6996d8caf83c0d67ab1cb6a258c" },
    "gitCommitHash": "52e5337467b392efcaa058820c56ba6566f200cd",
    "createdAt": "2026-09-11T10:49:11.962Z"
  },
  {
    "id": "2cb563d7-e2ae-407a-b8b9-2904a206e169",
    "status": "FINISHED",
    "platform": "IOS",
    "buildProfile": "development",
    "appVersion": "1.0.0",
    "appBuildVersion": "1",
    "runtime": { "version": null },
    "fingerprint": { "hash": "de2c101cd5e39e23f5248bfaea748dd2126590c4" },
    "gitCommitHash": "b2677cbacae1c9a48e3ff4015a7d70b7560ff8df",
    "createdAt": "2026-09-10T15:05:07.234Z"
  },
  {
    "id": "25f62187-512d-4187-9d00-d7d6d6632ddb",
    "status": "FINISHED",
    "platform": "IOS",
    "buildProfile": "ios-simulator",
    "appVersion": "1.0.0",
    "appBuildVersion": "1",
    "runtime": { "version": null },
    "fingerprint": { "hash": "de2c101cd5e39e23f5248bfaea748dd2126590c4" },
    "gitCommitHash": "6ce1ea41d45c7bf85b7bf3895c8ebc7a1844754d",
    "createdAt": "2026-09-10T14:33:42.946Z"
  }
]
```

- [ ] **Step 2: Write the failing tests** — `scripts/ci/lib/release.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import {
  gateErrors,
  lockState,
  nextPatch,
  parseReleaseBranch,
  verdictFor,
  type EasBuild,
} from './release.ts';

const builds = fixture<EasBuild[]>('builds.json');
const IOS_1_0_0 = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const ANDROID_1_0_0 = 'a616db8911b507fe2e4b9502b1d48e24a397a84b';

/** A production build of 1.1.0 that EAS has queued but not finished. */
function queued(runtime: string | null): EasBuild {
  return {
    id: 'queued-build',
    status: 'IN_QUEUE',
    platform: 'IOS',
    buildProfile: 'production',
    appVersion: '1.1.0',
    appBuildVersion: '4',
    runtime: { version: runtime },
    fingerprint: { hash: runtime },
    gitCommitHash: null,
    createdAt: '2026-10-01T09:00:00.000Z',
  };
}

describe('parseReleaseBranch', () => {
  it('reads X.Y.Z from release/X.Y.Z, with or without refs/heads/', () => {
    expect(parseReleaseBranch('release/1.0.0')).toBe('1.0.0');
    expect(parseReleaseBranch('refs/heads/release/1.10.2')).toBe('1.10.2');
  });

  it('rejects every other name, including the old integration branch', () => {
    const others = ['main', 'release-1.1.0', 'release/1.1', 'release/1.1.0-rc1', 'x/release/1.0.0'];
    for (const ref of others) expect(parseReleaseBranch(ref)).toBeNull();
  });
});

describe('nextPatch', () => {
  it('moves to the next patch version', () => {
    expect(nextPatch('1.0.9')).toBe('1.0.10');
  });
});

describe('lockState', () => {
  it('locks iOS 1.0.0 to build 3, the latest production build, not build 2', () => {
    const lock = lockState(builds, 'ios', '1.0.0');
    expect(lock).toMatchObject({ state: 'locked', runtime: IOS_1_0_0 });
    expect(lock.state === 'locked' ? lock.build.appBuildVersion : null).toBe('3');
  });

  it('locks Android 1.0.0 to a616db89', () => {
    expect(lockState(builds, 'android', '1.0.0')).toMatchObject({
      state: 'locked',
      runtime: ANDROID_1_0_0,
    });
  });

  it('never lets a preview build lock: the #53 build says 1.0.0 but came from the 1.1.0 branch', () => {
    const previewOnly = builds.filter((build) => build.buildProfile === 'preview');
    expect(lockState(previewOnly, 'ios', '1.0.0')).toEqual({ state: 'open' });
  });

  it('is open while no production build of the version exists', () => {
    expect(lockState(builds, 'ios', '1.1.0')).toEqual({ state: 'open' });
  });

  it('ignores errored and cancelled builds', () => {
    const failed = [
      { ...queued(IOS_1_0_0), status: 'ERRORED' },
      { ...queued(IOS_1_0_0), status: 'CANCELED' },
    ];
    expect(lockState(failed, 'ios', '1.1.0')).toEqual({ state: 'open' });
  });

  it('locks on a queued build, pending while EAS has no runtime for it', () => {
    expect(lockState([queued(null)], 'ios', '1.1.0')).toMatchObject({ state: 'pending' });
    expect(lockState([queued(IOS_1_0_0)], 'ios', '1.1.0')).toMatchObject({
      state: 'locked',
      runtime: IOS_1_0_0,
    });
  });
});

describe('verdictFor and gateErrors', () => {
  const lockedIos = lockState(builds, 'ios', '1.0.0');
  const lockedAndroid = lockState(builds, 'android', '1.0.0');

  it('passes a PR that keeps both 1.0.0 runtimes', () => {
    const verdicts = [
      verdictFor('ios', lockedIos, IOS_1_0_0),
      verdictFor('android', lockedAndroid, ANDROID_1_0_0),
    ];
    expect(verdicts.map((verdict) => verdict.kind)).toEqual(['match', 'match']);
    expect(gateErrors(verdicts, '1.0.0', false)).toEqual([]);
  });

  it('blocks a runtime change and names the version it belongs on', () => {
    const moved = 'c0a62aca64074feadd73c7042a3a9a8737a30405';
    const [error] = gateErrors([verdictFor('android', lockedAndroid, moved)], '1.0.0', false);
    expect(error).toContain('`a616db89` → `c0a62aca`');
    expect(error).toContain('`release/1.0.1` from `release/1.0.0`');
  });

  it('blocks while a production build is pending', () => {
    const pending = verdictFor('ios', lockState([queued(null)], 'ios', '1.1.0'), IOS_1_0_0);
    expect(gateErrors([pending], '1.1.0', false)).toHaveLength(1);
  });

  it('blocks commits from main only once a platform is locked', () => {
    const open = [verdictFor('ios', { state: 'open' }, IOS_1_0_0)];
    const locked = [verdictFor('ios', lockedIos, IOS_1_0_0)];
    expect(gateErrors(open, '1.1.0', true)).toEqual([]);
    expect(gateErrors(locked, '1.0.0', true)[0]).toContain('brings commits from `main`');
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run scripts/ci/lib/release.test.ts`
Expected: FAIL — `Failed to load url ./release.ts` (the module doesn't exist yet).

- [ ] **Step 4: Implement** — `scripts/ci/lib/release.ts`

```ts
// The release-branch model: which version a branch carries, and whether each
// platform on it is still open or already locked to a shipped runtime. See
// docs/release.md ("Branches") and §4 of
// docs/superpowers/specs/2026-09-23-release-pipeline-design.md.
//
// Pure, like lib/questionEngine.ts: the flows fetch builds and fingerprints, and
// every decision lives here, where Vitest pins it.

export const PLATFORMS = ['ios', 'android'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_NAMES: Record<Platform, string> = { ios: 'iOS', android: 'Android' };

const RELEASE_BRANCH = /^release\/(\d+)\.(\d+)\.(\d+)$/;

/** The version `release/X.Y.Z` carries; null for any other branch name. */
export function parseReleaseBranch(ref: string): string | null {
  const match = RELEASE_BRANCH.exec(ref.replace(/^refs\/heads\//, ''));
  return match ? match.slice(1, 4).join('.') : null;
}

/** Where a runtime change on `version` goes instead: X.Y.Z → X.Y.(Z+1). */
export function nextPatch(version: string): string {
  const [major, minor, patch] = version.split('.');
  return `${major}.${minor}.${Number(patch) + 1}`;
}

/** The first eight characters of a hash, as comments and docs show them. */
export function short(hash: string | null | undefined): string {
  return hash ? hash.slice(0, 8) : 'unknown';
}

/** A build as `eas build:list --json` and `eas build --json` report it: the fields read here. */
export interface EasBuild {
  id: string;
  status: string;
  platform: string;
  buildProfile: string;
  appVersion: string;
  appBuildVersion?: string | null;
  runtime?: { version?: string | null } | null;
  fingerprint?: { hash?: string | null } | null;
  gitCommitHash?: string | null;
  createdAt: string;
}

// Unfinished builds lock too: otherwise a PR could move the runtime while a build of
// this version waits in the Free queue. Errored and cancelled builds don't.
const LOCKING_STATUSES = new Set(['NEW', 'IN_QUEUE', 'IN_PROGRESS', 'FINISHED']);

export type LockState =
  | { state: 'open' }
  | { state: 'locked'; build: EasBuild; runtime: string }
  | { state: 'pending'; build: EasBuild };

/** The runtime a build targets. Older builds report only the fingerprint hash: the same value. */
export function buildRuntime(build: EasBuild): string | null {
  return build.runtime?.version ?? build.fingerprint?.hash ?? null;
}

/**
 * The lock on one platform of `release/<version>`: the latest production build of that
 * version decides. `pending` means the build exists but EAS hasn't reported its runtime
 * yet; callers treat it as "wait", never as "open".
 */
export function lockState(builds: EasBuild[], platform: Platform, version: string): LockState {
  const latest = builds
    .filter(
      (build) =>
        build.platform.toLowerCase() === platform &&
        build.buildProfile === 'production' &&
        build.appVersion === version &&
        LOCKING_STATUSES.has(build.status),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (!latest) return { state: 'open' };
  const runtime = buildRuntime(latest);
  return runtime
    ? { state: 'locked', build: latest, runtime }
    : { state: 'pending', build: latest };
}

export type Verdict =
  | { platform: Platform; fingerprint: string; kind: 'open' }
  | { platform: Platform; fingerprint: string; kind: 'pending'; build: EasBuild }
  | {
      platform: Platform;
      fingerprint: string;
      kind: 'match' | 'mismatch';
      build: EasBuild;
      runtime: string;
    };

export function verdictFor(platform: Platform, lock: LockState, fingerprint: string): Verdict {
  switch (lock.state) {
    case 'open':
      return { platform, fingerprint, kind: 'open' };
    case 'pending':
      return { platform, fingerprint, kind: 'pending', build: lock.build };
    case 'locked':
      return {
        platform,
        fingerprint,
        kind: lock.runtime === fingerprint ? 'match' : 'mismatch',
        build: lock.build,
        runtime: lock.runtime,
      };
  }
}

/**
 * Everything that must stop a merge, in words; empty means the gate passes.
 * `bringsMainCommits` counts only once a platform is locked or about to be: an open
 * branch takes syncs from `main` by design.
 */
export function gateErrors(
  verdicts: Verdict[],
  version: string,
  bringsMainCommits: boolean,
): string[] {
  const errors: string[] = [];
  for (const verdict of verdicts) {
    const name = PLATFORM_NAMES[verdict.platform];
    if (verdict.kind === 'mismatch') {
      errors.push(
        `${name}: this PR moves the runtime off build ${verdict.build.appBuildVersion} ` +
          `(\`${short(verdict.runtime)}\` → \`${short(verdict.fingerprint)}\`), so it isn't an ` +
          `OTA for ${version}. Put it on a new version: \`release/${nextPatch(version)}\` from ` +
          `\`release/${version}\`.`,
      );
    }
    if (verdict.kind === 'pending') {
      errors.push(
        `${name}: build ${verdict.build.appBuildVersion} of ${version} is still running. ` +
          'Re-run this check once it finishes.',
      );
    }
  }
  if (bringsMainCommits && verdicts.some((verdict) => verdict.kind !== 'open')) {
    errors.push(
      'This PR brings commits from `main` into a locked branch. Cut the branch from ' +
        `\`release/${version}\` and \`git cherry-pick -x\` the fix instead.`,
    );
  }
  return errors;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run scripts/ci/lib/release.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): release-branch model — version, lock state, gate verdicts (#73)"
```

---

### Task 6: PR inputs and freezes — `lib/pr.ts`, `lib/freeze.ts`

**Files:**

- Create: `scripts/ci/lib/pr.ts`, `scripts/ci/lib/freeze.ts`
- Test: `scripts/ci/lib/pr.test.ts`, `scripts/ci/lib/freeze.test.ts`

**Interfaces:**

- Consumes: `PLATFORMS`, `type Platform` from `./release.ts`.
- Produces: `OTA_LABELS`, `platformsFromLabels(labels: string[]): Platform[]`, `platformsFromInput(value: string): Platform[]`, `parsePlatform(value: string): Platform`, `isDocsOrCiOnly(files: string[]): boolean`, `isBundled(file: string): boolean`, `interface ChangedFile { filename: string; patch?: string | null }`, `interface Finding { file: string; line: string }`, `networkFindings(files: ChangedFile[]): Finding[]`, `dependencyChanges(before: string, after: string): string[]`; `FREEZE_LABEL`, `interface Issue { number: number; title: string; url: string }`, `freezeTitle(platform: Platform, version: string): string`, `findFreeze(issues: Issue[], platform: Platform, version: string): Issue | undefined`.

- [ ] **Step 1: Write the failing tests**

`scripts/ci/lib/pr.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  dependencyChanges,
  isDocsOrCiOnly,
  networkFindings,
  parsePlatform,
  platformsFromInput,
  platformsFromLabels,
} from './pr.ts';

describe('platforms', () => {
  it('reads ota:* labels in a fixed order and ignores the rest', () => {
    expect(platformsFromLabels(['bug', 'ota:android', 'ota:ios'])).toEqual(['ios', 'android']);
    expect(platformsFromLabels(['release'])).toEqual([]);
  });

  it('reads a manual run input and refuses anything else', () => {
    expect(platformsFromInput('both')).toEqual(['ios', 'android']);
    expect(platformsFromInput('android')).toEqual(['android']);
    expect(() => platformsFromInput('all')).toThrow();
    expect(parsePlatform('ios')).toBe('ios');
    expect(() => parsePlatform('web')).toThrow();
  });
});

describe('isDocsOrCiOnly', () => {
  it('is true for docs, markdown, workflows and scripts/ci', () => {
    const files = [
      'docs/release.md',
      'CLAUDE.md',
      '.github/workflows/check.yml',
      'scripts/ci/gate.ts',
    ];
    expect(isDocsOrCiOnly(files)).toBe(true);
  });

  it('is false as soon as one file reaches the app', () => {
    expect(isDocsOrCiOnly(['docs/release.md', 'app/about.tsx'])).toBe(false);
  });
});

describe('networkFindings', () => {
  it('flags added network-looking lines in bundled files only', () => {
    const findings = networkFindings([
      {
        filename: 'lib/telemetry.ts',
        patch: "@@ -1 +1,2 @@\n+await fetch('https://nom.telemetrydeck.com/v2/', init);\n context",
      },
      { filename: 'docs/release.md', patch: '+see https://expo.dev' },
      { filename: 'app/about.tsx', patch: "-const old = fetch('x');\n+const label = 'About';" },
      { filename: 'assets/flags/es.png', patch: null },
    ]);
    expect(findings).toEqual([
      { file: 'lib/telemetry.ts', line: "await fetch('https://nom.telemetrydeck.com/v2/', init);" },
    ]);
  });
});

describe('dependencyChanges', () => {
  it('lists added, removed and changed runtime dependencies only', () => {
    const before = JSON.stringify({ dependencies: { expo: '~57.0.22', zustand: '^5.0.0' } });
    const after = JSON.stringify({
      dependencies: { expo: '~57.0.22', zustand: '^5.1.0', '@telemetrydeck/sdk': '^2.0.4' },
      devDependencies: { vitest: '^5.0.0' },
    });
    expect(dependencyChanges(before, after)).toEqual([
      'added @telemetrydeck/sdk@^2.0.4',
      'zustand ^5.0.0 → ^5.1.0',
    ]);
  });
});
```

`scripts/ci/lib/freeze.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findFreeze, freezeTitle, type Issue } from './freeze.ts';

const url = 'https://github.com/tovmassian/escuadra/issues/';
const issues: Issue[] = [
  { number: 80, title: 'OTA freeze: android@1.0.0 (Play production review, #51)', url: `${url}80` },
  { number: 81, title: 'OTA freeze: ios@1.1.0', url: `${url}81` },
  { number: 82, title: 'Discuss an OTA freeze: ios@1.0.0 policy', url: `${url}82` },
];

describe('findFreeze', () => {
  it('matches exactly one platform and version, suffix allowed', () => {
    expect(findFreeze(issues, 'android', '1.0.0')?.number).toBe(80);
    expect(findFreeze(issues, 'ios', '1.1.0')?.number).toBe(81);
  });

  it('lets other versions and platforms through, and ignores lookalike titles', () => {
    expect(findFreeze(issues, 'ios', '1.0.0')).toBeUndefined();
    expect(findFreeze(issues, 'android', '1.1.0')).toBeUndefined();
    const longer: Issue = { number: 83, title: 'OTA freeze: ios@1.0.01', url: `${url}83` };
    expect(findFreeze([longer], 'ios', '1.0.0')).toBeUndefined();
  });

  it('matches the title it writes', () => {
    const own: Issue = { number: 84, title: freezeTitle('ios', '1.0.0'), url: `${url}84` };
    expect(findFreeze([own], 'ios', '1.0.0')?.number).toBe(84);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/ci/lib/pr.test.ts scripts/ci/lib/freeze.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`scripts/ci/lib/pr.ts`:

```ts
// What a PR asks for and what it touches: platforms from `ota:*` labels (or a manual
// run's input), whether it changes anything the app bundles, and the guardrail-4 hints
// the gate prints. Pure; the flows fetch labels, files and package.json.
import { PLATFORMS, type Platform } from './release.ts';

export const OTA_LABELS: Record<Platform, string> = { ios: 'ota:ios', android: 'ota:android' };

/** The platforms a PR's labels ask to publish to, in PLATFORMS order. */
export function platformsFromLabels(labels: string[]): Platform[] {
  return PLATFORMS.filter((platform) => labels.includes(OTA_LABELS[platform]));
}

export function parsePlatform(value: string): Platform {
  if (value === 'ios' || value === 'android') return value;
  throw new Error(`platform must be ios or android, got "${value}"`);
}

/** The `platforms` input of a manual run: `ios`, `android` or `both`. */
export function platformsFromInput(value: string): Platform[] {
  return value === 'both' ? [...PLATFORMS] : [parsePlatform(value)];
}

// Files that never reach the app bundle. A PR touching only docs and CI has nothing to
// preview; the network hints skip every unbundled file.
const DOCS_OR_CI = [/^docs\//, /\.md$/, /^\.github\//, /^scripts\/ci\//];
const NOT_BUNDLED = [/^docs\//, /\.md$/, /^\.github\//, /^scripts\//, /^tools\//, /\.test\.tsx?$/];

export function isDocsOrCiOnly(files: string[]): boolean {
  return files.every((file) => DOCS_OR_CI.some((pattern) => pattern.test(file)));
}

export function isBundled(file: string): boolean {
  return !NOT_BUNDLED.some((pattern) => pattern.test(file));
}

export interface ChangedFile {
  filename: string;
  patch?: string | null;
}

export interface Finding {
  file: string;
  line: string;
}

const NETWORK_HINTS = [/\bfetch\(/, /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/, /https?:\/\//];

/** Added lines in bundled files that look like they send something somewhere. */
export function networkFindings(files: ChangedFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    if (!file.patch || !isBundled(file.filename)) continue;
    for (const raw of file.patch.split('\n')) {
      if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
      const line = raw.slice(1).trim();
      if (NETWORK_HINTS.some((hint) => hint.test(line)))
        findings.push({ file: file.filename, line });
    }
  }
  return findings;
}

type Dependencies = Record<string, string>;

function dependenciesOf(packageJson: string): Dependencies {
  return (JSON.parse(packageJson) as { dependencies?: Dependencies }).dependencies ?? {};
}

/** How `dependencies` changed between two package.json texts, one line per package. */
export function dependencyChanges(before: string, after: string): string[] {
  const was = dependenciesOf(before);
  const now = dependenciesOf(after);
  const names = [...new Set([...Object.keys(was), ...Object.keys(now)])].sort();
  const changes: string[] = [];
  for (const name of names) {
    const from = was[name];
    const to = now[name];
    if (from === to) continue;
    if (from === undefined) changes.push(`added ${name}@${to}`);
    else if (to === undefined) changes.push(`removed ${name}@${from}`);
    else changes.push(`${name} ${from} → ${to}`);
  }
  return changes;
}
```

`scripts/ci/lib/freeze.ts`:

```ts
// Store-review freezes. An open issue labelled `ota-freeze` and titled
// `OTA freeze: <platform>@<version>` stops production publishes for exactly that
// platform and version: a reviewer's device runs the binary under review and picks up
// updates for its runtime. See docs/release.md ("Freeze during store review").
import type { Platform } from './release.ts';

export const FREEZE_LABEL = 'ota-freeze';

const FREEZE_TITLE = /^OTA freeze: (ios|android)@(\d+\.\d+\.\d+)(?:\s|$)/;

export interface Issue {
  number: number;
  title: string;
  url: string;
}

export function freezeTitle(platform: Platform, version: string): string {
  return `OTA freeze: ${platform}@${version}`;
}

/** The open freeze covering this platform and version, if any. */
export function findFreeze(
  issues: Issue[],
  platform: Platform,
  version: string,
): Issue | undefined {
  return issues.find((issue) => {
    const match = FREEZE_TITLE.exec(issue.title);
    return match !== null && match[1] === platform && match[2] === version;
  });
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run scripts/ci/lib/pr.test.ts scripts/ci/lib/freeze.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): PR labels, docs-only detection, guardrail-4 hints and freezes (#73)"
```

---

### Task 7: Update history, usage and outcomes — `lib/updates.ts`, `lib/usage.ts`, `lib/outcome.ts`

**Files:**

- Create: `scripts/ci/fixtures/updates-production.json`, `scripts/ci/lib/updates.ts`, `scripts/ci/lib/usage.ts`, `scripts/ci/lib/outcome.ts`
- Test: `scripts/ci/lib/updates.test.ts`, `scripts/ci/lib/usage.test.ts`

**Interfaces:**

- Consumes: `type Platform` from `./release.ts`.
- Produces: `interface UpdateGroupSummary { group; runtimeVersion; platforms; isRollBackToEmbedded; message }`, `interface UpdateInfo { id; group; platform; runtimeVersion; gitCommitHash?; isRollBackToEmbedded; message?; createdAt? }`, `type RollbackMode = 'previous' | 'group' | 'embedded'`, `type RollbackTarget`, `cleanMessage(message: string): string`, `rollbackTarget(groups, platform, runtime, mode, groupId: string | null): RollbackTarget`, `alreadyPublished(updates: UpdateInfo[], platform: Platform, sha: string): boolean`; `interface AccountUsage`, `usageReport(usage: AccountUsage): { line: string; warnings: string[] }`; `interface Outcome { status: 'done' | 'skipped' | 'failed'; summary: string }`, `done`, `skipped`, `failed`.

- [ ] **Step 1: Add the real `production` update history** — `scripts/ci/fixtures/updates-production.json`

```json
[
  {
    "group": "e43368a2-cfde-483d-a99d-fd1e9bc2691f",
    "runtimeVersion": "8b8b8840bd6e265b91976ef4690a9ef5cb632508",
    "platforms": "ios",
    "isRollBackToEmbedded": false,
    "message": "\"Correct privacy text (#61)\" (1 day ago by tovmassian27)"
  },
  {
    "group": "3f8c3721-9c5e-4850-b160-cfe33608dd7d",
    "runtimeVersion": "a616db8911b507fe2e4b9502b1d48e24a397a84b",
    "platforms": "android",
    "isRollBackToEmbedded": false,
    "message": "\"rollback(#44): restore #61 privacy text\" (5 days ago by tovmassian27)"
  },
  {
    "group": "37018bbe-bfd9-4741-9aec-670fe6496f3d",
    "runtimeVersion": "a616db8911b507fe2e4b9502b1d48e24a397a84b",
    "platforms": "android",
    "isRollBackToEmbedded": false,
    "message": "\"test(#44): OTA marker\" (5 days ago by tovmassian27)"
  },
  {
    "group": "0bf0c4b2-ab28-40fd-ae16-aa5401699a17",
    "runtimeVersion": "a616db8911b507fe2e4b9502b1d48e24a397a84b",
    "platforms": "android",
    "isRollBackToEmbedded": false,
    "message": "\"Correct privacy text (#61)\" (1 week ago by tovmassian27)"
  },
  {
    "group": "0e49e570-d666-4173-94b9-0e5d901ff7ee",
    "runtimeVersion": "c0a62aca64074feadd73c7042a3a9a8737a30405",
    "platforms": "android",
    "isRollBackToEmbedded": false,
    "message": "\"Correct privacy text (#61)\" (1 week ago by tovmassian27)"
  },
  {
    "group": "02f7fad4-83fc-41f3-8a14-04892984be7d",
    "runtimeVersion": "8b8b8840bd6e265b91976ef4690a9ef5cb632508",
    "platforms": "ios",
    "isRollBackToEmbedded": false,
    "message": "\"Republish \"fix tapping when search keyboard is open\" - group: 73b3cb5e-1671-4949-8b08-073e336f367a\" (1 week ago by tovmassian27)"
  },
  {
    "group": "832ed9d4-248c-4b86-9744-01058c93df34",
    "runtimeVersion": "a616db8911b507fe2e4b9502b1d48e24a397a84b",
    "platforms": "android",
    "isRollBackToEmbedded": false,
    "message": "\"testing OAT and rollback\" (1 week ago by tovmassian27)"
  },
  {
    "group": "189cc9a3-67fd-4830-9f70-e913a5a28930",
    "runtimeVersion": "8b8b8840bd6e265b91976ef4690a9ef5cb632508",
    "platforms": "ios",
    "isRollBackToEmbedded": false,
    "message": "\"testing OAT and rollback\" (1 week ago by tovmassian27)"
  },
  {
    "group": "73b3cb5e-1671-4949-8b08-073e336f367a",
    "runtimeVersion": "8b8b8840bd6e265b91976ef4690a9ef5cb632508",
    "platforms": "ios",
    "isRollBackToEmbedded": false,
    "message": "\"fix tapping when search keyboard is open\" (1 week ago by tovmassian27)"
  },
  {
    "group": "b894d9c2-ba6e-473b-ba4b-53c7496f2f19",
    "runtimeVersion": "a616db8911b507fe2e4b9502b1d48e24a397a84b",
    "platforms": "android",
    "isRollBackToEmbedded": false,
    "message": "\"fix tapping when search keyboard is open\" (1 week ago by tovmassian27)"
  }
]
```

- [ ] **Step 2: Write the failing tests**

`scripts/ci/lib/updates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import {
  alreadyPublished,
  cleanMessage,
  rollbackTarget,
  type UpdateGroupSummary,
  type UpdateInfo,
} from './updates.ts';

const history = fixture<UpdateGroupSummary[]>('updates-production.json');
const IOS = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const ANDROID = 'a616db8911b507fe2e4b9502b1d48e24a397a84b';

describe('cleanMessage', () => {
  it('strips update:list decoration, even around nested quotes', () => {
    expect(cleanMessage('"Correct privacy text (#61)" (1 day ago by tovmassian27)')).toBe(
      'Correct privacy text (#61)',
    );
    expect(
      cleanMessage('"Republish "fix tapping" - group: 73b3" (1 week ago by tovmassian27)'),
    ).toBe('Republish "fix tapping" - group: 73b3');
    expect(cleanMessage('plain')).toBe('plain');
  });
});

describe('rollbackTarget', () => {
  it('previous: takes iOS from #61 back to the republished keyboard fix', () => {
    expect(rollbackTarget(history, 'ios', IOS, 'previous', null)).toMatchObject({
      kind: 'republish',
      from: { group: 'e43368a2-cfde-483d-a99d-fd1e9bc2691f' },
      to: { group: '02f7fad4-83fc-41f3-8a14-04892984be7d' },
    });
  });

  it("previous on today's Android history lands on the #44 test marker: why dry_run exists", () => {
    const target = rollbackTarget(history, 'android', ANDROID, 'previous', null);
    expect(target.kind === 'republish' ? cleanMessage(target.to.message) : null).toBe(
      'test(#44): OTA marker',
    );
  });

  it('never picks an update published to another runtime', () => {
    const orphan = '0e49e570-d666-4173-94b9-0e5d901ff7ee';
    expect(rollbackTarget(history, 'android', ANDROID, 'group', orphan).kind).toBe('error');
  });

  it('group: republishes a named earlier group and refuses the newest', () => {
    const earlier = '0bf0c4b2-ab28-40fd-ae16-aa5401699a17';
    const newest = '3f8c3721-9c5e-4850-b160-cfe33608dd7d';
    expect(rollbackTarget(history, 'android', ANDROID, 'group', earlier)).toMatchObject({
      kind: 'republish',
      to: { group: earlier },
    });
    expect(rollbackTarget(history, 'android', ANDROID, 'group', newest).kind).toBe('error');
  });

  it('refuses to guess when nothing earlier exists', () => {
    const onlyOne = history.filter((g) => g.group === 'e43368a2-cfde-483d-a99d-fd1e9bc2691f');
    expect(rollbackTarget(onlyOne, 'ios', IOS, 'previous', null).kind).toBe('error');
    expect(rollbackTarget([], 'ios', IOS, 'previous', null).kind).toBe('error');
  });

  it('embedded: always possible, and says what it replaces', () => {
    expect(rollbackTarget(history, 'ios', IOS, 'embedded', null)).toMatchObject({
      kind: 'embedded',
      from: { group: 'e43368a2-cfde-483d-a99d-fd1e9bc2691f' },
    });
    expect(rollbackTarget([], 'ios', IOS, 'embedded', null)).toEqual({
      kind: 'embedded',
      from: null,
    });
  });
});

describe('alreadyPublished', () => {
  const commit = 'daf142b21e841e33c8575ba3241b8a4bcdbf982b';
  const newest: UpdateInfo[] = [
    {
      id: 'u',
      group: 'g',
      platform: 'ios',
      runtimeVersion: IOS,
      gitCommitHash: commit,
      isRollBackToEmbedded: false,
    },
  ];

  it('is true only for the same platform and commit', () => {
    expect(alreadyPublished(newest, 'ios', commit)).toBe(true);
    expect(alreadyPublished(newest, 'android', commit)).toBe(false);
    expect(alreadyPublished(newest, 'ios', 'c5633fbcd25206a103cf0e5fd3a9ac9c820dc983')).toBe(false);
  });
});
```

`scripts/ci/lib/usage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { usageReport } from './usage.ts';

const LIMIT = 107374182400;

describe('usageReport', () => {
  it('prints update users and bandwidth against the Free caps', () => {
    const usage = {
      updates: {
        uniqueUpdaters: { plan: { used: 44, limit: 1000 } },
        bandwidth: { plan: { usedBytes: 272507447, limitBytes: LIMIT } },
      },
    };
    expect(usageReport(usage)).toEqual({
      line: 'EAS usage: 44 / 1,000 update users · 0.3 / 100.0 GiB',
      warnings: [],
    });
  });

  it('warns from 80% of either cap', () => {
    const usage = {
      updates: {
        uniqueUpdaters: { plan: { used: 800, limit: 1000 } },
        bandwidth: { plan: { usedBytes: 0, limitBytes: LIMIT } },
      },
    };
    expect(usageReport(usage).warnings).toHaveLength(1);
  });

  it('says so when EAS reports another shape', () => {
    expect(usageReport({})).toEqual({ line: 'EAS usage: unavailable', warnings: [] });
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run scripts/ci/lib/updates.test.ts scripts/ci/lib/usage.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`scripts/ci/lib/updates.ts`:

```ts
// EAS Update history, as `eas update:list --json` and `update:view --json` report it,
// and the two choices made from it: what a rollback returns to, and whether a commit
// is already the newest production update. Pure.
import type { Platform } from './release.ts';

/** One group in `eas update:list --json` → `currentPage`, newest first. */
export interface UpdateGroupSummary {
  group: string;
  runtimeVersion: string;
  platforms: string;
  isRollBackToEmbedded: boolean;
  message: string;
}

/** One update in `eas update --json`, `update:view --json` or `update:roll-back-to-embedded --json`. */
export interface UpdateInfo {
  id: string;
  group: string;
  platform: string;
  runtimeVersion: string;
  gitCommitHash?: string | null;
  isRollBackToEmbedded: boolean;
  message?: string | null;
  createdAt?: string;
}

export type RollbackMode = 'previous' | 'group' | 'embedded';

export type RollbackTarget =
  | { kind: 'republish'; from: UpdateGroupSummary; to: UpdateGroupSummary }
  | { kind: 'embedded'; from: UpdateGroupSummary | null }
  | { kind: 'error'; message: string };

/** `update:list` shows `"message" (2 days ago by someone)`; keep the message. */
export function cleanMessage(message: string): string {
  const match = /^"(.*)" \([^()]*\)$/s.exec(message);
  return match?.[1] ?? message;
}

/**
 * What a rollback returns to. `groups` is `update:list` for one channel, newest first;
 * only this platform and runtime count. Refuses rather than guesses.
 */
export function rollbackTarget(
  groups: UpdateGroupSummary[],
  platform: Platform,
  runtime: string,
  mode: RollbackMode,
  groupId: string | null,
): RollbackTarget {
  const history = groups.filter(
    (group) =>
      group.runtimeVersion === runtime &&
      group.platforms
        .split(',')
        .map((name) => name.trim())
        .includes(platform),
  );
  const [newest, previous] = history;
  if (mode === 'embedded') return { kind: 'embedded', from: newest ?? null };
  if (!newest) {
    return {
      kind: 'error',
      message: `No ${platform} update on runtime ${runtime.slice(0, 8)}: nothing to roll back.`,
    };
  }
  if (mode === 'previous') {
    if (!previous)
      return { kind: 'error', message: 'No earlier update to return to. Use mode: embedded.' };
    return { kind: 'republish', from: newest, to: previous };
  }
  const chosen = history.find((group) => group.group === groupId);
  if (!chosen) {
    return {
      kind: 'error',
      message: `Group ${groupId ?? '(none)'} isn't a ${platform} update on runtime ${runtime.slice(0, 8)}.`,
    };
  }
  if (chosen === newest)
    return { kind: 'error', message: `Group ${chosen.group} is already the newest update.` };
  return { kind: 'republish', from: newest, to: chosen };
}

/** Whether the newest update group for a platform already came from `sha`. */
export function alreadyPublished(updates: UpdateInfo[], platform: Platform, sha: string): boolean {
  return updates.some(
    (update) =>
      update.platform === platform && update.gitCommitHash === sha && !update.isRollBackToEmbedded,
  );
}
```

`scripts/ci/lib/usage.ts`:

```ts
// Free-plan headroom from `eas account:usage --json`. The Free plan has no update
// overage: past 1,000 update users a month, updates stop being delivered — to
// production users too, so the publish job warns early.
export interface AccountUsage {
  updates?: {
    uniqueUpdaters?: { plan?: { used: number; limit: number } };
    bandwidth?: { plan?: { usedBytes: number; limitBytes: number } };
  };
}

const WARN_AT = 0.8;

const gib = (bytes: number): string => (bytes / 1024 ** 3).toFixed(1);

export function usageReport(usage: AccountUsage): { line: string; warnings: string[] } {
  const users = usage.updates?.uniqueUpdaters?.plan;
  const bandwidth = usage.updates?.bandwidth?.plan;
  if (!users || !bandwidth) return { line: 'EAS usage: unavailable', warnings: [] };
  const warnings: string[] = [];
  if (users.used >= users.limit * WARN_AT) {
    warnings.push(
      `Update users at ${users.used} of ${users.limit}: the Free plan stops delivering updates at the cap.`,
    );
  }
  if (bandwidth.usedBytes >= bandwidth.limitBytes * WARN_AT) {
    warnings.push(`Bandwidth at ${gib(bandwidth.usedBytes)} of ${gib(bandwidth.limitBytes)} GiB.`);
  }
  const count = (n: number): string => n.toLocaleString('en-US');
  return {
    line: `EAS usage: ${count(users.used)} / ${count(users.limit)} update users · ${gib(bandwidth.usedBytes)} / ${gib(bandwidth.limitBytes)} GiB`,
    warnings,
  };
}
```

`scripts/ci/lib/outcome.ts`:

```ts
// What a flow reports to its entry point. Only `failed` fails the job; the summary is
// Markdown for the job summary and PR comments.
export interface Outcome {
  status: 'done' | 'skipped' | 'failed';
  summary: string;
}

export const done = (summary: string): Outcome => ({ status: 'done', summary });
export const skipped = (summary: string): Outcome => ({ status: 'skipped', summary });
export const failed = (summary: string): Outcome => ({ status: 'failed', summary });
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run scripts/ci/lib/updates.test.ts scripts/ci/lib/usage.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): rollback targets, duplicate guard, Free-plan usage (#73)"
```

---

### Task 8: The gate's comment — `lib/render.ts`

**Files:**

- Create: `scripts/ci/lib/render.ts`
- Test: `scripts/ci/lib/render.test.ts`

**Interfaces:**

- Consumes: `PLATFORMS`, `PLATFORM_NAMES`, `short`, `type Platform`, `type Verdict` (release.ts); `type Issue` (freeze.ts); `type Finding` (pr.ts).
- Produces: `COMMENT_MARKER`, `interface GateView { baseRef; version; verdicts; errors; explanations: Partial<Record<Platform, string>>; labels: Platform[]; freezes: Issue[]; findings: Finding[]; dependencies: string[]; warnings: string[] }`, `renderGate(view: GateView): string`, `renderBadBranch(baseRef: string): string`, `withPreview(body: string, text: string): string`.

- [ ] **Step 1: Write the failing tests** — `scripts/ci/lib/render.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import { gateErrors, lockState, verdictFor, type EasBuild } from './release.ts';
import {
  COMMENT_MARKER,
  renderBadBranch,
  renderGate,
  withPreview,
  type GateView,
} from './render.ts';

const builds = fixture<EasBuild[]>('builds.json');

function view(overrides: Partial<GateView> = {}): GateView {
  const verdicts = [
    verdictFor(
      'ios',
      lockState(builds, 'ios', '1.0.0'),
      '8b8b8840bd6e265b91976ef4690a9ef5cb632508',
    ),
    verdictFor(
      'android',
      lockState(builds, 'android', '1.0.0'),
      'c0a62aca64074feadd73c7042a3a9a8737a30405',
    ),
  ];
  return {
    baseRef: 'release/1.0.0',
    version: '1.0.0',
    verdicts,
    errors: gateErrors(verdicts, '1.0.0', false),
    explanations: { android: '🔄 Fingerprint differs\n📁 modified file: .gitignore' },
    labels: ['ios'],
    freezes: [],
    findings: [],
    dependencies: [],
    warnings: [],
    ...overrides,
  };
}

describe('renderGate', () => {
  it('shows a row per platform with the shipped build and this PR', () => {
    const body = renderGate(view());
    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(body).toContain(
      '| iOS | locked | build 3 · `8b8b8840` | `8b8b8840` | ✅ OTA-compatible |',
    );
    expect(body).toContain(
      '| Android | locked | build 3 · `a616db89` | `c0a62aca` | ❌ runtime changed |',
    );
    expect(body).toContain('Why the Android runtime changed');
    expect(body).toContain('`release/1.0.1` from `release/1.0.0`');
    expect(body).toContain('**Labels:** ota:ios');
    expect(body).toContain('guardrail 4');
    expect(body).toContain("isn't on `main` yet goes there as a PR of `git cherry-pick -x`");
  });

  it('says nothing is published without labels, and lists guardrail-4 hints', () => {
    const body = renderGate(
      view({
        labels: [],
        findings: [{ file: 'lib/telemetry.ts', line: "fetch('https://x')" }],
        dependencies: ['added @telemetrydeck/sdk@^2.0.4'],
      }),
    );
    expect(body).toContain('none, so nothing is published');
    expect(body).toContain('- `lib/telemetry.ts`');
    expect(body).toContain('- dependency added @telemetrydeck/sdk@^2.0.4');
  });
});

describe('withPreview', () => {
  it('replaces only the preview line, repeatably', () => {
    const once = withPreview(renderGate(view()), 'iOS → group `1a2b3c4d`');
    const twice = withPreview(once, 'iOS → group `5e6f7a8b`');
    expect(twice).toContain('**Preview:** iOS → group `5e6f7a8b`');
    expect(twice).not.toContain('1a2b3c4d');
    expect(twice.split(COMMENT_MARKER)).toHaveLength(2);
  });
});

describe('renderBadBranch', () => {
  it('names the branch it refused', () => {
    expect(renderBadBranch('release-1.1.0')).toContain("`release-1.1.0` isn't a release branch");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/ci/lib/render.test.ts`
Expected: FAIL — `./render.ts` not found.

- [ ] **Step 3: Implement** — `scripts/ci/lib/render.ts`

````ts
// Markdown for the release-gate PR comment. Pure: every hash and number comes in
// through the view. A hidden marker lets each run edit the one comment in place, and
// the preview section is a slot the `preview` job fills in afterwards.
import type { Issue } from './freeze.ts';
import type { Finding } from './pr.ts';
import { PLATFORMS, PLATFORM_NAMES, short, type Platform, type Verdict } from './release.ts';

export const COMMENT_MARKER = '<!-- release-gate -->';
const PREVIEW_START = '<!-- preview -->';
const PREVIEW_END = '<!-- /preview -->';

export interface GateView {
  baseRef: string;
  version: string;
  verdicts: Verdict[];
  errors: string[];
  explanations: Partial<Record<Platform, string>>;
  labels: Platform[];
  freezes: Issue[];
  findings: Finding[];
  dependencies: string[];
  warnings: string[];
}

function row(verdict: Verdict, version: string): string {
  const name = PLATFORM_NAMES[verdict.platform];
  const pr = `\`${short(verdict.fingerprint)}\``;
  switch (verdict.kind) {
    case 'open':
      return `| ${name} | open | — | ${pr} | ✅ no ${version} build yet |`;
    case 'pending':
      return `| ${name} | building | build ${verdict.build.appBuildVersion} · runtime pending | ${pr} | ❌ wait for the build |`;
    case 'match':
      return `| ${name} | locked | build ${verdict.build.appBuildVersion} · \`${short(verdict.runtime)}\` | ${pr} | ✅ OTA-compatible |`;
    case 'mismatch':
      return `| ${name} | locked | build ${verdict.build.appBuildVersion} · \`${short(verdict.runtime)}\` | ${pr} | ❌ runtime changed |`;
  }
}

export function renderGate(view: GateView): string {
  const lines = [
    COMMENT_MARKER,
    `### release-gate · \`${view.baseRef}\` (${view.version})`,
    '',
    '| Platform | State | Shipped build | This PR | |',
    '| --- | --- | --- | --- | --- |',
    ...view.verdicts.map((verdict) => row(verdict, view.version)),
    '',
  ];
  for (const error of view.errors) lines.push(`❌ ${error}`, '');
  for (const platform of PLATFORMS) {
    const explanation = view.explanations[platform];
    if (!explanation) continue;
    lines.push(
      `<details><summary>Why the ${PLATFORM_NAMES[platform]} runtime changed</summary>`,
      '',
      '```',
      explanation,
      '```',
      '',
      '</details>',
      '',
    );
  }
  const labels = view.labels.map((platform) => `ota:${platform}`).join(', ');
  const freezes = view.freezes.map((issue) => `#${issue.number} (${issue.title})`).join(', ');
  const preview = view.labels.length ? 'after this check passes' : 'nothing to publish';
  lines.push(
    `**Labels:** ${labels || 'none, so nothing is published'} · **Freeze:** ${freezes || 'none'}`,
    '',
    `${PREVIEW_START}**Preview:** ${preview}${PREVIEW_END}`,
  );
  if (view.labels.length) {
    lines.push(
      '',
      "`ota:*` confirms this PR doesn't change what data leaves the device (guardrail 4).",
    );
  }
  lines.push(
    '',
    "Once merged, whatever here isn't on `main` yet goes there as a PR of `git cherry-pick -x` commits.",
  );
  if (view.findings.length || view.dependencies.length) {
    lines.push('', '**Check against guardrail 4** (informational):');
    for (const finding of view.findings)
      lines.push(`- \`${finding.file}\`: ${finding.line.slice(0, 120)}`);
    for (const change of view.dependencies) lines.push(`- dependency ${change}`);
  }
  for (const warning of view.warnings) lines.push('', `⚠️ ${warning}`);
  return lines.join('\n');
}

export function renderBadBranch(baseRef: string): string {
  return `${COMMENT_MARKER}\n❌ \`${baseRef}\` isn't a release branch: PRs into \`release/*\` must target \`release/X.Y.Z\`.`;
}

/** The gate's comment with its preview line replaced: how the preview job reports. */
export function withPreview(body: string, text: string): string {
  const line = `${PREVIEW_START}**Preview:** ${text}${PREVIEW_END}`;
  const start = body.indexOf(PREVIEW_START);
  const end = body.indexOf(PREVIEW_END);
  if (start < 0 || end < start) return `${body}\n\n${line}`;
  return body.slice(0, start) + line + body.slice(end + PREVIEW_END.length);
}
````

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run scripts/ci/lib/render.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): release-gate PR comment (#73)"
```

---

### Task 9: Running the CLIs — runner, fake runner, `eas`, `gh`, `git`

**Files:**

- Create: `scripts/ci/flows/runner.ts`, `scripts/ci/flows/fake-runner.ts`, `scripts/ci/flows/eas.ts`, `scripts/ci/flows/github.ts`, `scripts/ci/flows/git.ts`
- Test: `scripts/ci/flows/runner.test.ts`, `scripts/ci/flows/eas.test.ts`, `scripts/ci/flows/github.test.ts`, `scripts/ci/flows/git.test.ts`

**Interfaces:**

- Consumes: types from `lib/release.ts`, `lib/updates.ts`, `lib/usage.ts`, `lib/freeze.ts`, `lib/pr.ts`.
- Produces:
  - runner: `type Tool = 'eas' | 'gh' | 'git'`, `interface CommandResult { code; stdout; stderr }`, `interface Runner { run(tool: Tool, args: string[]): Promise<CommandResult> }`, `class CommandError`, `createRunner(cwd?: string): Runner`, `runOk(runner, tool, args): Promise<string>`, `runJson<T>(runner, tool, args): Promise<T>`.
  - fake: `interface Call { tool: Tool; args: string[] }`, `fakeRunner(respond: (call: Call) => CommandResult | undefined): Runner & { calls: Call[] }`, `ok(stdout?)`, `json(value)`, `fail(code?, stderr?)`, `ran(calls, tool, subcommand): boolean`, `indexOf(calls, tool, subcommand, detail?): number`.
  - eas: `type Channel = 'production' | 'preview'`, `computeFingerprint(runner, platform): Promise<string>`, `interface BuildQuery { platform; profile: Channel; appVersion?; fingerprint?; finishedOnly? }`, `listBuilds(runner, query): Promise<EasBuild[]>`, `explainMismatch(runner, buildId): Promise<string>`, `publishUpdate(runner, { channel, platform, message }): Promise<UpdateInfo[]>`, `listUpdateGroups(runner, branch: Channel, platform, runtime, limit): Promise<UpdateGroupSummary[]>`, `viewUpdateGroup(runner, group): Promise<UpdateInfo[]>`, `republishGroup(runner, group, platform, message): Promise<string>`, `rollBackToEmbedded(runner, channel, platform, runtime, message): Promise<string>`, `accountUsage(runner, account): Promise<AccountUsage>`, `startBuild(runner, platform, profile: Channel, submit: boolean): Promise<EasBuild[]>`.
  - github: `interface PullRequest { number; title; labels: string[]; baseRef; merged }`, `pullRequestsForCommit(runner, repo, sha)`, `pullRequestFiles(runner, repo, number): Promise<ChangedFile[]>`, `openFreezes(runner, repo): Promise<Issue[]>`, `createFreeze(runner, repo, platform, version, body): Promise<string>`, `interface Comment { id; body }`, `findComment(runner, repo, number, marker)`, `updateComment(runner, repo, id, body)`, `commentOnPr(runner, repo, number, body)`, `upsertComment(runner, repo, number, marker, body)`, `activeRuns(runner, repo, workflow, branch): Promise<number>`.
  - git: `bringsMainCommits(runner, baseRef): Promise<boolean>`, `basePackageJson(runner, baseRef): Promise<string>`.

- [ ] **Step 1: Write the failing tests**

`scripts/ci/flows/runner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fail, fakeRunner, json } from './fake-runner.ts';
import { CommandError, createRunner, runJson, runOk } from './runner.ts';

describe('runOk and runJson', () => {
  it('return stdout, parse JSON, and throw CommandError on a non-zero exit', async () => {
    const runner = fakeRunner(({ args }) =>
      args[0] === 'good' ? json({ hash: 'abc' }) : fail(2, 'boom'),
    );
    await expect(runJson(runner, 'eas', ['good'])).resolves.toEqual({ hash: 'abc' });
    await expect(runOk(runner, 'eas', ['bad'])).rejects.toBeInstanceOf(CommandError);
  });
});

describe('createRunner', () => {
  it('runs a real command and reports its exit code', async () => {
    const runner = createRunner();
    const version = await runner.run('git', ['--version']);
    expect(version.code).toBe(0);
    expect(version.stdout).toMatch(/^git version/);
    expect((await runner.run('git', ['definitely-not-a-command'])).code).not.toBe(0);
  });
});
```

`scripts/ci/flows/eas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { explainMismatch, listBuilds, listUpdateGroups, republishGroup } from './eas.ts';
import { fakeRunner, json } from './fake-runner.ts';

describe('eas wrappers', () => {
  it('asks build:list for one platform, profile and version', async () => {
    const runner = fakeRunner(() => json([]));
    await listBuilds(runner, { platform: 'ios', profile: 'production', appVersion: '1.0.0' });
    expect(runner.calls[0]?.args).toEqual([
      'build:list',
      '--platform',
      'ios',
      '--build-profile',
      'production',
      '--limit',
      '50',
      '--json',
      '--non-interactive',
      '--app-version',
      '1.0.0',
    ]);
  });

  it('reads currentPage from update:list and the new group from update:republish', async () => {
    const runner = fakeRunner(({ args }) =>
      args[0] === 'update:list'
        ? json({ name: 'production', currentPage: [{ group: 'g1' }] })
        : json([{ id: 'u', group: 'g2', platform: 'ios' }]),
    );
    expect(await listUpdateGroups(runner, 'production', 'ios', 'abc', 1)).toEqual([
      { group: 'g1' },
    ]);
    expect(await republishGroup(runner, 'g1', 'ios', 'Rollback: drill')).toBe('g2');
  });

  it('keeps fingerprint:compare output from its verdict line on', async () => {
    const runner = fakeRunner(() => ({
      code: 0,
      stdout:
        'Using environment: production\n🔄 Fingerprint a616db89 from ANDROID build differs\n📁 modified file: .gitignore',
      stderr: '- Computing project fingerprint\n',
    }));
    expect(await explainMismatch(runner, 'b1')).toBe(
      '🔄 Fingerprint a616db89 from ANDROID build differs\n📁 modified file: .gitignore',
    );
  });
});
```

`scripts/ci/flows/github.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fakeRunner, json, ok } from './fake-runner.ts';
import { activeRuns, pullRequestsForCommit, upsertComment } from './github.ts';

describe('upsertComment', () => {
  it('edits the marked comment when there is one, creates one otherwise', async () => {
    const comments = [
      JSON.stringify({ id: 7, body: 'other' }),
      JSON.stringify({ id: 9, body: '<!-- release-gate -->\nold' }),
    ].join('\n');
    const existing = fakeRunner(({ args }) => (args.includes('--jq') ? ok(comments) : ok('{}')));
    await upsertComment(existing, 'o/r', 12, '<!-- release-gate -->', 'new');
    expect(existing.calls[existing.calls.length - 1]?.args).toEqual([
      'api',
      '--method',
      'PATCH',
      'repos/o/r/issues/comments/9',
      '-f',
      'body=new',
    ]);

    const none = fakeRunner(({ args }) => (args.includes('--jq') ? ok('') : ok('{}')));
    await upsertComment(none, 'o/r', 12, '<!-- release-gate -->', 'new');
    expect(none.calls[none.calls.length - 1]?.args).toEqual([
      'api',
      '--method',
      'POST',
      'repos/o/r/issues/12/comments',
      '-f',
      'body=new',
    ]);
  });
});

describe('pullRequestsForCommit', () => {
  it('keeps number, title, labels, base and merged state', async () => {
    const runner = fakeRunner(() =>
      json([
        {
          number: 74,
          title: 'fix: About',
          labels: [{ name: 'ota:ios' }],
          merged_at: '2026-10-01T00:00:00Z',
          base: { ref: 'release/1.0.0' },
        },
      ]),
    );
    expect(await pullRequestsForCommit(runner, 'o/r', 'abc')).toEqual([
      {
        number: 74,
        title: 'fix: About',
        labels: ['ota:ios'],
        baseRef: 'release/1.0.0',
        merged: true,
      },
    ]);
  });
});

describe('activeRuns', () => {
  it('counts runs that have not completed', async () => {
    const runner = fakeRunner(() =>
      json([{ status: 'completed' }, { status: 'in_progress' }, { status: 'queued' }]),
    );
    expect(await activeRuns(runner, 'o/r', 'ota-production.yml', 'release/1.0.0')).toBe(2);
  });
});
```

`scripts/ci/flows/git.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fail, fakeRunner, ok } from './fake-runner.ts';
import { bringsMainCommits } from './git.ts';

/** Two merge bases with main; `onBase` says, in order, whether each is on the release branch. */
function history(onBase: boolean[]) {
  return fakeRunner(({ args }) => {
    if (args[1] === '--all') return ok('aaa\nbbb\n');
    if (args[1] === '--is-ancestor') return onBase.shift() ? ok() : fail(1, '');
    return undefined;
  });
}

describe('bringsMainCommits', () => {
  it('is false when every merge base with main is already on the release branch', async () => {
    expect(await bringsMainCommits(history([true, true]), 'release/1.0.0')).toBe(false);
  });

  it('is true when any merge base exists only on main', async () => {
    expect(await bringsMainCommits(history([true, false]), 'release/1.0.0')).toBe(true);
  });

  it('is false for unrelated histories', async () => {
    expect(
      await bringsMainCommits(
        fakeRunner(() => fail(1, '')),
        'release/1.0.0',
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/ci/flows`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the runner and its fake**

`scripts/ci/flows/runner.ts`:

```ts
// How flows run the `eas`, `gh` and `git` CLIs. Flows take a Runner, so tests pass a
// fake (fake-runner.ts) and assert what ran — and, as much, what never did.
import { execFile } from 'node:child_process';

export type Tool = 'eas' | 'gh' | 'git';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface Runner {
  run(tool: Tool, args: string[]): Promise<CommandResult>;
}

export class CommandError extends Error {
  readonly result: CommandResult;

  constructor(tool: Tool, args: string[], result: CommandResult) {
    // Only the subcommand: full arguments can hold whole comment bodies.
    super(
      `${tool} ${args[0] ?? ''} exited with ${result.code}: ${result.stderr.trim().slice(-2000)}`,
    );
    this.result = result;
  }
}

// EAS_CLI lets a local dry run use `npx --yes eas-cli@24.7.0` instead of a global `eas`.
function command(tool: Tool, args: string[]): [string, string[]] {
  const override = tool === 'eas' ? process.env.EAS_CLI : undefined;
  if (!override) return [tool, args];
  const [bin = 'eas', ...prefix] = override.split(' ').filter(Boolean);
  return [bin, [...prefix, ...args]];
}

export function createRunner(cwd: string = process.cwd()): Runner {
  return {
    run: (tool, args) =>
      new Promise((resolve) => {
        const [bin, fullArgs] = command(tool, args);
        execFile(bin, fullArgs, { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
          resolve({
            code,
            stdout: String(stdout),
            stderr: String(stderr) || (error?.message ?? ''),
          });
        });
      }),
  };
}

export async function runOk(runner: Runner, tool: Tool, args: string[]): Promise<string> {
  const result = await runner.run(tool, args);
  if (result.code !== 0) throw new CommandError(tool, args, result);
  return result.stdout;
}

export async function runJson<T>(runner: Runner, tool: Tool, args: string[]): Promise<T> {
  return JSON.parse(await runOk(runner, tool, args)) as T;
}
```

`scripts/ci/flows/fake-runner.ts`:

```ts
// Test double for Runner: answers from a responder and records every call. An
// unanswered call throws, so a flow that runs something unexpected fails its test.
import type { CommandResult, Runner, Tool } from './runner.ts';

export interface Call {
  tool: Tool;
  args: string[];
}

export function fakeRunner(
  respond: (call: Call) => CommandResult | undefined,
): Runner & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async run(tool, args) {
      const call = { tool, args };
      calls.push(call);
      const reply = respond(call);
      if (!reply) throw new Error(`unexpected call: ${tool} ${args.join(' ')}`);
      return reply;
    },
  };
}

export const ok = (stdout = ''): CommandResult => ({ code: 0, stdout, stderr: '' });
export const json = (value: unknown): CommandResult => ok(JSON.stringify(value));
export const fail = (code = 1, stderr = 'failed'): CommandResult => ({ code, stdout: '', stderr });

/** Whether `<tool> <subcommand>` ran; `eas update` does not match `eas update:list`. */
export function ran(calls: Call[], tool: Tool, subcommand: string): boolean {
  return calls.some((call) => call.tool === tool && call.args[0] === subcommand);
}

/** Position of the first matching call, -1 if none: for ordering assertions. */
export function indexOf(calls: Call[], tool: Tool, subcommand: string, detail?: string): number {
  return calls.findIndex(
    (call) =>
      call.tool === tool &&
      call.args[0] === subcommand &&
      (detail === undefined || call.args.includes(detail)),
  );
}
```

- [ ] **Step 4: Implement the typed calls**

`scripts/ci/flows/eas.ts`:

```ts
// The `eas` calls the flows make, typed. JSON commands run with --json and
// --non-interactive: eas-cli then writes progress to stderr and only JSON to stdout.
import type { EasBuild, Platform } from '../lib/release.ts';
import type { UpdateGroupSummary, UpdateInfo } from '../lib/updates.ts';
import type { AccountUsage } from '../lib/usage.ts';
import { runJson, type Runner } from './runner.ts';

/** Build profiles and channels share these names (eas.json). */
export type Channel = 'production' | 'preview';

/** The fingerprint `eas update` would publish to from this checkout. */
export async function computeFingerprint(runner: Runner, platform: Platform): Promise<string> {
  const result = await runJson<{ hash: string }>(runner, 'eas', [
    'fingerprint:generate',
    '--platform',
    platform,
    '--environment',
    'production',
    '--json',
    '--non-interactive',
  ]);
  return result.hash;
}

export interface BuildQuery {
  platform: Platform;
  profile: Channel;
  appVersion?: string;
  fingerprint?: string;
  finishedOnly?: boolean;
}

export function listBuilds(runner: Runner, query: BuildQuery): Promise<EasBuild[]> {
  const args = [
    'build:list',
    '--platform',
    query.platform,
    '--build-profile',
    query.profile,
    '--limit',
    '50',
    '--json',
    '--non-interactive',
  ];
  if (query.appVersion) args.push('--app-version', query.appVersion);
  if (query.fingerprint) args.push('--fingerprint-hash', query.fingerprint);
  if (query.finishedOnly) args.push('--status', 'finished');
  return runJson<EasBuild[]>(runner, 'eas', args);
}

/** fingerprint:compare's own explanation of why this checkout differs from a build. */
export async function explainMismatch(runner: Runner, buildId: string): Promise<string> {
  const result = await runner.run('eas', [
    'fingerprint:compare',
    '--build-id',
    buildId,
    '--environment',
    'production',
    '--non-interactive',
  ]);
  const text = result.stdout.includes('Fingerprint')
    ? result.stdout
    : `${result.stdout}\n${result.stderr}`;
  const lines = text.split('\n');
  const from = lines.findIndex((line) => /differs|matches/.test(line));
  return lines.slice(Math.max(from, 0)).join('\n').trim().slice(0, 4000);
}

export function publishUpdate(
  runner: Runner,
  update: { channel: Channel; platform: Platform; message: string },
): Promise<UpdateInfo[]> {
  return runJson<UpdateInfo[]>(runner, 'eas', [
    'update',
    '--channel',
    update.channel,
    '--platform',
    update.platform,
    '--environment',
    update.channel,
    '--message',
    update.message,
    '--non-interactive',
    '--json',
  ]);
}

/** Update groups on a branch for one platform and runtime, newest first. */
export async function listUpdateGroups(
  runner: Runner,
  branch: Channel,
  platform: Platform,
  runtime: string,
  limit: number,
): Promise<UpdateGroupSummary[]> {
  const page = await runJson<{ currentPage?: UpdateGroupSummary[] }>(runner, 'eas', [
    'update:list',
    '--branch',
    branch,
    '--platform',
    platform,
    '--runtime-version',
    runtime,
    '--limit',
    String(limit),
    '--json',
    '--non-interactive',
  ]);
  return page.currentPage ?? [];
}

export function viewUpdateGroup(runner: Runner, group: string): Promise<UpdateInfo[]> {
  return runJson<UpdateInfo[]>(runner, 'eas', ['update:view', group, '--json']);
}

/** Republishes a group to its own branch and returns the new group's ID. */
export async function republishGroup(
  runner: Runner,
  group: string,
  platform: Platform,
  message: string,
): Promise<string> {
  const updates = await runJson<{ group?: string }[]>(runner, 'eas', [
    'update:republish',
    '--group',
    group,
    '--platform',
    platform,
    '--message',
    message,
    '--non-interactive',
    '--json',
  ]);
  const newGroup = updates.find((update) => typeof update.group === 'string')?.group;
  if (!newGroup) throw new Error('update:republish reported no new group');
  return newGroup;
}

/** Points a runtime back at the JS embedded in its build; returns the directive's group ID. */
export async function rollBackToEmbedded(
  runner: Runner,
  channel: Channel,
  platform: Platform,
  runtime: string,
  message: string,
): Promise<string> {
  const updates = await runJson<UpdateInfo[]>(runner, 'eas', [
    'update:roll-back-to-embedded',
    '--channel',
    channel,
    '--platform',
    platform,
    '--runtime-version',
    runtime,
    '--message',
    message,
    '--non-interactive',
    '--json',
  ]);
  const group = updates[0]?.group;
  if (!group) throw new Error('update:roll-back-to-embedded reported no group');
  return group;
}

export function accountUsage(runner: Runner, account: string): Promise<AccountUsage> {
  return runJson<AccountUsage>(runner, 'eas', [
    'account:usage',
    account,
    '--json',
    '--non-interactive',
  ]);
}

/** Builds (and with `submit`, uploads to the store) and waits for the result. */
export function startBuild(
  runner: Runner,
  platform: Platform,
  profile: Channel,
  submit: boolean,
): Promise<EasBuild[]> {
  const args = [
    'build',
    '--platform',
    platform,
    '--profile',
    profile,
    '--non-interactive',
    '--json',
  ];
  if (submit) args.push('--auto-submit');
  return runJson<EasBuild[]>(runner, 'eas', args);
}
```

`scripts/ci/flows/github.ts`:

```ts
// The `gh` calls the flows make: PR data, freeze issues, the gate's comment and
// workflow runs. GH_TOKEN comes from the workflow.
import { FREEZE_LABEL, freezeTitle, type Issue } from '../lib/freeze.ts';
import type { ChangedFile } from '../lib/pr.ts';
import type { Platform } from '../lib/release.ts';
import { runJson, runOk, type Runner } from './runner.ts';

export interface PullRequest {
  number: number;
  title: string;
  labels: string[];
  baseRef: string;
  merged: boolean;
}

interface ApiPullRequest {
  number: number;
  title: string;
  labels: { name: string }[];
  merged_at: string | null;
  base: { ref: string };
}

/** NDJSON from `gh api --paginate --jq '.[] | …'`: one object per line. */
function objects<T>(output: string): T[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function pullRequestsForCommit(
  runner: Runner,
  repo: string,
  sha: string,
): Promise<PullRequest[]> {
  const prs = await runJson<ApiPullRequest[]>(runner, 'gh', [
    'api',
    `repos/${repo}/commits/${sha}/pulls`,
  ]);
  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    labels: pr.labels.map((label) => label.name),
    baseRef: pr.base.ref,
    merged: pr.merged_at !== null,
  }));
}

export async function pullRequestFiles(
  runner: Runner,
  repo: string,
  number: number,
): Promise<ChangedFile[]> {
  return objects<ChangedFile>(
    await runOk(runner, 'gh', [
      'api',
      '--paginate',
      `repos/${repo}/pulls/${number}/files`,
      '--jq',
      '.[] | {filename, patch}',
    ]),
  );
}

export function openFreezes(runner: Runner, repo: string): Promise<Issue[]> {
  return runJson<Issue[]>(runner, 'gh', [
    'issue',
    'list',
    '--repo',
    repo,
    '--label',
    FREEZE_LABEL,
    '--state',
    'open',
    '--json',
    'number,title,url',
    '--limit',
    '100',
  ]);
}

/** Opens `OTA freeze: <platform>@<version>` and returns its URL. */
export async function createFreeze(
  runner: Runner,
  repo: string,
  platform: Platform,
  version: string,
  body: string,
): Promise<string> {
  const url = await runOk(runner, 'gh', [
    'issue',
    'create',
    '--repo',
    repo,
    '--title',
    freezeTitle(platform, version),
    '--label',
    FREEZE_LABEL,
    '--body',
    body,
  ]);
  return url.trim();
}

export interface Comment {
  id: number;
  body: string;
}

export async function findComment(
  runner: Runner,
  repo: string,
  number: number,
  marker: string,
): Promise<Comment | undefined> {
  const comments = objects<Comment>(
    await runOk(runner, 'gh', [
      'api',
      '--paginate',
      `repos/${repo}/issues/${number}/comments`,
      '--jq',
      '.[] | {id, body}',
    ]),
  );
  return comments.find((comment) => comment.body.includes(marker));
}

export async function updateComment(
  runner: Runner,
  repo: string,
  id: number,
  body: string,
): Promise<void> {
  await runOk(runner, 'gh', [
    'api',
    '--method',
    'PATCH',
    `repos/${repo}/issues/comments/${id}`,
    '-f',
    `body=${body}`,
  ]);
}

export async function commentOnPr(
  runner: Runner,
  repo: string,
  number: number,
  body: string,
): Promise<void> {
  await runOk(runner, 'gh', [
    'api',
    '--method',
    'POST',
    `repos/${repo}/issues/${number}/comments`,
    '-f',
    `body=${body}`,
  ]);
}

/** The gate's comment: edited in place when it exists, created otherwise. */
export async function upsertComment(
  runner: Runner,
  repo: string,
  number: number,
  marker: string,
  body: string,
): Promise<void> {
  const existing = await findComment(runner, repo, number, marker);
  if (existing) await updateComment(runner, repo, existing.id, body);
  else await commentOnPr(runner, repo, number, body);
}

/** Runs of `workflow` on `branch` that haven't completed: queued, waiting or in progress. */
export async function activeRuns(
  runner: Runner,
  repo: string,
  workflow: string,
  branch: string,
): Promise<number> {
  const runs = await runJson<{ status: string }[]>(runner, 'gh', [
    'run',
    'list',
    '--repo',
    repo,
    '--workflow',
    workflow,
    '--branch',
    branch,
    '--json',
    'status',
    '--limit',
    '50',
  ]);
  return runs.filter((run) => run.status !== 'completed').length;
}
```

`scripts/ci/flows/git.ts`:

```ts
// The two git questions the gate asks of the checked-out PR merge commit. Needs full
// history: the workflow checks out with fetch-depth 0.
import { runOk, type Runner } from './runner.ts';

/**
 * Whether HEAD carries commits from origin/main that the base branch doesn't have:
 * true when any merge base of HEAD and main isn't already on the base branch. Catches
 * both a merge of `main` and a branch cut from `main` by mistake.
 */
export async function bringsMainCommits(runner: Runner, baseRef: string): Promise<boolean> {
  const bases = await runner.run('git', ['merge-base', '--all', 'HEAD', 'origin/main']);
  if (bases.code !== 0) return false;
  for (const commit of bases.stdout.split('\n').filter(Boolean)) {
    const onBase = await runner.run('git', [
      'merge-base',
      '--is-ancestor',
      commit,
      `origin/${baseRef}`,
    ]);
    if (onBase.code !== 0) return true;
  }
  return false;
}

export function basePackageJson(runner: Runner, baseRef: string): Promise<string> {
  return runOk(runner, 'git', ['show', `origin/${baseRef}:package.json`]);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run scripts/ci/flows`
Expected: PASS, 11 tests.

- [ ] **Step 6: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): runner and typed eas, gh and git calls (#73)"
```

---

### Task 10: The gate and preview flows

**Files:**

- Create: `scripts/ci/flows/gate.ts`, `scripts/ci/flows/preview.ts`
- Test: `scripts/ci/flows/gate.test.ts`, `scripts/ci/flows/preview.test.ts`

**Interfaces:**

- Consumes: everything from Tasks 5–9.
- Produces: `interface GateContext { repo; baseRef; prNumber: number | null; labels: string[]; appJsonVersion; packageJson }`, `interface GateReport { passed; body; publishable: Platform[]; fingerprints: Partial<Record<Platform, string>> }`, `runGate(runner, ctx): Promise<GateReport>`; `interface PreviewContext { repo; prNumber; prTitle; headSha; platforms: Platform[]; fingerprints: Partial<Record<Platform, string>> }`, `runPreview(runner, ctx): Promise<Outcome>`.

- [ ] **Step 1: Write the failing tests**

`scripts/ci/flows/gate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import type { EasBuild, Platform } from '../lib/release.ts';
import { fail, fakeRunner, indexOf, json, ok, ran } from './fake-runner.ts';
import { runGate, type GateContext } from './gate.ts';

const builds = fixture<EasBuild[]>('builds.json');
const SHIPPED: Record<Platform, string> = {
  ios: '8b8b8840bd6e265b91976ef4690a9ef5cb632508',
  android: 'a616db8911b507fe2e4b9502b1d48e24a397a84b',
};
const PACKAGE_JSON = JSON.stringify({ dependencies: { expo: '~57.0.22' } });

const ctx: GateContext = {
  repo: 'tovmassian/escuadra',
  baseRef: 'release/1.0.0',
  prNumber: 74,
  labels: ['ota:ios', 'ota:android'],
  appJsonVersion: '1.0.0',
  packageJson: PACKAGE_JSON,
};

function world(
  options: { fingerprints?: Partial<Record<Platform, string>>; mainOnBase?: boolean } = {},
) {
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    const path = args.find((arg) => arg.startsWith('repos/')) ?? '';
    if (tool === 'eas' && sub === 'fingerprint:generate') {
      const platform = args[2] as Platform;
      return json({ hash: options.fingerprints?.[platform] ?? SHIPPED[platform] });
    }
    if (tool === 'eas' && sub === 'build:list') return json(builds);
    if (tool === 'eas' && sub === 'fingerprint:compare') {
      return ok(
        '🔄 Fingerprint a616db89 from ANDROID build differs\n📝 Modified content: package.json scripts',
      );
    }
    if (tool === 'git' && args[1] === '--all')
      return ok('c5633fbcd25206a103cf0e5fd3a9ac9c820dc983\n');
    if (tool === 'git' && args[1] === '--is-ancestor')
      return options.mainOnBase === false ? fail(1, '') : ok();
    if (tool === 'git' && sub === 'show') return ok(PACKAGE_JSON);
    if (tool === 'gh' && sub === 'issue') return json([]);
    if (tool === 'gh' && path.endsWith('/files'))
      return ok(JSON.stringify({ filename: 'app/about.tsx', patch: '+const x = 1;' }));
    if (tool === 'gh' && path.endsWith('/comments') && args.includes('--jq')) return ok('');
    if (tool === 'gh' && sub === 'api') return ok('{}');
    return undefined;
  });
}

describe('runGate', () => {
  it('passes a cherry-pick PR that keeps both 1.0.0 runtimes, and comments', async () => {
    const runner = world();
    const report = await runGate(runner, ctx);
    expect(report.passed).toBe(true);
    expect(report.publishable).toEqual(['ios', 'android']);
    expect(report.fingerprints).toEqual(SHIPPED);
    expect(report.body).toContain('✅ OTA-compatible');
    expect(indexOf(runner.calls, 'gh', 'api', 'POST')).toBeGreaterThan(-1);
    expect(ran(runner.calls, 'eas', 'fingerprint:compare')).toBe(false);
  });

  it('fails a PR that moves the Android runtime, and says why', async () => {
    const moved = 'c0a62aca64074feadd73c7042a3a9a8737a30405';
    const report = await runGate(world({ fingerprints: { android: moved } }), ctx);
    expect(report.passed).toBe(false);
    expect(report.publishable).toEqual([]);
    expect(report.body).toContain('❌ runtime changed');
    expect(report.body).toContain('package.json scripts');
  });

  it('fails main history on a locked branch and accepts it on an open one', async () => {
    expect((await runGate(world({ mainOnBase: false }), ctx)).passed).toBe(false);
    const open = await runGate(world({ mainOnBase: false }), {
      ...ctx,
      baseRef: 'release/1.1.0',
      appJsonVersion: '1.1.0',
    });
    expect(open.passed).toBe(true);
    expect(open.body).toContain('no 1.1.0 build yet');
  });

  it("refuses a base that isn't release/X.Y.Z without asking EAS anything", async () => {
    const runner = world();
    const report = await runGate(runner, { ...ctx, baseRef: 'release-1.1.0' });
    expect(report.passed).toBe(false);
    expect(runner.calls.some((call) => call.tool === 'eas')).toBe(false);
  });

  it('dry run: reads no PR and comments nowhere', async () => {
    const runner = world();
    const report = await runGate(runner, { ...ctx, prNumber: null, labels: [] });
    expect(report.passed).toBe(true);
    expect(runner.calls.some((call) => call.tool === 'gh')).toBe(false);
  });

  it('warns when app.json disagrees with the branch', async () => {
    const report = await runGate(world(), { ...ctx, baseRef: 'release/1.1.0' });
    expect(report.body).toContain('`app.json` says 1.0.0 but the branch is 1.1.0');
  });
});
```

`scripts/ci/flows/preview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { EasBuild } from '../lib/release.ts';
import { COMMENT_MARKER } from '../lib/render.ts';
import { fakeRunner, json, ok, ran } from './fake-runner.ts';
import { runPreview, type PreviewContext } from './preview.ts';

const IOS = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const ANDROID = 'a616db8911b507fe2e4b9502b1d48e24a397a84b';
const PREVIEW_IOS: EasBuild = {
  id: 'p1',
  status: 'FINISHED',
  platform: 'IOS',
  buildProfile: 'preview',
  appVersion: '1.0.0',
  appBuildVersion: '4',
  runtime: { version: IOS },
  fingerprint: { hash: IOS },
  gitCommitHash: 'c5633fbcd25206a103cf0e5fd3a9ac9c820dc983',
  createdAt: '2026-09-30T10:00:00.000Z',
};
const GATE_BODY = `${COMMENT_MARKER}\n**Labels:** ota:ios\n\n<!-- preview -->**Preview:** after this check passes<!-- /preview -->`;

const ctx: PreviewContext = {
  repo: 'tovmassian/escuadra',
  prNumber: 74,
  prTitle: 'fix: show the update ID on About',
  headSha: '1111111111111111111111111111111111111111',
  platforms: ['ios', 'android'],
  fingerprints: { ios: IOS, android: ANDROID },
};

function world(options: { files?: string[]; publishedRuntime?: string } = {}) {
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    const path = args.find((arg) => arg.startsWith('repos/')) ?? '';
    if (tool === 'gh' && path.endsWith('/files')) {
      return ok(
        (options.files ?? ['app/about.tsx'])
          .map((filename) => JSON.stringify({ filename, patch: null }))
          .join('\n'),
      );
    }
    if (tool === 'eas' && sub === 'build:list') {
      return json(args.includes('ios') ? [PREVIEW_IOS] : []);
    }
    if (tool === 'eas' && sub === 'update') {
      return json([
        {
          id: 'u',
          group: '1a2b3c4d-0000-0000-0000-000000000000',
          platform: 'ios',
          runtimeVersion: options.publishedRuntime ?? IOS,
          isRollBackToEmbedded: false,
        },
      ]);
    }
    if (tool === 'gh' && path.endsWith('/comments'))
      return ok(JSON.stringify({ id: 9, body: GATE_BODY }));
    if (tool === 'gh' && sub === 'api') return ok('{}');
    return undefined;
  });
}

describe('runPreview', () => {
  it('publishes iOS, skips Android without a preview build, and fills the comment', async () => {
    const runner = world();
    const outcome = await runPreview(runner, ctx);
    expect(outcome.status).toBe('done');
    expect(outcome.summary).toContain('iOS → group `1a2b3c4d`');
    expect(outcome.summary).toContain('Android: skipped, no preview build on runtime `a616db89`');
    const patch = runner.calls.find((call) => call.args.includes('PATCH'));
    expect(patch?.args.find((arg) => arg.startsWith('body='))).toContain('iOS → group `1a2b3c4d`');
  });

  it('publishes nothing for a docs-only PR', async () => {
    const runner = world({ files: ['docs/release.md'] });
    expect((await runPreview(runner, ctx)).status).toBe('skipped');
    expect(ran(runner.calls, 'eas', 'update')).toBe(false);
  });

  it('fails when the published runtime differs from the gate fingerprint', async () => {
    const outcome = await runPreview(
      world({ publishedRuntime: 'ffffffffffffffffffffffffffffffffffffffff' }),
      ctx,
    );
    expect(outcome.status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/ci/flows/gate.test.ts scripts/ci/flows/preview.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`scripts/ci/flows/gate.ts`:

```ts
// The `release-gate` check: a verdict per platform for a PR into release/X.Y.Z. It
// blocks on a runtime change, a build in flight, or `main` history reaching a locked
// branch; everything else it reports is informational. §6 of the design.
import { findFreeze } from '../lib/freeze.ts';
import { dependencyChanges, networkFindings, platformsFromLabels } from '../lib/pr.ts';
import {
  PLATFORMS,
  gateErrors,
  lockState,
  parseReleaseBranch,
  verdictFor,
  type Platform,
  type Verdict,
} from '../lib/release.ts';
import { COMMENT_MARKER, renderBadBranch, renderGate } from '../lib/render.ts';
import { computeFingerprint, explainMismatch, listBuilds } from './eas.ts';
import { basePackageJson, bringsMainCommits } from './git.ts';
import { openFreezes, pullRequestFiles, upsertComment } from './github.ts';
import type { Runner } from './runner.ts';

export interface GateContext {
  repo: string;
  baseRef: string;
  /** Null in a local dry run: no PR to read files from or comment on. */
  prNumber: number | null;
  labels: string[];
  appJsonVersion: string;
  /** package.json at the commit under test. */
  packageJson: string;
}

export interface GateReport {
  passed: boolean;
  body: string;
  /** The labelled platforms when the gate passed: what the preview job publishes. */
  publishable: Platform[];
  fingerprints: Partial<Record<Platform, string>>;
}

export async function runGate(runner: Runner, ctx: GateContext): Promise<GateReport> {
  const version = parseReleaseBranch(ctx.baseRef);
  if (!version) {
    const body = renderBadBranch(ctx.baseRef);
    return report(runner, ctx, { passed: false, body, publishable: [], fingerprints: {} });
  }

  const verdicts: Verdict[] = [];
  const fingerprints: Partial<Record<Platform, string>> = {};
  const explanations: Partial<Record<Platform, string>> = {};
  for (const platform of PLATFORMS) {
    const fingerprint = await computeFingerprint(runner, platform);
    fingerprints[platform] = fingerprint;
    const builds = await listBuilds(runner, {
      platform,
      profile: 'production',
      appVersion: version,
    });
    const verdict = verdictFor(platform, lockState(builds, platform, version), fingerprint);
    verdicts.push(verdict);
    if (verdict.kind === 'mismatch')
      explanations[platform] = await explainMismatch(runner, verdict.build.id);
  }

  const locked = verdicts.some((verdict) => verdict.kind !== 'open');
  const errors = gateErrors(
    verdicts,
    version,
    locked && (await bringsMainCommits(runner, ctx.baseRef)),
  );
  const labels = platformsFromLabels(ctx.labels);
  const issues = labels.length ? await openFreezes(runner, ctx.repo) : [];
  const files = ctx.prNumber === null ? [] : await pullRequestFiles(runner, ctx.repo, ctx.prNumber);
  const body = renderGate({
    baseRef: ctx.baseRef,
    version,
    verdicts,
    errors,
    explanations,
    labels,
    freezes: labels.flatMap((platform) => findFreeze(issues, platform, version) ?? []),
    findings: networkFindings(files),
    dependencies: dependencyChanges(await basePackageJson(runner, ctx.baseRef), ctx.packageJson),
    warnings:
      ctx.appJsonVersion === version
        ? []
        : [
            `\`app.json\` says ${ctx.appJsonVersion} but the branch is ${version}: bump it before the store build.`,
          ],
  });
  const passed = errors.length === 0;
  return report(runner, ctx, { passed, body, publishable: passed ? labels : [], fingerprints });
}

async function report(runner: Runner, ctx: GateContext, result: GateReport): Promise<GateReport> {
  if (ctx.prNumber !== null)
    await upsertComment(runner, ctx.repo, ctx.prNumber, COMMENT_MARKER, result.body);
  return result;
}
```

`scripts/ci/flows/preview.ts`:

```ts
// The `preview` job: publishes a passing, labelled PR to the preview channel, one
// platform at a time, when a preview build on the same runtime exists to receive it.
// Not a required check: a failure here never blocks a merge.
import { done, failed, skipped, type Outcome } from '../lib/outcome.ts';
import { isDocsOrCiOnly } from '../lib/pr.ts';
import { PLATFORM_NAMES, short, type Platform } from '../lib/release.ts';
import { COMMENT_MARKER, withPreview } from '../lib/render.ts';
import { listBuilds, publishUpdate } from './eas.ts';
import { findComment, pullRequestFiles, updateComment } from './github.ts';
import type { Runner } from './runner.ts';

export interface PreviewContext {
  repo: string;
  prNumber: number;
  prTitle: string;
  headSha: string;
  platforms: Platform[];
  fingerprints: Partial<Record<Platform, string>>;
}

export async function runPreview(runner: Runner, ctx: PreviewContext): Promise<Outcome> {
  const files = await pullRequestFiles(runner, ctx.repo, ctx.prNumber);
  const results: string[] = [];
  let published = false;
  let broken = false;
  if (isDocsOrCiOnly(files.map((file) => file.filename))) {
    results.push('skipped, the PR only changes docs or CI');
  } else {
    for (const platform of ctx.platforms) {
      const name = PLATFORM_NAMES[platform];
      const fingerprint = ctx.fingerprints[platform];
      if (!fingerprint) {
        results.push(`${name}: skipped, the gate reported no fingerprint`);
        continue;
      }
      const receivers = await listBuilds(runner, {
        platform,
        profile: 'preview',
        fingerprint,
        finishedOnly: true,
      });
      if (receivers.length === 0) {
        results.push(
          `${name}: skipped, no preview build on runtime \`${short(fingerprint)}\` (cut one with store-build, profile: preview)`,
        );
        continue;
      }
      const message = `PR #${ctx.prNumber}: ${ctx.prTitle} @ ${ctx.headSha.slice(0, 7)}`;
      const update = (await publishUpdate(runner, { channel: 'preview', platform, message })).find(
        (candidate) => candidate.platform === platform,
      );
      if (!update || update.runtimeVersion !== fingerprint) {
        broken = true;
        results.push(
          `${name}: ❌ published runtime \`${short(update?.runtimeVersion)}\`, expected \`${short(fingerprint)}\``,
        );
        continue;
      }
      published = true;
      results.push(`${name} → group \`${short(update.group)}\` (open the preview app twice)`);
    }
  }
  const text = results.join(' · ');
  const comment = await findComment(runner, ctx.repo, ctx.prNumber, COMMENT_MARKER);
  if (comment) await updateComment(runner, ctx.repo, comment.id, withPreview(comment.body, text));
  const summary = `**Preview:** ${text}`;
  if (broken) return failed(summary);
  return published ? done(summary) : skipped(summary);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run scripts/ci/flows/gate.test.ts scripts/ci/flows/preview.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): release-gate and preview flows (#73)"
```

---

### Task 11: The production publish flow

**Files:**

- Create: `scripts/ci/flows/publish.ts`
- Test: `scripts/ci/flows/publish.test.ts`

**Interfaces:**

- Produces: `interface PublishContext { repo; branch; sha; platform: Platform; message; trigger: 'push' | 'dispatch'; prNumber: number | null; account }`, `runPublish(runner, ctx): Promise<Outcome>`.

- [ ] **Step 1: Write the failing tests** — `scripts/ci/flows/publish.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import type { Issue } from '../lib/freeze.ts';
import type { EasBuild } from '../lib/release.ts';
import type { UpdateGroupSummary } from '../lib/updates.ts';
import { fakeRunner, json, ok, ran } from './fake-runner.ts';
import { runPublish, type PublishContext } from './publish.ts';

const builds = fixture<EasBuild[]>('builds.json');
const history = fixture<UpdateGroupSummary[]>('updates-production.json');
const IOS = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const HEAD = '1111111111111111111111111111111111111111';

const ctx: PublishContext = {
  repo: 'tovmassian/escuadra',
  branch: 'release/1.0.0',
  sha: HEAD,
  platform: 'ios',
  message: 'fix: show the update ID on About (#74)',
  trigger: 'push',
  prNumber: 74,
  account: 'tovmassian27',
};

interface World {
  fingerprint?: string;
  freezes?: Issue[];
  newestCommit?: string;
  publishedRuntime?: string;
}

function world(w: World = {}) {
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    if (tool === 'eas' && sub === 'build:list') return json(builds);
    if (tool === 'eas' && sub === 'fingerprint:generate')
      return json({ hash: w.fingerprint ?? IOS });
    if (tool === 'gh' && sub === 'issue') return json(w.freezes ?? []);
    if (tool === 'eas' && sub === 'update:list') {
      return json({
        currentPage: history
          .filter((g) => g.platforms === 'ios' && g.runtimeVersion === IOS)
          .slice(0, 1),
      });
    }
    if (tool === 'eas' && sub === 'update:view') {
      return json([
        {
          id: 'u0',
          group: 'e43368a2-cfde-483d-a99d-fd1e9bc2691f',
          platform: 'ios',
          runtimeVersion: IOS,
          gitCommitHash: w.newestCommit ?? 'daf142b21e841e33c8575ba3241b8a4bcdbf982b',
          isRollBackToEmbedded: false,
        },
      ]);
    }
    if (tool === 'eas' && sub === 'update') {
      return json([
        {
          id: 'u1',
          group: '5e6f7a8b-0000-0000-0000-000000000000',
          platform: 'ios',
          runtimeVersion: w.publishedRuntime ?? IOS,
          gitCommitHash: HEAD,
          isRollBackToEmbedded: false,
        },
      ]);
    }
    if (tool === 'eas' && sub === 'account:usage') {
      return json({
        updates: {
          uniqueUpdaters: { plan: { used: 44, limit: 1000 } },
          bandwidth: { plan: { usedBytes: 272507447, limitBytes: 107374182400 } },
        },
      });
    }
    if (tool === 'gh' && sub === 'api') return ok('{}');
    return undefined;
  });
}

const published = (calls: Parameters<typeof ran>[0]): boolean => ran(calls, 'eas', 'update');

describe('runPublish', () => {
  it('publishes a locked, matching, unfrozen commit and comments on the PR', async () => {
    const runner = world();
    const outcome = await runPublish(runner, ctx);
    expect(outcome.status).toBe('done');
    expect(outcome.summary).toContain('matches build 3');
    expect(outcome.summary).toContain('44 / 1,000 update users');
    const update = runner.calls.find((call) => call.tool === 'eas' && call.args[0] === 'update');
    expect(update?.args).toEqual(
      expect.arrayContaining(['--channel', 'production', '--platform', 'ios']),
    );
    expect(
      runner.calls.some((call) =>
        call.args.includes('repos/tovmassian/escuadra/issues/74/comments'),
      ),
    ).toBe(true);
  });

  it('never publishes while the platform and version are frozen', async () => {
    const freeze = {
      number: 80,
      title: 'OTA freeze: ios@1.0.0',
      url: 'https://github.com/tovmassian/escuadra/issues/80',
    };
    const runner = world({ freezes: [freeze] });
    const outcome = await runPublish(runner, ctx);
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('#80');
    expect(published(runner.calls)).toBe(false);
  });

  it('ignores a freeze for another version', async () => {
    const freeze = {
      number: 81,
      title: 'OTA freeze: ios@1.1.0',
      url: 'https://github.com/tovmassian/escuadra/issues/81',
    };
    expect((await runPublish(world({ freezes: [freeze] }), ctx)).status).toBe('done');
  });

  it('never publishes a commit whose fingerprint moved', async () => {
    const runner = world({ fingerprint: 'c0a62aca64074feadd73c7042a3a9a8737a30405' });
    expect((await runPublish(runner, ctx)).status).toBe('failed');
    expect(published(runner.calls)).toBe(false);
  });

  it('skips a push to an open version but fails a manual run', async () => {
    const open = { ...ctx, branch: 'release/1.1.0' };
    expect((await runPublish(world(), open)).status).toBe('skipped');
    expect((await runPublish(world(), { ...open, trigger: 'dispatch' })).status).toBe('failed');
  });

  it('skips when the newest production update already came from this commit', async () => {
    const runner = world({ newestCommit: HEAD });
    expect((await runPublish(runner, ctx)).status).toBe('skipped');
    expect(published(runner.calls)).toBe(false);
  });

  it('fails loudly when the published runtime differs from the build', async () => {
    const outcome = await runPublish(
      world({ publishedRuntime: 'ffffffffffffffffffffffffffffffffffffffff' }),
      ctx,
    );
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('🚨');
  });

  it("refuses a branch that isn't release/X.Y.Z before touching EAS", async () => {
    const runner = world();
    expect((await runPublish(runner, { ...ctx, branch: 'main' })).status).toBe('failed');
    expect(runner.calls).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/ci/flows/publish.test.ts`
Expected: FAIL — `./publish.ts` not found.

- [ ] **Step 3: Implement** — `scripts/ci/flows/publish.ts`

```ts
// The production publish for one platform (`ota-production`). It re-checks the lock and
// the fingerprint on the exact commit — the branch may have moved since the PR check —
// honours freezes, refuses duplicates, publishes, and verifies the runtime it published.
// §7 of the design.
import { findFreeze } from '../lib/freeze.ts';
import { done, failed, skipped, type Outcome } from '../lib/outcome.ts';
import {
  PLATFORM_NAMES,
  lockState,
  parseReleaseBranch,
  short,
  type Platform,
} from '../lib/release.ts';
import { alreadyPublished } from '../lib/updates.ts';
import { usageReport } from '../lib/usage.ts';
import {
  accountUsage,
  computeFingerprint,
  listBuilds,
  listUpdateGroups,
  publishUpdate,
  viewUpdateGroup,
} from './eas.ts';
import { commentOnPr, openFreezes } from './github.ts';
import type { Runner } from './runner.ts';

export interface PublishContext {
  repo: string;
  branch: string;
  sha: string;
  platform: Platform;
  message: string;
  trigger: 'push' | 'dispatch';
  prNumber: number | null;
  account: string;
}

export async function runPublish(runner: Runner, ctx: PublishContext): Promise<Outcome> {
  const name = PLATFORM_NAMES[ctx.platform];
  const version = parseReleaseBranch(ctx.branch);
  if (!version)
    return failed(
      `\`${ctx.branch}\` isn't a release branch: production publishes run only on release/X.Y.Z.`,
    );

  const builds = await listBuilds(runner, {
    platform: ctx.platform,
    profile: 'production',
    appVersion: version,
  });
  const lock = lockState(builds, ctx.platform, version);
  if (lock.state === 'open') {
    const why = `No ${version} production build for ${name} yet: nothing to publish to.`;
    return ctx.trigger === 'push' ? skipped(why) : failed(why);
  }
  if (lock.state === 'pending') {
    return failed(
      `Build ${lock.build.appBuildVersion} of ${version} is still running. Publish after it finishes.`,
    );
  }

  const fingerprint = await computeFingerprint(runner, ctx.platform);
  if (fingerprint !== lock.runtime) {
    return failed(
      `This commit's ${name} fingerprint \`${short(fingerprint)}\` doesn't match build ` +
        `${lock.build.appBuildVersion} (\`${short(lock.runtime)}\`). Nothing was published.`,
    );
  }

  const freeze = findFreeze(await openFreezes(runner, ctx.repo), ctx.platform, version);
  if (freeze) {
    return failed(
      `Frozen by #${freeze.number} (${freeze.url}). Close it when the review passes, then Re-run failed jobs.`,
    );
  }

  const [newest] = await listUpdateGroups(runner, 'production', ctx.platform, lock.runtime, 1);
  if (
    newest &&
    alreadyPublished(await viewUpdateGroup(runner, newest.group), ctx.platform, ctx.sha)
  ) {
    return skipped(
      `The newest ${name} production update (\`${short(newest.group)}\`) already came from ${ctx.sha.slice(0, 7)}.`,
    );
  }

  const updates = await publishUpdate(runner, {
    channel: 'production',
    platform: ctx.platform,
    message: ctx.message,
  });
  const update = updates.find((candidate) => candidate.platform === ctx.platform);
  if (!update)
    return failed(
      `eas update returned no ${name} update. Check the EAS dashboard before retrying.`,
    );
  if (update.runtimeVersion !== lock.runtime) {
    return failed(
      `🚨 Published group \`${short(update.group)}\` on runtime \`${short(update.runtimeVersion)}\`, but build ` +
        `${lock.build.appBuildVersion} runs \`${short(lock.runtime)}\`: it reaches nobody. Roll back with ` +
        'ota-rollback and investigate before publishing again.',
    );
  }

  let usage = 'EAS usage: unavailable';
  const warnings: string[] = [];
  try {
    const report = usageReport(await accountUsage(runner, ctx.account));
    usage = report.line;
    warnings.push(...report.warnings);
  } catch {
    // Usage is advisory, and the update is already out.
  }
  const summary = [
    `🚀 production · ${name} · ${version} · group \`${short(update.group)}\` · runtime ` +
      `\`${short(update.runtimeVersion)}\` ✅ matches build ${lock.build.appBuildVersion}`,
    'Open the store app twice to see it · rollback: Actions → ota-rollback',
    usage,
    ...warnings.map((warning) => `⚠️ ${warning}`),
  ].join('\n\n');
  if (ctx.prNumber !== null) await commentOnPr(runner, ctx.repo, ctx.prNumber, summary);
  return done(summary);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run scripts/ci/flows/publish.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): production publish flow — lock, fingerprint, freeze, duplicate guard, verify (#73)"
```

---

### Task 12: The rollback flow

**Files:**

- Create: `scripts/ci/flows/rollback.ts`
- Test: `scripts/ci/flows/rollback.test.ts`

**Interfaces:**

- Produces: `interface RollbackContext { repo; branch; platform: Platform; channel: 'production' | 'preview'; mode: RollbackMode; groupId: string | null; reason; dryRun: boolean; runUrl }`, `interface Waiter { sleep(ms: number): Promise<void>; pollMs: number; maxPolls: number }`, `runRollback(runner, ctx, waiter): Promise<Outcome>`.

- [ ] **Step 1: Write the failing tests** — `scripts/ci/flows/rollback.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import type { EasBuild } from '../lib/release.ts';
import type { UpdateGroupSummary } from '../lib/updates.ts';
import { fakeRunner, indexOf, json, ok, ran } from './fake-runner.ts';
import { runRollback, type RollbackContext, type Waiter } from './rollback.ts';

const builds = fixture<EasBuild[]>('builds.json');
const history = fixture<UpdateGroupSummary[]>('updates-production.json');
const IOS = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const NEW_GROUP = '9a8b7c6d-0000-0000-0000-000000000000';

const ctx: RollbackContext = {
  repo: 'tovmassian/escuadra',
  branch: 'release/1.0.0',
  platform: 'ios',
  channel: 'production',
  mode: 'previous',
  groupId: null,
  reason: 'About screen crashes',
  dryRun: false,
  runUrl: 'https://github.com/tovmassian/escuadra/actions/runs/1',
};

interface World {
  active?: number[];
  groups?: UpdateGroupSummary[];
  newestAfter?: string;
}

function world(w: World = {}) {
  const active = [...(w.active ?? [0])];
  let rolledBack = false;
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    if (tool === 'eas' && sub === 'build:list') return json(builds);
    if (tool === 'eas' && sub === 'update:list') {
      const page = (w.groups ?? history).filter(
        (g) => g.platforms === 'ios' && g.runtimeVersion === IOS,
      );
      const newest: UpdateGroupSummary = {
        group: w.newestAfter ?? NEW_GROUP,
        runtimeVersion: IOS,
        platforms: 'ios',
        isRollBackToEmbedded: false,
        message: '"Rollback: About screen crashes" (just now by robot)',
      };
      const limit = Number(args[args.indexOf('--limit') + 1]);
      return json({ currentPage: (rolledBack ? [newest, ...page] : page).slice(0, limit) });
    }
    if (tool === 'gh' && sub === 'issue')
      return ok('https://github.com/tovmassian/escuadra/issues/80\n');
    if (tool === 'gh' && sub === 'run')
      return json(Array.from({ length: active.shift() ?? 0 }, () => ({ status: 'in_progress' })));
    if (tool === 'eas' && (sub === 'update:republish' || sub === 'update:roll-back-to-embedded')) {
      rolledBack = true;
      return json([
        {
          id: 'r1',
          group: NEW_GROUP,
          platform: 'ios',
          runtimeVersion: IOS,
          isRollBackToEmbedded: sub !== 'update:republish',
        },
      ]);
    }
    return undefined;
  });
}

function waiter(): Waiter & { sleeps: number } {
  const state: Waiter & { sleeps: number } = {
    sleeps: 0,
    pollMs: 1,
    maxPolls: 2,
    sleep: async () => {
      state.sleeps += 1;
    },
  };
  return state;
}

describe('runRollback', () => {
  it('freezes first, waits out a running publish, republishes the previous group and verifies', async () => {
    const runner = world({ active: [1, 0] });
    const wait = waiter();
    const outcome = await runRollback(runner, ctx, wait);
    expect(outcome.status).toBe('done');
    expect(indexOf(runner.calls, 'gh', 'issue')).toBeLessThan(
      indexOf(runner.calls, 'eas', 'update:republish'),
    );
    expect(wait.sleeps).toBe(1);
    const republish = runner.calls.find((call) => call.args[0] === 'update:republish');
    expect(republish?.args).toEqual(
      expect.arrayContaining(['--group', '02f7fad4-83fc-41f3-8a14-04892984be7d']),
    );
    expect(outcome.summary).toContain('"Correct privacy text (#61)"');
    expect(outcome.summary).toContain('Freeze opened');
  });

  it('dry run: shows the target and changes nothing', async () => {
    const runner = world();
    const outcome = await runRollback(runner, { ...ctx, dryRun: true }, waiter());
    expect(outcome.status).toBe('skipped');
    expect(outcome.summary).toContain('Dry run');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
    expect(ran(runner.calls, 'eas', 'update:republish')).toBe(false);
  });

  it('refuses without a freeze when there is nothing earlier', async () => {
    const onlyNewest = history.filter((g) => g.group === 'e43368a2-cfde-483d-a99d-fd1e9bc2691f');
    const runner = world({ groups: onlyNewest });
    expect((await runRollback(runner, ctx, waiter())).status).toBe('failed');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
  });

  it('preview: no freeze and no waiting', async () => {
    const runner = world();
    expect((await runRollback(runner, { ...ctx, channel: 'preview' }, waiter())).status).toBe(
      'done',
    );
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
    expect(ran(runner.calls, 'gh', 'run')).toBe(false);
  });

  it('gives up without rolling back while publishes keep running, and keeps the freeze', async () => {
    const runner = world({ active: [1, 1, 1, 1] });
    const outcome = await runRollback(runner, ctx, waiter());
    expect(outcome.status).toBe('failed');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(true);
    expect(ran(runner.calls, 'eas', 'update:republish')).toBe(false);
  });

  it('embedded: rolls the runtime back to the JS inside build 3', async () => {
    const runner = world();
    expect((await runRollback(runner, { ...ctx, mode: 'embedded' }, waiter())).status).toBe('done');
    const call = runner.calls.find((c) => c.args[0] === 'update:roll-back-to-embedded');
    expect(call?.args).toEqual(
      expect.arrayContaining(['--runtime-version', IOS, '--platform', 'ios']),
    );
  });

  it('fails loudly when something else is newest afterwards', async () => {
    const outcome = await runRollback(
      world({ newestAfter: 'ffffffff-0000-0000-0000-000000000000' }),
      ctx,
      waiter(),
    );
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('🚨');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/ci/flows/rollback.test.ts`
Expected: FAIL — `./rollback.ts` not found.

- [ ] **Step 3: Implement** — `scripts/ci/flows/rollback.ts`

```ts
// `ota-rollback` for one platform. Production: open the freeze first (the bad commit
// is still on the branch and the next merged PR would publish it again), wait out
// running publishes, roll back, verify. Preview: the same without freeze or wait.
// §9 of the design, plus a dry run.
import { done, failed, skipped, type Outcome } from '../lib/outcome.ts';
import {
  PLATFORM_NAMES,
  lockState,
  parseReleaseBranch,
  short,
  type Platform,
} from '../lib/release.ts';
import { cleanMessage, rollbackTarget, type RollbackMode } from '../lib/updates.ts';
import { listBuilds, listUpdateGroups, republishGroup, rollBackToEmbedded } from './eas.ts';
import { activeRuns, createFreeze } from './github.ts';
import type { Runner } from './runner.ts';

export interface RollbackContext {
  repo: string;
  branch: string;
  platform: Platform;
  channel: 'production' | 'preview';
  mode: RollbackMode;
  groupId: string | null;
  reason: string;
  dryRun: boolean;
  runUrl: string;
}

export interface Waiter {
  sleep(ms: number): Promise<void>;
  pollMs: number;
  maxPolls: number;
}

export async function runRollback(
  runner: Runner,
  ctx: RollbackContext,
  waiter: Waiter,
): Promise<Outcome> {
  const name = PLATFORM_NAMES[ctx.platform];
  const version = parseReleaseBranch(ctx.branch);
  if (!version) return failed(`\`${ctx.branch}\` isn't a release branch.`);
  const builds = await listBuilds(runner, {
    platform: ctx.platform,
    profile: 'production',
    appVersion: version,
  });
  const lock = lockState(builds, ctx.platform, version);
  if (lock.state !== 'locked')
    return failed(`${name} ${version} has no finished production build: nothing to roll back.`);

  const history = await listUpdateGroups(runner, ctx.channel, ctx.platform, lock.runtime, 10);
  const target = rollbackTarget(history, ctx.platform, lock.runtime, ctx.mode, ctx.groupId);
  if (target.kind === 'error') return failed(target.message);

  const from = target.from
    ? `"${cleanMessage(target.from.message)}" (\`${short(target.from.group)}\`)`
    : 'the embedded JS';
  const to =
    target.kind === 'republish'
      ? `"${cleanMessage(target.to.message)}" (\`${short(target.to.group)}\`)`
      : `the JS inside build ${lock.build.appBuildVersion}`;
  const headline = `⏪ ${ctx.channel} · ${name} · ${version} · ${from} → ${to}`;
  if (ctx.dryRun) return skipped(`${headline}\n\nDry run: nothing changed.`);

  let freezeUrl: string | null = null;
  if (ctx.channel === 'production') {
    freezeUrl = await createFreeze(
      runner,
      ctx.repo,
      ctx.platform,
      version,
      `Rolled back by ${ctx.runUrl}: ${ctx.reason}\n\nThe bad change is still on \`${ctx.branch}\`. ` +
        'Revert or fix it there (cherry-picked from `main`), then close this issue to let production publishes through.',
    );
    for (
      let poll = 0;
      (await activeRuns(runner, ctx.repo, 'ota-production.yml', ctx.branch)) > 0;
      poll += 1
    ) {
      if (poll >= waiter.maxPolls) {
        return failed(
          `${headline}\n\nota-production is still running on ${ctx.branch}, so nothing was rolled back. ` +
            `The freeze (${freezeUrl}) stays; re-run this rollback.`,
        );
      }
      await waiter.sleep(waiter.pollMs);
    }
  }

  const message = `Rollback: ${ctx.reason}`;
  const newGroup =
    target.kind === 'republish'
      ? await republishGroup(runner, target.to.group, ctx.platform, message)
      : await rollBackToEmbedded(runner, ctx.channel, ctx.platform, lock.runtime, message);

  const [newest] = await listUpdateGroups(runner, ctx.channel, ctx.platform, lock.runtime, 1);
  if (!newest || newest.group !== newGroup) {
    return failed(
      `${headline}\n\n🚨 Rolled back as \`${short(newGroup)}\`, but the newest ${name} update is ` +
        `\`${short(newest?.group)}\`. Check \`eas update:list\` and re-run.`,
    );
  }
  return done(
    [
      headline,
      `New group \`${short(newGroup)}\` · runtime \`${short(lock.runtime)}\` ✅ build ${lock.build.appBuildVersion}`,
      freezeUrl
        ? `Freeze opened: ${freezeUrl}. Revert the bad change on ${ctx.branch}, then close it.`
        : 'Preview rollback: no freeze.',
      'Devices switch after two launches.',
    ].join('\n\n'),
  );
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run scripts/ci/flows/rollback.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): rollback flow — freeze first, wait out publishes, verify, dry run (#73)"
```

---

### Task 13: The store build flow

**Files:**

- Create: `scripts/ci/flows/build.ts`
- Test: `scripts/ci/flows/build.test.ts`

**Interfaces:**

- Produces: `interface BuildContext { repo; branch; platform: Platform; profile: 'production' | 'preview'; submit: boolean; rebuild: boolean; appJsonVersion; account; runUrl }`, `runStoreBuild(runner, ctx): Promise<Outcome>`.

- [ ] **Step 1: Write the failing tests** — `scripts/ci/flows/build.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import type { EasBuild } from '../lib/release.ts';
import { runStoreBuild, type BuildContext } from './build.ts';
import { fakeRunner, json, ok, ran } from './fake-runner.ts';

const builds = fixture<EasBuild[]>('builds.json');
const IOS_1_0_0 = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const NEW_RUNTIME = '1234567890abcdef1234567890abcdef12345678';

const BUILT: EasBuild = {
  id: 'b4',
  status: 'FINISHED',
  platform: 'IOS',
  buildProfile: 'production',
  appVersion: '1.1.0',
  appBuildVersion: '4',
  runtime: { version: NEW_RUNTIME },
  fingerprint: { hash: NEW_RUNTIME },
  gitCommitHash: null,
  createdAt: '2026-10-01T09:00:00.000Z',
};

const ctx: BuildContext = {
  repo: 'tovmassian/escuadra',
  branch: 'release/1.1.0',
  platform: 'ios',
  profile: 'production',
  submit: true,
  rebuild: false,
  appJsonVersion: '1.1.0',
  account: 'tovmassian27',
  runUrl: 'https://github.com/tovmassian/escuadra/actions/runs/1',
};

function world(options: { fingerprint?: string; built?: Partial<EasBuild> } = {}) {
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    if (tool === 'eas' && sub === 'build:list') return json(builds);
    if (tool === 'eas' && sub === 'fingerprint:generate')
      return json({ hash: options.fingerprint ?? NEW_RUNTIME });
    if (tool === 'eas' && sub === 'build') return json([{ ...BUILT, ...options.built }]);
    if (tool === 'gh' && sub === 'issue')
      return ok('https://github.com/tovmassian/escuadra/issues/81\n');
    return undefined;
  });
}

describe('runStoreBuild', () => {
  it('builds an open platform, checks the runtime and opens the freeze', async () => {
    const runner = world();
    const outcome = await runStoreBuild(runner, ctx);
    expect(outcome.status).toBe('done');
    expect(runner.calls.find((call) => call.args[0] === 'build')?.args).toContain('--auto-submit');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(true);
    expect(outcome.summary).toContain('Submit for Review');
  });

  it('refuses an app.json version that differs from the branch before touching EAS', async () => {
    const runner = world();
    expect((await runStoreBuild(runner, { ...ctx, appJsonVersion: '1.0.0' })).status).toBe(
      'failed',
    );
    expect(runner.calls).toEqual([]);
  });

  it('refuses a locked platform on another runtime', async () => {
    const runner = world({ fingerprint: NEW_RUNTIME });
    const locked = { ...ctx, branch: 'release/1.0.0', appJsonVersion: '1.0.0', rebuild: true };
    const outcome = await runStoreBuild(runner, locked);
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('needs a new version');
    expect(ran(runner.calls, 'eas', 'build')).toBe(false);
  });

  it('rebuilds the same runtime only when asked', async () => {
    const locked = { ...ctx, branch: 'release/1.0.0', appJsonVersion: '1.0.0' };
    const same = {
      fingerprint: IOS_1_0_0,
      built: { appVersion: '1.0.0', runtime: { version: IOS_1_0_0 } },
    };
    expect((await runStoreBuild(world(same), locked)).status).toBe('failed');
    expect((await runStoreBuild(world(same), { ...locked, rebuild: true })).status).toBe('done');
  });

  it('fails loudly when EAS built another runtime than the runner computed', async () => {
    const runner = world({
      built: { runtime: { version: 'ffffffffffffffffffffffffffffffffffffffff' } },
    });
    const outcome = await runStoreBuild(runner, ctx);
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('🚨');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
  });

  it('a preview build never submits or freezes', async () => {
    const runner = world({ built: { buildProfile: 'preview' } });
    const outcome = await runStoreBuild(runner, { ...ctx, profile: 'preview' });
    expect(outcome.status).toBe('done');
    expect(runner.calls.find((call) => call.args[0] === 'build')?.args).not.toContain(
      '--auto-submit',
    );
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
  });

  it("fails a build that didn't finish", async () => {
    expect((await runStoreBuild(world({ built: { status: 'ERRORED' } }), ctx)).status).toBe(
      'failed',
    );
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/ci/flows/build.test.ts`
Expected: FAIL — `./build.ts` not found.

- [ ] **Step 3: Implement** — `scripts/ci/flows/build.ts`

```ts
// `store-build` for one platform. Production builds are gated on the version, the lock
// and the runtime and, with submit, open the review freeze. Every build's runtime is
// checked against the fingerprint the runner computed for the same commit, which
// answers "does a Linux runner agree with EAS?" on every build. §10 of the design.
import { done, failed, type Outcome } from '../lib/outcome.ts';
import {
  PLATFORM_NAMES,
  buildRuntime,
  lockState,
  parseReleaseBranch,
  short,
  type Platform,
} from '../lib/release.ts';
import { computeFingerprint, listBuilds, startBuild } from './eas.ts';
import { createFreeze } from './github.ts';
import type { Runner } from './runner.ts';

export interface BuildContext {
  repo: string;
  branch: string;
  platform: Platform;
  profile: 'production' | 'preview';
  submit: boolean;
  rebuild: boolean;
  appJsonVersion: string;
  account: string;
  runUrl: string;
}

export async function runStoreBuild(runner: Runner, ctx: BuildContext): Promise<Outcome> {
  const name = PLATFORM_NAMES[ctx.platform];
  const version = parseReleaseBranch(ctx.branch);
  if (!version)
    return failed(`\`${ctx.branch}\` isn't a release branch: builds run only on release/X.Y.Z.`);
  const production = ctx.profile === 'production';
  if (production && ctx.appJsonVersion !== version) {
    return failed(
      `\`app.json\` says ${ctx.appJsonVersion} but the branch is ${version}. Bump it first: a mismatched ` +
        `build would count as ${ctx.appJsonVersion} and lock the wrong branch.`,
    );
  }

  const productionBuilds = await listBuilds(runner, {
    platform: ctx.platform,
    profile: 'production',
    appVersion: version,
  });
  const lock = lockState(productionBuilds, ctx.platform, version);
  const fingerprint = await computeFingerprint(runner, ctx.platform);
  if (production && lock.state === 'pending') {
    return failed(`Build ${lock.build.appBuildVersion} of ${version} is still running.`);
  }
  if (production && lock.state === 'locked') {
    if (lock.runtime !== fingerprint) {
      return failed(
        `${name} ${version} is locked to \`${short(lock.runtime)}\` (build ${lock.build.appBuildVersion}); ` +
          `this commit is \`${short(fingerprint)}\`. A runtime change needs a new version.`,
      );
    }
    if (!ctx.rebuild) {
      return failed(
        `${name} ${version} is already built on this runtime (build ${lock.build.appBuildVersion}). ` +
          'Turn on rebuild only to embed newer JS for a review.',
      );
    }
  }

  const built = await startBuild(runner, ctx.platform, ctx.profile, production && ctx.submit);
  const build = built.find((candidate) => candidate.platform.toLowerCase() === ctx.platform);
  const buildUrl = build
    ? `https://expo.dev/accounts/${ctx.account}/projects/escuadra/builds/${build.id}`
    : '(no build returned)';
  if (!build || build.status !== 'FINISHED') {
    return failed(
      `The ${name} build didn't finish (status ${build?.status ?? 'unknown'}): ${buildUrl}`,
    );
  }
  const runtime = buildRuntime(build);
  if (runtime !== fingerprint) {
    return failed(
      `🚨 EAS built runtime \`${short(runtime)}\`, but the runner computed \`${short(fingerprint)}\` for the ` +
        `same commit: ${buildUrl}. Don't publish OTAs to this build until that's explained.`,
    );
  }
  if (!production && lock.state === 'locked' && runtime !== lock.runtime) {
    return failed(
      `Preview build ${buildUrl} runs \`${short(runtime)}\` but ${name} ${version} production runs ` +
        `\`${short(lock.runtime)}\`: it can't preview this version's OTAs.`,
    );
  }

  const lines = [
    `🏗️ ${ctx.profile} · ${name} · ${version} · build ${build.appBuildVersion} · runtime \`${short(runtime)}\` ✅ matches the runner`,
    buildUrl,
  ];
  if (production && ctx.submit) {
    const freezeUrl = await createFreeze(
      runner,
      ctx.repo,
      ctx.platform,
      version,
      `Build ${build.appBuildVersion} (${buildUrl}) was submitted by ${ctx.runUrl}. Production publishes for ` +
        `${ctx.platform}@${version} stay blocked until this issue is closed. Close it once the store review passes.`,
    );
    lines.push(
      `Freeze opened: ${freezeUrl}`,
      ctx.platform === 'ios'
        ? 'Next: Submit for Review in App Store Connect, then close the freeze once approved.'
        : 'Next: promote the build in Play Console, then close the freeze once approved.',
    );
  }
  if (!production)
    lines.push('Install it from the build page; it receives `preview` updates for this runtime.');
  return done(lines.join('\n\n'));
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run scripts/ci/flows/build.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): gated store build flow (#73)"
```

---

### Task 14: Entry points

**Files:**

- Create: `scripts/ci/flows/actions.ts`, `scripts/ci/gate.ts`, `scripts/ci/preview.ts`, `scripts/ci/publish.ts`, `scripts/ci/rollback.ts`, `scripts/ci/build.ts`

**Interfaces:**

- Produces: `env(name)`, `optionalEnv(name)`, `readEvent<T>()`, `setOutput(name, value)`, `writeSummary(markdown)`, `appJsonVersion()`, `runUrl()`, `finish(outcome)`, `sleep(ms)`, `errorMessage(error)`. The entry points read the environment variables named in Task 15's workflows.

These are thin I/O shells around tested flows; they are exercised by the dry run in Task 17 and by the real runs in Phase 4, not by unit tests.

- [ ] **Step 1: Write `scripts/ci/flows/actions.ts`**

```ts
// The GitHub Actions side of the entry points: event payload, environment, step outputs
// and the job summary. Kept out of the flows so the flows stay testable.
import { appendFileSync, readFileSync } from 'node:fs';
import type { Outcome } from '../lib/outcome.ts';

// Read by name through an alias: expo/no-dynamic-env-var guards Metro's build-time
// inlining of process.env in app code, and nothing here is bundled.
const vars: Record<string, string | undefined> = process.env;

export function optionalEnv(name: string): string {
  return vars[name] ?? '';
}

export function env(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function readEvent<T>(): T {
  return JSON.parse(readFileSync(env('GITHUB_EVENT_PATH'), 'utf8')) as T;
}

/** Single-line values only: JSON, numbers, PR titles. */
export function setOutput(name: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${value}\n`);
}

export function writeSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${markdown}\n`);
  process.stdout.write(`${markdown}\n`);
}

export function appJsonVersion(): string {
  return (JSON.parse(readFileSync('app.json', 'utf8')) as { expo: { version: string } }).expo
    .version;
}

export function runUrl(): string {
  return `${env('GITHUB_SERVER_URL')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}`;
}

/** Reports an outcome; only `failed` fails the job. */
export function finish(outcome: Outcome): void {
  writeSummary(outcome.summary);
  if (outcome.status === 'failed') process.exitCode = 1;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 2: Write `scripts/ci/gate.ts`**

```ts
// Entry point for the `release-gate` check. In CI it reads the pull_request event; on a
// Mac, `node scripts/ci/gate.ts --base release/1.0.0 --dry-run` prints the verdict for
// the checked-out tree and comments nowhere (set EAS_CLI="npx --yes eas-cli@24.7.0"
// without a global eas).
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  appJsonVersion,
  errorMessage,
  readEvent,
  setOutput,
  writeSummary,
} from './flows/actions.ts';
import { runGate } from './flows/gate.ts';
import { createRunner } from './flows/runner.ts';

interface PullRequestEvent {
  pull_request: { number: number; base: { ref: string }; labels: { name: string }[] };
}

const { values } = parseArgs({
  options: { base: { type: 'string' }, 'dry-run': { type: 'boolean', default: false } },
});

try {
  const pr = values['dry-run'] ? null : readEvent<PullRequestEvent>().pull_request;
  const baseRef = values.base ?? pr?.base.ref;
  if (!baseRef) throw new Error('No base branch: pass --base release/X.Y.Z with --dry-run');
  const report = await runGate(createRunner(), {
    repo: process.env.GITHUB_REPOSITORY ?? 'tovmassian/escuadra',
    baseRef,
    prNumber: pr?.number ?? null,
    labels: pr?.labels.map((label) => label.name) ?? [],
    appJsonVersion: appJsonVersion(),
    packageJson: readFileSync('package.json', 'utf8'),
  });
  setOutput('platforms', JSON.stringify(report.publishable));
  setOutput('fingerprints', JSON.stringify(report.fingerprints));
  writeSummary(report.body);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  writeSummary(`❌ release-gate couldn't finish: ${errorMessage(error)}\n\nRe-run the check.`);
  process.exitCode = 1;
}
```

- [ ] **Step 3: Write `scripts/ci/preview.ts`**

```ts
// Entry point for the `preview` job of release-gate: publishes the PR to the preview
// channel for the platforms the gate passed through.
import { env, errorMessage, finish, readEvent, writeSummary } from './flows/actions.ts';
import { runPreview } from './flows/preview.ts';
import { createRunner } from './flows/runner.ts';
import { parsePlatform } from './lib/pr.ts';
import type { Platform } from './lib/release.ts';

interface PullRequestEvent {
  pull_request: { number: number; title: string; head: { sha: string } };
}

try {
  const pr = readEvent<PullRequestEvent>().pull_request;
  finish(
    await runPreview(createRunner(), {
      repo: env('GITHUB_REPOSITORY'),
      prNumber: pr.number,
      prTitle: pr.title,
      headSha: pr.head.sha,
      platforms: (JSON.parse(env('PLATFORMS')) as string[]).map(parsePlatform),
      fingerprints: JSON.parse(env('FINGERPRINTS')) as Partial<Record<Platform, string>>,
    }),
  );
} catch (error) {
  writeSummary(`❌ preview publish failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
```

- [ ] **Step 4: Write `scripts/ci/publish.ts`**

```ts
// Entry point for ota-production. `resolve` decides which platforms a push (a merged PR)
// or a manual run publishes; `run` publishes one platform.
import {
  env,
  errorMessage,
  finish,
  optionalEnv,
  readEvent,
  setOutput,
  writeSummary,
} from './flows/actions.ts';
import { pullRequestsForCommit } from './flows/github.ts';
import { runPublish } from './flows/publish.ts';
import { createRunner } from './flows/runner.ts';
import { parsePlatform, platformsFromInput, platformsFromLabels } from './lib/pr.ts';
import type { Platform } from './lib/release.ts';

const runner = createRunner();

async function resolve(repo: string, branch: string, sha: string): Promise<void> {
  let platforms: Platform[] = [];
  let message = '';
  let pr = '';
  if (env('GITHUB_EVENT_NAME') === 'workflow_dispatch') {
    platforms = platformsFromInput(env('INPUT_PLATFORMS'));
    message = optionalEnv('INPUT_MESSAGE') || `Manual publish from ${branch} @ ${sha.slice(0, 7)}`;
    writeSummary(
      `Manual run: publishing ${platforms.join(' and ')} from ${branch} @ ${sha.slice(0, 7)}.`,
    );
  } else {
    const event = readEvent<{ created?: boolean }>();
    const prs = event.created ? [] : await pullRequestsForCommit(runner, repo, sha);
    const merged = prs.find((candidate) => candidate.merged && candidate.baseRef === branch);
    if (!merged) {
      writeSummary(`No merged PR behind ${sha.slice(0, 7)}: nothing to publish.`);
    } else {
      platforms = platformsFromLabels(merged.labels);
      message = `${merged.title} (#${merged.number})`;
      pr = String(merged.number);
      writeSummary(
        platforms.length
          ? `#${merged.number} publishes to ${platforms.join(' and ')}.`
          : `#${merged.number} has no ota:* label: nothing to publish.`,
      );
    }
  }
  setOutput('platforms', JSON.stringify(platforms));
  setOutput('message', message);
  setOutput('pr', pr);
}

async function run(repo: string, branch: string, sha: string): Promise<void> {
  const prNumber = optionalEnv('PR_NUMBER');
  finish(
    await runPublish(runner, {
      repo,
      branch,
      sha,
      platform: parsePlatform(env('PLATFORM')),
      message: env('MESSAGE'),
      trigger: env('GITHUB_EVENT_NAME') === 'push' ? 'push' : 'dispatch',
      prNumber: prNumber ? Number(prNumber) : null,
      account: env('EAS_ACCOUNT'),
    }),
  );
}

try {
  const repo = env('GITHUB_REPOSITORY');
  const branch = env('GITHUB_REF_NAME');
  const sha = env('GITHUB_SHA');
  const command = process.argv[2];
  if (command === 'resolve') await resolve(repo, branch, sha);
  else if (command === 'run') await run(repo, branch, sha);
  else throw new Error(`usage: node scripts/ci/publish.ts resolve|run, got "${command ?? ''}"`);
} catch (error) {
  writeSummary(`❌ ota-production failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
```

- [ ] **Step 5: Write `scripts/ci/rollback.ts`**

```ts
// Entry point for ota-rollback: one platform per job.
import {
  env,
  errorMessage,
  finish,
  optionalEnv,
  runUrl,
  sleep,
  writeSummary,
} from './flows/actions.ts';
import { runRollback } from './flows/rollback.ts';
import { createRunner } from './flows/runner.ts';
import { parsePlatform } from './lib/pr.ts';
import type { RollbackMode } from './lib/updates.ts';

function parseMode(value: string): RollbackMode {
  if (value === 'previous' || value === 'group' || value === 'embedded') return value;
  throw new Error(`mode must be previous, group or embedded, got "${value}"`);
}

try {
  const channel = env('CHANNEL');
  if (channel !== 'production' && channel !== 'preview') {
    throw new Error(`channel must be production or preview, got "${channel}"`);
  }
  finish(
    await runRollback(
      createRunner(),
      {
        repo: env('GITHUB_REPOSITORY'),
        branch: env('GITHUB_REF_NAME'),
        platform: parsePlatform(env('PLATFORM')),
        channel,
        mode: parseMode(env('MODE')),
        groupId: optionalEnv('GROUP_ID') || null,
        reason: env('REASON'),
        dryRun: optionalEnv('DRY_RUN') === 'true',
        runUrl: runUrl(),
      },
      { sleep, pollMs: 20_000, maxPolls: 45 },
    ),
  );
} catch (error) {
  writeSummary(`❌ ota-rollback failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
```

- [ ] **Step 6: Write `scripts/ci/build.ts`**

```ts
// Entry point for store-build: one platform per job.
import {
  appJsonVersion,
  env,
  errorMessage,
  finish,
  runUrl,
  writeSummary,
} from './flows/actions.ts';
import { runStoreBuild } from './flows/build.ts';
import { createRunner } from './flows/runner.ts';
import { parsePlatform } from './lib/pr.ts';

try {
  const profile = env('PROFILE');
  if (profile !== 'production' && profile !== 'preview') {
    throw new Error(`profile must be production or preview, got "${profile}"`);
  }
  finish(
    await runStoreBuild(createRunner(), {
      repo: env('GITHUB_REPOSITORY'),
      branch: env('GITHUB_REF_NAME'),
      platform: parsePlatform(env('PLATFORM')),
      profile,
      submit: env('SUBMIT') === 'true',
      rebuild: env('REBUILD') === 'true',
      appJsonVersion: appJsonVersion(),
      account: env('EAS_ACCOUNT'),
      runUrl: runUrl(),
    }),
  );
} catch (error) {
  writeSummary(`❌ store-build failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
```

- [ ] **Step 7: Smoke-test argument handling without EAS**

Run: `node scripts/ci/publish.ts nonsense; echo "exit=$?"`
Expected: a line starting `❌ ota-production failed:` (it names `GITHUB_REPOSITORY is not set`), then `exit=1`.

- [ ] **Step 8: Format, check, commit**

```bash
npx prettier --write scripts/ci && npm run check
git add scripts/ci
git commit -m "feat(ci): entry points for gate, preview, publish, rollback and build (#73)"
```

---

### Task 15: Workflows, setup action and actionlint

**Files:**

- Create: `.github/actions/setup/action.yml`, `.github/workflows/release-gate.yml`, `.github/workflows/ota-production.yml`, `.github/workflows/ota-rollback.yml`, `.github/workflows/store-build.yml`
- Modify: `.github/workflows/check.yml`

- [ ] **Step 1: `.github/actions/setup/action.yml`**

```yaml
name: Release pipeline setup
description: Node from .nvmrc, npm ci, and the pinned eas-cli. Check out the repository first.
runs:
  using: composite
  steps:
    - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
      with:
        node-version-file: .nvmrc
        cache: npm
    - name: Install dependencies
      shell: bash
      run: npm ci
    - name: Install eas-cli
      shell: bash
      run: npm install --global eas-cli@24.7.0
```

- [ ] **Step 2: `.github/workflows/release-gate.yml`**

```yaml
# The required check on every PR into a release branch, then the preview publish.
# See docs/release.md. No paths filter: a required check must always report.
name: release-gate

on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]
    branches: ['release/**']

concurrency:
  group: release-gate-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read
  issues: read
  pull-requests: write

jobs:
  release-gate:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    outputs:
      platforms: ${{ steps.gate.outputs.platforms }}
      fingerprints: ${{ steps.gate.outputs.fingerprints }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
      - uses: ./.github/actions/setup
      - id: gate
        run: node scripts/ci/gate.ts
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN_PREVIEW }}
          GH_TOKEN: ${{ github.token }}

  preview:
    needs: release-gate
    if: needs.release-gate.outputs.platforms != '[]'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: ./.github/actions/setup
      - run: node scripts/ci/preview.ts
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN_PREVIEW }}
          GH_TOKEN: ${{ github.token }}
          PLATFORMS: ${{ needs.release-gate.outputs.platforms }}
          FINGERPRINTS: ${{ needs.release-gate.outputs.fingerprints }}
```

- [ ] **Step 3: `.github/workflows/ota-production.yml`**

```yaml
# Production OTA publishing: after a labelled PR merges into a release branch, or by
# hand. See docs/release.md.
name: ota-production

on:
  push:
    branches: ['release/**']
  workflow_dispatch:
    inputs:
      platforms:
        description: Platforms to publish
        type: choice
        options: [ios, android, both]
        required: true
      message:
        description: Update message (defaults to the branch and commit)
        type: string
        required: false

permissions:
  contents: read
  issues: read
  pull-requests: write

jobs:
  resolve:
    if: startsWith(github.ref, 'refs/heads/release/')
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      platforms: ${{ steps.resolve.outputs.platforms }}
      message: ${{ steps.resolve.outputs.message }}
      pr: ${{ steps.resolve.outputs.pr }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
      - id: resolve
        run: node scripts/ci/publish.ts resolve
        env:
          GH_TOKEN: ${{ github.token }}
          INPUT_PLATFORMS: ${{ inputs.platforms }}
          INPUT_MESSAGE: ${{ inputs.message }}

  publish:
    needs: resolve
    if: needs.resolve.outputs.platforms != '[]'
    strategy:
      fail-fast: false
      matrix:
        platform: ${{ fromJSON(needs.resolve.outputs.platforms) }}
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment: production-${{ matrix.platform }}
    concurrency:
      group: ota-production-${{ github.ref_name }}-${{ matrix.platform }}
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: ./.github/actions/setup
      - run: node scripts/ci/publish.ts run
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN_PRODUCTION }}
          GH_TOKEN: ${{ github.token }}
          PLATFORM: ${{ matrix.platform }}
          MESSAGE: ${{ needs.resolve.outputs.message }}
          PR_NUMBER: ${{ needs.resolve.outputs.pr }}
          EAS_ACCOUNT: tovmassian27
```

- [ ] **Step 4: `.github/workflows/ota-rollback.yml`**

```yaml
# Roll back an OTA update. Production rollbacks open a freeze first. Start with
# dry_run. See docs/release.md.
name: ota-rollback

on:
  workflow_dispatch:
    inputs:
      platforms:
        type: choice
        options: [ios, android, both]
        required: true
      channel:
        type: choice
        options: [production, preview]
        default: production
      mode:
        type: choice
        options: [previous, group, embedded]
        default: previous
      group_id:
        description: Group to republish (mode group only)
        type: string
        required: false
      reason:
        description: Why; goes into the update message and the freeze issue
        type: string
        required: true
      dry_run:
        description: Show what would happen without changing anything
        type: boolean
        default: false

permissions:
  actions: read
  contents: read
  issues: write

jobs:
  production:
    if: inputs.channel == 'production' && startsWith(github.ref, 'refs/heads/release/')
    strategy:
      fail-fast: false
      matrix:
        platform: ${{ fromJSON(inputs.platforms == 'both' && '["ios","android"]' || format('["{0}"]', inputs.platforms)) }}
    runs-on: ubuntu-latest
    timeout-minutes: 45
    environment: production-${{ matrix.platform }}
    concurrency:
      group: ota-rollback-${{ github.ref_name }}-${{ matrix.platform }}
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: ./.github/actions/setup
      - run: node scripts/ci/rollback.ts
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN_PRODUCTION }}
          GH_TOKEN: ${{ github.token }}
          PLATFORM: ${{ matrix.platform }}
          CHANNEL: production
          MODE: ${{ inputs.mode }}
          GROUP_ID: ${{ inputs.group_id }}
          REASON: ${{ inputs.reason }}
          DRY_RUN: ${{ inputs.dry_run }}

  preview:
    if: inputs.channel == 'preview' && startsWith(github.ref, 'refs/heads/release/')
    strategy:
      fail-fast: false
      matrix:
        platform: ${{ fromJSON(inputs.platforms == 'both' && '["ios","android"]' || format('["{0}"]', inputs.platforms)) }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: ./.github/actions/setup
      - run: node scripts/ci/rollback.ts
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN_PREVIEW }}
          GH_TOKEN: ${{ github.token }}
          PLATFORM: ${{ matrix.platform }}
          CHANNEL: preview
          MODE: ${{ inputs.mode }}
          GROUP_ID: ${{ inputs.group_id }}
          REASON: ${{ inputs.reason }}
          DRY_RUN: ${{ inputs.dry_run }}
```

- [ ] **Step 5: `.github/workflows/store-build.yml`**

```yaml
# Store and preview builds from a release branch. The first production build of a
# version locks it. See docs/release.md.
name: store-build

on:
  workflow_dispatch:
    inputs:
      platforms:
        type: choice
        options: [ios, android, both]
        required: true
      profile:
        type: choice
        options: [production, preview]
        default: production
      submit:
        description: Upload to App Store Connect / Play after building (production only)
        type: boolean
        default: true
      rebuild:
        description: Build again on an already-locked runtime (production only)
        type: boolean
        default: false

permissions:
  contents: read
  issues: write

jobs:
  production:
    if: inputs.profile == 'production' && startsWith(github.ref, 'refs/heads/release/')
    strategy:
      fail-fast: false
      matrix:
        platform: ${{ fromJSON(inputs.platforms == 'both' && '["ios","android"]' || format('["{0}"]', inputs.platforms)) }}
    runs-on: ubuntu-latest
    timeout-minutes: 240
    environment: production-${{ matrix.platform }}
    concurrency:
      group: store-build-${{ github.ref_name }}-${{ matrix.platform }}
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: ./.github/actions/setup
      - run: npm run check
      - run: node scripts/ci/build.ts
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN_PRODUCTION }}
          GH_TOKEN: ${{ github.token }}
          PLATFORM: ${{ matrix.platform }}
          PROFILE: production
          SUBMIT: ${{ inputs.submit }}
          REBUILD: ${{ inputs.rebuild }}
          EAS_ACCOUNT: tovmassian27

  preview:
    if: inputs.profile == 'preview' && startsWith(github.ref, 'refs/heads/release/')
    strategy:
      fail-fast: false
      matrix:
        platform: ${{ fromJSON(inputs.platforms == 'both' && '["ios","android"]' || format('["{0}"]', inputs.platforms)) }}
    runs-on: ubuntu-latest
    timeout-minutes: 240
    concurrency:
      group: store-build-preview-${{ github.ref_name }}-${{ matrix.platform }}
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: ./.github/actions/setup
      - run: node scripts/ci/build.ts
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN_PREVIEW }}
          GH_TOKEN: ${{ github.token }}
          PLATFORM: ${{ matrix.platform }}
          PROFILE: preview
          SUBMIT: 'false'
          REBUILD: 'false'
          EAS_ACCOUNT: tovmassian27
```

- [ ] **Step 6: Add actionlint to `.github/workflows/check.yml`**

Append to the `check` job's `steps`, after `- run: npm run check`:

```yaml
- name: Lint workflows
  uses: docker://rhysd/actionlint:1.7.12
  with:
    args: -color
```

- [ ] **Step 7: Lint the workflows locally**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color`
Expected: no output, exit 0. (Without Docker, skip this step: the `check` job runs it on the PR.)

- [ ] **Step 8: Format, check, commit**

```bash
npx prettier --write .github && npm run check
git add .github
git commit -m "ci: release-gate, ota-production, ota-rollback and store-build workflows (#73)"
```

---

### Task 16: The pipeline in `docs/release.md`

**Files:**

- Modify: `docs/release.md`

- [ ] **Step 1: Replace the "Start here" placeholder paragraph**

Replace

```markdown
The release pipeline (#73) is being built. Until it lands, releases are manual: follow
[Manual procedures](#manual-procedures).
```

with

```markdown
| I want to…                            | Go to                                                     |
| ------------------------------------- | --------------------------------------------------------- |
| Ship a JS fix to a released version   | [Ship a JS fix](#ship-a-js-fix)                           |
| Ship a new binary                     | [Cut a release](#cut-a-release)                           |
| Undo an update                        | [Roll back](#roll-back)                                   |
| Keep updates away from a store review | [Freeze during store review](#freeze-during-store-review) |
```

- [ ] **Step 2: Add the rules to "Branches"**

After the paragraph that starts `**Flow.**`, add:

```markdown
**Rules.** GitHub rulesets make `main` and `release/*` take changes only by PR, forbid
deleting or force-pushing them, and require the `check` job. `release/*` also requires
`release-gate` and refuses squash merges: a sync needs a real merge commit, and a rebase
keeps each cherry-pick's `-x` line. An admin may merge a PR into `main` past a red check;
nobody can on `release/*`.
```

- [ ] **Step 3: Insert "Procedures" before "## Reference"**

```markdown
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

A new version from `main` (1.1.0):

1. The `app.json` version bump and `fingerprint.config.js` land on `main` by PR.
2. Cut the branch: `git push origin origin/main:refs/heads/release/1.1.0`. Fixes found
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

`git switch -c sync/main-into-1.1.0 origin/release/1.1.0 && git merge origin/main`, resolve,
push, and open a PR into `release/1.1.0`; merge it with a merge commit. `release-gate`
refuses this once the branch is locked.
```

- [ ] **Step 4: Add "Workflows" at the top of "## Reference"**

Insert directly under `## Reference`:

```markdown
### Workflows

| Workflow         | Runs on                                   | Does                                            | Token and environment                              |
| ---------------- | ----------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `release-gate`   | Every PR into `release/*`                 | Fingerprint verdict (required); preview publish | `EXPO_TOKEN_PREVIEW`                               |
| `ota-production` | Push to `release/*` (a merged PR); manual | Production publish per labelled platform        | `EXPO_TOKEN_PRODUCTION` in `production-<platform>` |
| `ota-rollback`   | Manual                                    | Roll back production or preview                 | production runs in `production-<platform>`         |
| `store-build`    | Manual                                    | Production or preview build, optional submit    | production runs in `production-<platform>`         |

Both environments accept only `release/*` branches, and the `production` channel is
protected so only the Admin token can publish to it. The logic lives in `scripts/ci/`,
tested by `npm run check`. To see the gate's verdict before opening a PR, from a checkout of
the branch you would merge:
`EAS_CLI="npx --yes eas-cli@24.7.0" node scripts/ci/gate.ts --base release/1.0.0 --dry-run`.
```

- [ ] **Step 5: Make the manual section the fallback**

Replace the heading `### Manual procedures` with `### Manual fallback (when Actions is down)`, and its first sentence `From a clean checkout of the release branch, one platform per command (`--platform`defaults to`all`):` with `Do what the workflows do, from a clean checkout of the release branch, one platform per command (`--platform`defaults to`all`), and respect open freezes:`.

- [ ] **Step 6: Add the workflow messages to "Troubleshooting"**

Insert these rows directly under the table's header separator:

```markdown
| ❌ runtime changed | The PR changes something in the left column of [OTA or store build?](#ota-or-store-build); the comment's details say what. Drop it, or put it on a new version. |
| ❌ brings commits from `main` | The branch was cut from `main` or merged it. Re-cut it from the release branch and cherry-pick. |
| ❌ wait for the build | A production build of this version is running; re-run the check after it finishes. |
| Preview skipped: no preview build on runtime … | [Cut preview builds](#cut-preview-builds). |
| Frozen by #N | Close the freeze when the review passes, then **Re-run failed jobs**. |
| 🚨 … reaches nobody / runner and EAS disagree | Shouldn't happen after the checks. Roll back if something shipped, then investigate before publishing again. |
```

- [ ] **Step 7: Check anchors and format**

Run: `grep -n "](#" docs/release.md`
Expected: every anchor is one of `#start-here`, `#ship-a-js-fix`, `#cut-a-release`, `#roll-back`, `#freeze-during-store-review`, `#troubleshooting`, `#ota-or-store-build`, `#cut-preview-builds`, and each matches a heading.

Run: `npx prettier --write docs/release.md && npm run check`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add docs/release.md
git commit -m "docs(release): procedures and reference for the pipeline (#73)"
```

---

### Task 17: Dry run against `release/1.0.0`, then the PR to `main`

- [ ] **Step 1: Dry-run the gate from a checkout of `release/1.0.0`**

```bash
SCRATCH=$(mktemp -d)
git worktree add --detach "$SCRATCH/r100" origin/release/1.0.0
cd "$SCRATCH/r100" && npm ci --no-audit --no-fund
git -C "$SCRATCH/r100" checkout ci/73-pipeline-code -- scripts/ci
EAS_CLI="npx --yes eas-cli@24.7.0" node scripts/ci/gate.ts --base release/1.0.0 --dry-run
```

Expected: a table with `| iOS | locked | build 3 · \`8b8b8840\` | \`8b8b8840\` | ✅ OTA-compatible |`and the same for Android with`a616db89`, and no ❌ line.

- [ ] **Step 2: Clean up**

```bash
cd - && git worktree remove --force "$SCRATCH/r100"
```

- [ ] **Step 3: Open the PR** (confirm first)

```bash
git push -u origin ci/73-pipeline-code
gh pr create --base main --title "ci: release pipeline — gate, preview, production, rollback, store builds (#73)" \
  --body "Implements docs/superpowers/plans/2026-09-23-release-pipeline.md, Phase 3. Nothing here moves the fingerprint: files under .github/ and scripts/ci/ only. Dry run against release/1.0.0: iOS 8b8b8840 ✅, Android a616db89 ✅."
```

Expected: `check` passes, including actionlint. The owner merges with **Squash and merge**, so Phase 4 cherry-picks one commit.

---

## Phase 4 — Rollout (spec §14, steps 4–8)

### Task 18: The pipeline on its own introduction PR; the `release/*` ruleset

- [ ] **Step 1: Cherry-pick the squashed pipeline commit onto `release/1.0.0`**

```bash
git fetch origin
CODE=$(git log origin/main -1 --format=%H -- scripts/ci/gate.ts)
git switch -c ci/pipeline-1.0.0 origin/release/1.0.0
git cherry-pick -x "$CODE"
npm ci
for p in ios android; do npx expo-updates fingerprint:generate --platform $p | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).hash+"\n"))'; done
```

Expected: `8b8b8840bd6e265b91976ef4690a9ef5cb632508` then `a616db8911b507fe2e4b9502b1d48e24a397a84b`. Stop if either differs.

- [ ] **Step 2: Open the PR and read the gate** (confirm first)

```bash
npm run check
git push -u origin ci/pipeline-1.0.0
gh pr create --base release/1.0.0 --title "ci: release pipeline on release/1.0.0 (#73)" --body "Cherry-pick of the pipeline from main. No ota:* label: nothing is published."
gh pr checks --watch
```

Expected: `release-gate` passes, and its comment shows iOS `8b8b8840` ✅ and Android `a616db89` ✅ computed on a Linux runner: the runner-vs-Mac question, answered. The owner merges with **Rebase and merge**. The `ota-production` run for that push ends with "has no ota:* label: nothing to publish." If it says "No merged PR behind" instead, GitHub didn't associate the rebased commit with its PR (spec §12): switch `resolve` to reading the PR number from the push payload's commit messages before any labelled PR merges.

- [ ] **Step 3: Switch on the `release/*` ruleset** (confirm first)

```bash
gh api -X POST repos/tovmassian/escuadra/rulesets --input - <<'EOF'
{
  "name": "release branches",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/release/*"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": false, "allowed_merge_methods": ["merge", "rebase"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "check" }, { "context": "release-gate" }] } }
  ],
  "bypass_actors": []
}
EOF
```

Expected: JSON with `"name": "release branches"` and `"enforcement": "active"`.

---

### Task 19: Preview builds for 1.0.0

- [ ] **Step 1: Run store-build for preview** (confirm first: one iOS and one Android build from the Free quota)

```bash
gh workflow run store-build.yml --ref release/1.0.0 -f platforms=both -f profile=preview -f submit=false -f rebuild=false
gh run watch "$(gh run list --workflow store-build.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

Expected: both jobs succeed; each summary says `runtime \`8b8b8840\` ✅ matches the runner`(iOS) or`\`a616db89\`` (Android).

- [ ] **Step 2: Settle spec §12's first question while the builds are queued or running**

```bash
npx eas-cli build:list --platform ios --build-profile preview --limit 1 --json --non-interactive \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const [b]=JSON.parse(s);process.stdout.write(JSON.stringify({status:b.status,runtime:b.runtime?.version??null,fingerprint:b.fingerprint?.hash??null})+"\n")})'
```

Expected: a status of `NEW`, `IN_QUEUE` or `IN_PROGRESS`, with or without a runtime. Record the answer in the #73 thread: with a runtime, an unfinished production build locks at once; without one, the gate reports "wait for the build" during a cut — the designed fallback, so nothing changes either way.

- [ ] **Step 3: 👤 Install both preview builds** from the build pages in the summaries. On Android, uninstall the Play version first.

---

### Task 20: First real OTA through the pipeline

Prerequisite: an issue for the About update-ID fix (show `Updates.updateId` on About). It is separate work: if none exists, create one with the `escuadra-issue-creator` skill and implement it through its own plan, on `fix/about-update-id` cut from `origin/release/1.0.0`.

- [ ] **Step 1: PR into `release/1.0.0` with both labels**

```bash
git push -u origin fix/about-update-id
gh pr create --base release/1.0.0 --title "fix: show the update ID on About" --body "Closes #<issue>." --label ota:ios --label ota:android
```

Expected: `release-gate` ✅ for both platforms; the `preview` job fills the comment with an iOS and an Android group.

- [ ] **Step 2: 👤 Verify on the preview builds:** open the app, wait, close fully, open again. About shows the update ID from the comment.

- [ ] **Step 3: Merge** (the owner, **Rebase and merge**). Expected: `ota-production` publishes both platforms, and each job's PR comment says `✅ matches build 3`. If `eas update` fails with a permission error on the protected channel, the Admin robot can't publish there (spec §12): store the owner's personal token as `EXPO_TOKEN_PRODUCTION` in both environments instead, and re-run the failed jobs.

- [ ] **Step 4: 👤 Verify on store installs** (launch twice), and check EAS: `npx eas-cli update:list --branch production --limit 3` shows the new groups on `8b8b8840` and `a616db89`.

- [ ] **Step 5: Take the fix to `main`** (confirm first): `git switch -c fix/about-update-id-main origin/main && git cherry-pick -x <the fix's commits>`, resolve (About carries the telemetry opt-out on `main`), then a PR into `main`.

---

### Task 21: Failure drills

- [ ] **Step 1: A runtime change is refused**

```bash
git switch -c drill/npm-script origin/release/1.0.0
npm pkg set scripts.drill="echo drill"
git commit -am "drill: add an npm script (do not merge)"
git push -u origin drill/npm-script
gh pr create --base release/1.0.0 --title "drill: runtime change (do not merge)" --body "Expect release-gate to fail."
```

Expected: `release-gate` fails; the comment shows ❌ for both platforms and "package.json scripts" in the details. Then: `gh pr close drill/npm-script --delete-branch`.

- [ ] **Step 2: A freeze blocks, and lifting it releases**

```bash
gh issue create --label ota-freeze --title "OTA freeze: ios@1.0.0" --body "Drill (#73)."
gh workflow run ota-production.yml --ref release/1.0.0 -f platforms=ios
```

Expected: the job fails with "Frozen by #N". Close the issue, then re-run the failed job:

```bash
RUN=$(gh run list --workflow ota-production.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run rerun "$RUN" --failed
```

Expected: the job ends `skipped` with "already came from" and the head commit — the freeze lifted and the duplicate guard held.

- [ ] **Step 3: Nothing runs from `main`**

Run: `gh workflow run ota-production.yml --ref main -f platforms=ios`
Expected: the run's `resolve` and `publish` jobs are skipped; nothing reaches EAS.

- [ ] **Step 4: Rollback drill on preview**

```bash
gh workflow run ota-rollback.yml --ref release/1.0.0 -f platforms=ios -f channel=preview -f mode=previous -f reason="drill (#73)" -f dry_run=true
gh workflow run ota-rollback.yml --ref release/1.0.0 -f platforms=ios -f channel=preview -f mode=previous -f reason="drill (#73)" -f dry_run=false
```

Expected: the dry run's summary shows from → to and "Dry run: nothing changed"; the real run's shows a new group ✅ and "Preview rollback: no freeze". No issue is opened.

---

### Task 22: Final docs and closing #73

- [ ] **Step 1: Bring `docs/release.md` up to date** — the "Start here" table (store statuses as of today) and anything the drills showed to be wrong. Commit on `main` by PR, then cherry-pick to `release/1.0.0` as in Task 3.

- [ ] **Step 2: Update the agent memory notes** that describe the old process (`ota-from-release-branch`, `eas-builds-via-github-actions`): OTAs and builds now go through the workflows in `docs/release.md`.

- [ ] **Step 3: Close #73** with a comment listing what shipped, the drill results, and the follow-ups: splitting the rest of CLAUDE.md, and 1.1.0 (#60) as `store-build`'s first production use.
