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
