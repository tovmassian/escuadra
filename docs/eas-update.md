# EAS Update: store build or over-the-air?

How Escuadra ships changes after a binary is in users' hands: how to decide
whether a change needs a **new store build** or can go out as an **over-the-air
(OTA) update**, how to prove the decision before publishing, and how to publish
and verify step by step. The last section sets the rules for automating this
with GitHub Actions ahead of 1.1.0.

Verified on 2026-09-16 against Expo SDK 57.0.22, `expo-updates` 57.0.22,
`@expo/fingerprint` 0.20.13 and `eas-cli` 24.0.0. If any of those move, re-run
the experiment in [What moves the fingerprint](#what-moves-the-fingerprint)
before trusting the table.

---

## The short version

1. **The fingerprint decides, not your judgement.** An update only reaches builds
   whose runtime version equals the fingerprint computed when you publish.
   Before publishing, run:

   ```bash
   npx eas-cli fingerprint:compare --build-id <store-build-id> --environment production
   ```

   ✅ match → the change can go OTA. ❌ mismatch → it needs a new store build, or
   you are publishing from the wrong branch.

2. **`eas update` never warns about a mismatch.** It prints `✔ Published!` and
   the update silently reaches nobody. That happened on 2026-09-16 (see
   [Troubleshooting](#published-but-it-never-arrives)).

3. **Publish OTA updates for a shipped version from its release branch**
   (`release/1.0.0`), not from `main`. `main` keeps moving, and harmless-looking
   commits (a new npm script, a `.gitignore` line) change the fingerprint.

4. **The fingerprint can't see everything.** A pure-JS change that alters what
   data leaves the device still needs a store build (guardrail 4 in
   `CLAUDE.md`). So does publishing while a store review is in flight: don't.

---

## How updates work in this project

| Piece           | Setting                                                                           | Where          |
| --------------- | --------------------------------------------------------------------------------- | -------------- |
| Build profiles  | `development`, `ios-simulator`, `preview`, `production`                           | `eas.json`     |
| Channel         | Same name as the profile. A build only receives updates on its own channel        | `eas.json`     |
| Runtime version | `{ "policy": "fingerprint" }`, a hash of the native runtime computed per platform | `app.json`     |
| Update check    | `checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0` (defaults)             | `expo-updates` |
| Build numbers   | `appVersionSource: "remote"`, `autoIncrement: true` on `production`               | `eas.json`     |

**Delivery rule.** A device gets an update only when all three match:

```
build's channel  == update's branch/channel   (production)
build's platform == update's platform         (android | ios)
build's runtime  == update's runtime version  (the fingerprint)
```

**Timing.** On launch the app checks for an update without blocking startup,
downloads it in the background, and applies it on the **next cold start**.
Checking by hand therefore means: fully close → open (downloads) → fully close →
open (applied).

**Where it doesn't run.** `expo-updates` does nothing in Expo Go and in
development builds. Expo Go showing your change proves the code works, not that
the update was delivered. Test delivery on an internal-testing, TestFlight or
`preview` build.

---

## What moves the fingerprint

`@expo/fingerprint` hashes a list of **sources**. To see exactly what's in it:

```bash
npx expo-updates fingerprint:generate --platform android --debug > /tmp/fp.json
```

### The tested matrix

Each row changed one thing on `release/1.0.0` (baseline android `a616db89`, ios
`8b8b8840`), recomputed both fingerprints and put the file back.

| Change                                                                  | Android | iOS     | Meaning                      |
| ----------------------------------------------------------------------- | ------- | ------- | ---------------------------- |
| Edit JS/TS code (`app/about.tsx`)                                       | same    | same    | OTA                          |
| Edit theme tokens (`theme/tokens.ts`)                                   | same    | same    | OTA                          |
| Edit squad data (`data/players.json`)                                   | same    | same    | OTA                          |
| Change an in-app image (`assets/flags/*.png`)                           | same    | same    | OTA                          |
| Edit `package-lock.json`                                                | same    | same    | —                            |
| Edit a dependency's version in `package.json` **without installing**    | same    | same    | nothing actually changed yet |
| Upgrade a **JS-only** package in `node_modules` (`zustand`)             | same    | same    | OTA                          |
| Upgrade a **native** package in `node_modules` (`expo-haptics` version) | CHANGED | CHANGED | store build                  |
| Change a native package's Android code only                             | CHANGED | same    | Android store build          |
| `app.json` → `version` `1.0.0` → `1.0.1`                                | CHANGED | CHANGED | store build                  |
| `app.json` → `name`                                                     | CHANGED | CHANGED | store build                  |
| `app.json` → `userInterfaceStyle`                                       | CHANGED | CHANGED | store build                  |
| `app.json` → splash `backgroundColor`                                   | CHANGED | CHANGED | store build                  |
| `app.json` → add a config plugin                                        | CHANGED | CHANGED | store build                  |
| App icon bytes (`assets/images/icon.png`)                               | CHANGED | CHANGED | store build                  |
| Android adaptive icon foreground bytes                                  | CHANGED | same    | Android store build          |
| `eas.json` → add a profile                                              | CHANGED | CHANGED | store build                  |
| `.gitignore` → add a line                                               | CHANGED | CHANGED | ⚠️ false positive            |
| `package.json` → add an npm script                                      | CHANGED | CHANGED | ⚠️ false positive            |

### Why bumping packages sometimes left the hash unchanged

Two findings in that table explain it. The fingerprint was working correctly both
times:

- **`package.json` dependency versions are not an input; `node_modules` is.**
  Changing `"expo-haptics": "~15.0.0"` to `"~16.0.0"` does nothing until
  `npm install` (or `npx expo install`) actually changes the installed package.
  Always compute the fingerprint **after installing**.
- **JS-only packages are not inputs at all.** Only packages that autolink native
  code or ship a config plugin are hashed. Upgrading `zustand`, `date-fns` or a
  pure-JS UI library is correctly an OTA change.

### Where the fingerprint and Expo's docs disagree

Expo's fingerprint docs list `ExpoConfigVersions` (skip `version`) and
`ExpoConfigNames` among the default skips. In this project, changing either
changed the hash anyway. Trust the experiment over the docs: **bumping the
marketing version starts a new runtime.** That's harmless, since a new version
means a new store build regardless.

### False positives: npm scripts and `.gitignore`

Neither affects the native app, but both are inputs by default. Commit `3b66b670`
added two npm scripts and a `design/play/` line, which moved `main` off the
runtime of every shipped 1.0.0 binary.

This can be fixed with a `fingerprint.config.js`
(`sourceSkips: ['PackageJsonScriptsAll', 'GitIgnore']`), but the fix **is itself
a fingerprint change**: it only helps builds made after it. Add it in the same
PR that cuts the next store build, never between a build and its updates.
**Not applied yet.**

---

## Store build or OTA?

The fingerprint answers "can the binary run this JavaScript?". The rest of the
table covers what it can't know.

| Change                                                                                                  | Path                                                                               | Enforced by           |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------- |
| JS/TS logic, screens, layout, styles, theme tokens                                                      | OTA                                                                                | fingerprint           |
| Squad data, question engine, copy (including About text)                                                | OTA                                                                                | fingerprint           |
| In-app images bundled by Metro (flags)                                                                  | OTA                                                                                | fingerprint           |
| JS-only npm package added or upgraded                                                                   | OTA                                                                                | fingerprint           |
| Native package added, removed or upgraded                                                               | **Store build**                                                                    | fingerprint           |
| Expo SDK or React Native upgrade                                                                        | **Store build**                                                                    | fingerprint           |
| Anything in `app.json`: version, name, plugins, splash, icons, permissions                              | **Store build**                                                                    | fingerprint           |
| `eas.json`                                                                                              | **Store build**                                                                    | fingerprint           |
| **What data leaves the device**: analytics, crash reporting, a new endpoint, a new SDK, even if pure JS | **Store build**, with privacy policy, App Privacy and Data safety updated together | **you** (guardrail 4) |
| Anything while a store review is in flight on that platform                                             | **Wait**                                                                           | **you**               |
| Store listing text, screenshots, the web privacy page                                                   | Neither: Play Console / App Store Connect / `gh-pages`                             | —                     |

---

## Branches: one release branch per shipped version

`main` is where development happens; its fingerprint drifts. A shipped binary
needs a branch whose fingerprint stays equal to that binary's.

```
main ──●(4ee49b31: ios #3)──●(c5633fbc: android #3)──●(3b66b670: scripts + .gitignore)──●──▶
                              │
                              └── release/1.0.0 ──●(cherry-picked JS fixes)──▶  ← publish OTAs from here
```

The iOS 1.0.0 binary was built from `4ee49b31`, but only JS changed between
that commit and `c5633fbc`. `release/1.0.0` therefore matches **both** shipped
binaries (android `a616db89`, ios `8b8b8840`). Verify that with
`fingerprint:compare`; don't assume it for future versions.

**Rules**

1. When a store build is cut, create `release/<version>` at the build's commit
   (`gitCommitHash` in `eas build:view <id> --json`) and push it.
2. A JS fix lands on `main` by PR as usual, then is cherry-picked onto the
   release branch (`git cherry-pick -x <sha>`).
3. OTA updates for that version are published **only** from the release branch.
4. When the next version ships to all users, the old release branch is frozen.

⚠️ Today `release/1.0.0` exists **only locally** (`c5633fbc` + the #61 About
text). Push it so it isn't lost and CI can use it.

---

## Step by step: publishing an OTA update

Example: publishing a JS-only fix to Android production for 1.0.0.

### 1. Preflight

- [ ] No store review is in flight on the target platform: App Store review, Beta
      App Review, or a Play closed-test / production review.
- [ ] The change doesn't alter what data leaves the device.
- [ ] The fix is merged on `main`.

### 2. Get onto the release branch with the fix

```bash
git switch release/1.0.0
git cherry-pick -x <sha-from-main>
npm ci
```

`npm ci` makes `node_modules` match the lockfile. A stale or newer local
`node_modules` changes the fingerprint.

### 3. Find the store build you're targeting

```bash
npx eas-cli build:list --platform android --build-profile production --status finished --limit 3
```

Note its **ID** and **runtime version**.

### 4. Prove the fingerprint matches

```bash
npx eas-cli fingerprint:compare --build-id <build-id> --environment production
```

Expected:

```
✅ Fingerprint a616db89… from ANDROID build matches fingerprint a616db89… from local directory
```

If it doesn't match, **stop**. Either you're on the wrong branch or
`node_modules` differs (re-run `npm ci`), or the change really does need a store
build. For a detailed diff, add `--open` to view it in the browser.

### 5. Publish, one platform at a time

```bash
npx eas-cli update --channel production --platform android --environment production --message "<what changed> (#issue)"
```

- Always pass `--platform`: it defaults to `all`, which includes a platform that
  may be in review.
- Pass `--environment production` so there's no interactive prompt. It's required
  in CI, and `production` is the right value for the `production` profile.

In the output, **check that `Runtime version` equals the build's runtime
version**. Note the update group ID.

### 6. Verify on EAS

```bash
npx eas-cli update:list --branch production --limit 3
npx eas-cli fingerprint:compare --build-id <build-id> --update-id <android-update-id>
```

The second command must print ✅ for build vs update.

### 7. Verify on a device

1. Use an installed store or internal-testing build, not Expo Go.
2. Fully close the app, open it, and wait a few seconds with a connection.
3. Fully close it again and reopen: the change is now visible.

### 8. If it's bad: roll back

```bash
npx eas-cli update:roll-back-to-embedded --channel production --platform android --runtime-version <runtime>
```

Devices go back to the JavaScript embedded in the binary after the usual
download-then-apply cycle. Or republish a previous good update group:

```bash
npx eas-cli update:republish --group <group-id> --platform android
```

For a risky change, `eas update --rollout-percentage 10` publishes to a fraction
of devices first.

### 9. Switch back

```bash
git switch main
```

---

## Step by step: shipping a store build

1. Bump `version` in `app.json` for a user-visible release. Build numbers are
   incremented remotely by EAS.
2. If this build should include `fingerprint.config.js` or any other fingerprint
   configuration change, commit it **now**, before building.
3. Build:

   ```bash
   npx eas-cli build --profile production --platform android
   ```

4. Record the new build's fingerprint:

   ```bash
   npx eas-cli build:view <build-id> --json
   ```

   Look at `runtime.version` and `gitCommitHash`.

5. Create and push the release branch at that commit:

   ```bash
   git branch release/<version> <gitCommitHash>
   git push -u origin release/<version>
   ```

6. Submit, and **stop publishing to that platform's `production` channel** until
   review ends.
7. After approval, OTAs for this version come from `release/<version>`.

---

## Verification reference

| Question                                   | Command                                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What runtime would I publish to right now? | `npx expo-updates fingerprint:generate --platform android`                                                                                                           |
| What's inside that hash?                   | same command with `--debug`                                                                                                                                          |
| Does my working tree match a build?        | `npx eas-cli fingerprint:compare --build-id <id> --environment production`                                                                                           |
| Does an update match a build?              | `npx eas-cli fingerprint:compare --build-id <id> --update-id <update-id>`                                                                                            |
| Which build has this runtime?              | `npx eas-cli build:list --fingerprint-hash <hash> --platform android --status finished`                                                                              |
| What runtime/commit is a build on?         | `npx eas-cli build:view <id> --json` → `runtime.version`, `gitCommitHash`                                                                                            |
| What's published on production?            | `npx eas-cli update:list --branch production --limit 5`                                                                                                              |
| What's running on a device?                | `expo-updates` in JS: `Updates.runtimeVersion`, `Updates.updateId`, `Updates.channel`, `Updates.isEmbeddedLaunch` (`isEmbeddedLaunch: true` means no OTA is running) |

The About screen currently shows only `version (build)`. Adding
`Updates.updateId` (short) there would make on-device checks instant. That's a
JS-only change.

---

## Troubleshooting

### Published, but it never arrives

The runtime version of the update doesn't match the build. On 2026-09-16 an
update was published from `main` to runtime `c0a62aca…` while Android build 3 is
`a616db89…`. The cause was commit `3b66b670` adding npm scripts and a
`.gitignore` line.

Fix: publish from the release branch after `fingerprint:compare` shows ✅. The
orphaned update is harmless; it reaches nobody.

### It shows in Expo Go but not on the phone

Expected. Expo Go runs your local bundle and ignores runtime versions. See
[How updates work](#how-updates-work-in-this-project).

### The phone still shows the old version after one launch

Updates apply on the **next** cold start. Close fully and reopen once more.

### `? Select environment` prompt

`eas update` asks which EAS environment to load variables from. Choose
`production`, or pass `--environment production`. Escuadra has no EAS
environment variables today, so the choice doesn't affect the bundle, but CI
must pass the flag.

### `Commit abc1234*` in the publish output

The `*` means the working tree had uncommitted or untracked files. Only
fingerprint inputs matter (the matrix above), but prefer publishing from a clean
tree so the commit recorded on EAS is exactly what shipped.

---

## Automating with GitHub Actions (planned for 1.1.0)

Not implemented yet. These are the constraints the workflow must respect, so
automation can't repeat any of the manual mistakes above.

### Principles

1. **CI publishes, never decides.** The job publishes only when the fingerprint
   of the checked-out commit matches an existing finished `production` build for
   that platform. Otherwise it **fails**: it doesn't publish, and it doesn't
   start a build.
2. **Release branches only.** Trigger on `release/**` (push or manual
   `workflow_dispatch`), never on `main`.
3. **One platform per run**, chosen explicitly. No `--platform all`.
4. **Review freeze is enforced, not remembered.** Use a GitHub Environment per
   platform (`production-android`, `production-ios`) with required reviewers, or
   a repository variable such as `IOS_IN_REVIEW=true` that the job checks before
   publishing.
5. **Reproducible install.** `npm ci` on Node 24 (`.nvmrc`), so `node_modules`,
   and therefore the fingerprint, match the lockfile.
6. **Non-interactive.** `EXPO_TOKEN` secret, `--non-interactive`,
   `--environment production`.
7. **Guardrail 4 stays human.** A privacy-affecting change is never published by
   CI; it waits for a store build.

### Building blocks (verified to exist)

- `expo/expo-github-action@v9` sets up `eas-cli` and authenticates with
  `token: ${{ secrets.EXPO_TOKEN }}`. Set `packager: npm`, because the default
  is `yarn`.
- `expo/expo-github-action/continuous-deploy-fingerprint-info@v9` outputs
  `android-fingerprint` / `ios-fingerprint` and `android-build-id` /
  `ios-build-id` for a **matching** build (empty when none exists). This is the
  gate.
- `expo/expo-github-action/continuous-deploy-fingerprint@v9` does both: it
  **starts a new EAS build** when no matching build exists, otherwise publishes
  an update. The automatic build would skip the store-build decision, review
  timing and guardrail 4, so **don't use it for `production`**. It may suit
  `preview`.
- Without the actions:
  `eas build:list --fingerprint-hash <hash> --platform android --status finished --build-profile production --json --non-interactive`
  returns the matching build(s). Verified with `a616db89` → Android build 3.

### Sketch

```yaml
# .github/workflows/ota-production.yml  (sketch, not yet in the repo)
name: OTA → production
on:
  workflow_dispatch:
    inputs:
      platform:
        type: choice
        options: [android, ios]
        required: true
      message:
        type: string
        required: true

concurrency: ota-production-${{ inputs.platform }}

jobs:
  publish:
    if: startsWith(github.ref, 'refs/heads/release/')
    runs-on: ubuntu-latest
    environment: production-${{ inputs.platform }} # required reviewers = review-freeze gate
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - uses: expo/expo-github-action@v9
        with:
          eas-version: latest
          packager: npm
          token: ${{ secrets.EXPO_TOKEN }}

      - id: fp
        uses: expo/expo-github-action/continuous-deploy-fingerprint-info@v9
        with:
          profile: production
          platform: ${{ inputs.platform }}
          environment: production

      - name: Require a matching store build
        env:
          build_id: ${{ inputs.platform == 'android' && steps.fp.outputs.android-build-id || steps.fp.outputs.ios-build-id }}
        run: |
          if [ -z "$build_id" ]; then
            echo "::error::No finished production build matches this fingerprint. This change needs a store build."
            exit 1
          fi
          echo "Matches build $build_id"

      - name: Publish
        env:
          PLATFORM: ${{ inputs.platform }}
          MESSAGE: ${{ inputs.message }} # via env, never inlined into the script
        run: >
          eas update --channel production
          --platform "$PLATFORM"
          --environment production
          --message "$MESSAGE"
          --non-interactive
```

Before relying on it, test that the `continuous-deploy-fingerprint-info` outputs
behave as described on a throwaway `preview` channel.
