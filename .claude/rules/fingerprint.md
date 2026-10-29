---
paths:
  - ".github/**"
  - "scripts/ci/**"
  - "app.json"
  - "eas.json"
  - "fingerprint.config.js"
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
build.** `package.json` pins SDK 58. An SDK bump changes the native runtime, which
invalidates every over-the-air update path and forces a new build and a new
submission. Treat an SDK upgrade as a release decision, not a dependency bump.

`fingerprint.config.js` keeps Expo's `strict` preset. SDK 58's default, `balanced`,
leaves `app.json`'s `version` out of the fingerprint, and every version needs a runtime of
its own: all of them share the `production` channel. After an SDK upgrade, re-measure
`docs/release.md`'s table.

It also skips `package.json`'s scripts and the text of `.gitignore`, which change no native
code here. `scripts/__tests__/fingerprint-config.test.ts` fails when a script other than
husky's `prepare` would run during a native build (an npm install, prepare or dependencies
hook, or an EAS Build hook), because the fingerprint would not see it, and when a skip's
name is one Expo does not know, because Expo ignores it silently. The 1.x branches predate
the skips: there any change to `package.json`'s scripts or to `.gitignore` still moves the
fingerprint.

## CI

The release logic lives in `scripts/ci/`, tested by `npm run check`. Workflows call `node scripts/ci/…` and `npx eas-cli …` directly, write temporary files to `$RUNNER_TEMP`, and name each action by its full commit SHA (`docs/release.md`, Pinned actions). `release-gate` treats a PR touching only Markdown, `docs/`, `.github/` and `scripts/ci/` as docs and CI (`scripts/ci/lib/pr.ts`).
