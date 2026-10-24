# Escuadra

[![check](https://github.com/tovmassian/escuadra/actions/workflows/check.yml/badge.svg)](https://github.com/tovmassian/escuadra/actions/workflows/check.yml)

Escuadra — a football squad memorisation trainer for iOS and Android. Expo SDK 58 + expo-router, TypeScript strict,
Zustand, Reanimated. Light and dark themes, following the device setting by default, with a theme setting in Settings.

Runs in **Expo Go** for local development — no Xcode, no Apple Developer account, no native build.

## Releases

Escuadra is on the [**App Store**](https://apps.apple.com/us/app/escuadra/id6810705505). What each version shipped is in [`CHANGELOG.md`](CHANGELOG.md); how a change reaches users, as an over-the-air update or a store build, is [`docs/release.md`](docs/release.md). The marketing site and the privacy and support pages are published from the [`gh-pages`](https://github.com/tovmassian/escuadra/tree/gh-pages) branch.

## Setup

Prerequisites, once per machine and phone:

1. **Node.js 24.3+** (`.nvmrc` pins 24; CI runs 24). `nvm use` picks it up
   automatically on either OS.
2. **Git**.
3. **Expo Go** installed on the iPhone (App Store).
4. **An Expo account, signed in on _both_ sides.** Signing in on only one is
   the common failure — the dev server starts fine but the phone never lists
   it.
   - Machine: `npx expo login -b`, then confirm with `npx expo whoami`.
   - iPhone: open Expo Go and sign in with the **same** account. The running
     project then shows up under its development servers list.
5. **Watchman** — **macOS only**, see below.

Then:

```bash
git clone <repo-url>
cd escuadra
npm install     # also wires up the husky git hooks (prepare script)
npx expo start
```

Scan the QR with the iPhone Camera app; it offers to open in Expo Go.

### Windows vs macOS

|                          | Windows                                                                                                | macOS                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Watchman                 | Not used — skip it                                                                                     | Metro's file watcher; install with `brew install watchman`. Without it, large projects can hit `EMFILE: too many open files`             |
| First-run network prompt | Windows Firewall asks to allow Node.js on **private** networks — allow it, or the phone never connects | macOS asks to allow incoming connections for `node`/Terminal — allow it, or add it under System Settings → Privacy & Security → Firewall |
| Everything else          | Same commands, same scripts, same Expo Go flow                                                         |                                                                                                                                          |

## Daily loop

```bash
npm run check
```

```bash
npx expo start
```

Scan the QR with the iPhone Camera app; it offers to open in Expo Go. Edit, save,
see it on the phone.

Useful keys in the Metro terminal: `r` reload · `m` dev menu · `j` DevTools ·
`Ctrl+C` stop. `npx expo start -c` clears the bundler cache.

## Scripts

| Script                 | Does                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`        | typecheck, lint, format check, tests, squadctl's registry check and the generated-file diffs: everything CI runs, and the pre-push gate |
| `npm test`             | Vitest, once                                                                                                                            |
| `npm run typecheck`    | `tsc --noEmit`                                                                                                                          |
| `npm run lint`         | `expo lint`                                                                                                                             |
| `npm run format`       | Prettier, write mode                                                                                                                    |
| `npm run format:check` | Prettier, verify only                                                                                                                   |

A husky `pre-push` hook runs `npm run check`, so nothing reaches the remote with
broken types, lint errors or unformatted code. `git push --no-verify` bypasses it
in an emergency. Hooks install themselves through the `prepare` script on
`npm install`.

## Layout

```
app/          expo-router routes (files = routes)
components/   shared UI; ui/ holds primitives
data/         static squad JSON
lib/          logic: pure modules are unit-tested; the few that wrap a native API keep their decisions in a pure sibling
i18n/         the catalogs and translations
scripts/      generators, CI logic and evals
tools/        squadctl
stores/       Zustand: progress (persisted), session (ephemeral)
theme/        design tokens + font map
types/        shared domain types
```

`lib/questionEngine.ts` stays pure, so the question engine is unit-testable without a renderer.

## Constraints worth knowing

- **The SDK is pinned on purpose.** `package.json` pins SDK 58, and an SDK upgrade changes the native runtime, which invalidates every over-the-air update path and forces a new build and submission. An SDK upgrade is a release decision.
- **Fonts load at runtime** via `useFonts` in `app/_layout.tsx`. Expo Go cannot
  use the expo-font config plugin — that needs a prebuild.
- **Import fonts from per-weight subpaths** (`@expo-google-fonts/inter/700Bold`),
  never the package root. The root barrel pulls in every weight and italic.
- **No Moti.** It is built against Reanimated 3; this project is on Reanimated 4.
  Use Reanimated directly.

## Troubleshooting

| Symptom                               | Fix                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------- |
| QR scans but never connects (Windows) | Allow Node.js on **private** networks in Windows Firewall (port 8081)      |
| QR scans but never connects (macOS)   | Allow incoming connections for `node` when macOS's firewall prompt appears |
| Connects once then dies               | Settings → Privacy & Security → Local Network → Expo Go → on               |
| Server runs but phone never lists it  | Sign in to the same Expo account on both: `npx expo whoami` and Expo Go    |
| Phone and laptop can't see each other | Same Wi-Fi, no client isolation; else `npx expo start --tunnel`            |
| `EMFILE: too many open files` (macOS) | Install Watchman: `brew install watchman`                                  |
| Animations do nothing                 | `npx expo start -c`                                                        |
| Stale code after adding a package     | `npx expo start -c`                                                        |
