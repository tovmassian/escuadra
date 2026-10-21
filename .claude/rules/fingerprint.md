---
paths:
  - ".github/**"
  - "scripts/ci/**"
  - "app.json"
  - "eas.json"
  - "package.json"
  - "package-lock.json"
  - ".gitignore"
---

# The fingerprint and the release pipeline

These files feed the native runtime's fingerprint or the release pipeline. Read
`docs/release.md` before changing one: "OTA or store build?" says which changes move the
fingerprint. On `main` that is fine; on a locked release branch it is a new version
(`CLAUDE.md`, Releases).

## The Expo SDK pin

⚠️ **Do not upgrade the Expo SDK without deciding to cut a new store
build.** `package.json` is pinned to SDK 57. Expo Go is no longer the only
way to run the app — `expo-dev-client` is installed and EAS Build produces
development, simulator, preview and production builds — so the original
reason for the pin (Expo Go's App Store build dictating the SDK) has been
superseded. The pin now stands for a harder reason: the binary on TestFlight
is SDK 57, and an SDK bump changes the native runtime, which invalidates
every over-the-air update path and forces a new build and a new submission.
Treat an SDK upgrade as a release decision, not a dependency bump.

## CI

The release logic lives in `scripts/ci/`, tested by `npm run check`. Workflows call `node scripts/ci/…` and `npx eas-cli …` directly, write temporary files to `$RUNNER_TEMP`, and name each action by its full commit SHA (`docs/release.md`, Pinned actions). `release-gate` treats a PR touching only Markdown, `docs/`, `.github/` and `scripts/ci/` as docs and CI (`scripts/ci/lib/pr.ts`).
