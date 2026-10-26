---
paths:
  - "**/*.test.ts"
  - "**/__tests__/**"
  - "vitest.config.ts"
---

# Testing

`npm run check` runs what CI runs: typecheck, lint, Prettier, Vitest, squadctl's registry
check and the generated-file diffs. Run it before reporting work done, and report its
actual output.

## What is tested

- **Vitest, in a node environment.** `vitest.config.ts`'s `include` names the folders
  that hold tests; a test anywhere else never runs, so a new folder joins `include` in the
  same change.
- **Screens, components and hooks are verified on a device and by `npm run shots`**, not by
  unit tests: no React Native renderer is set up, on purpose. A custom hook lives in
  `hooks/`, one per file; a store's, the theme's (`theme/useTheme.ts`) and i18n's
  (`i18n/useT.ts`) hooks stay with what they read, and so does a context's with its provider.
- **Logic is pure, so it can be tested.** `lib/questionEngine.ts` imports no React, no
  store and does no I/O. A module that wraps a native API keeps its decisions in a pure
  sibling the tests cover: `lib/haptics.ts` and `lib/hapticPlan.ts`, `lib/share.ts` and
  `lib/shareResult.ts`, `lib/storeReview.ts` and `lib/reviewPrompt.ts`, `lib/telemetry.ts` and
  `lib/telemetryEvents.ts`. A screen reads a pure `lib/*View.ts`.
- **Test first** for logic (superpowers:test-driven-development): see the test fail for
  the right reason before writing the code.
- **No network, no clock.** Tests read fixtures (squadctl's recorded Wikipedia and
  Wikidata responses) or run a fake (`scripts/evals/sandbox/gh-cli.ts`), and randomness
  comes from a seeded generator (`lib/prng.ts`).

## Layout

- Every test goes in a `__tests__/` folder that mirrors the code it covers, with the fakes
  and fixtures it uses, so code folders hold only code. `scripts/ci/__tests__/` is the
  model. This holds in every directory, with no exception.

## Tests that guard a promise

A failure in one of these means what the app promises changed, not that the expectation
is stale. Never edit the expectation, widen an allowlist or loosen TypeScript to pass it.

- `lib/__tests__/telemetrySdk.test.ts`: what the TelemetryDeck SDK sends. A failure is a disclosure
  review (`CLAUDE.md`, guardrail 4).
- `lib/__tests__/telemetryEvents.test.ts`: the whole allowlist and the context every
  signal carries. A change is a disclosure review, and from 2.0.0 on a rename breaks the
  contract (`privacy-telemetry.md`).
- `lib/__tests__/telemetryIdentifier.test.ts`: About's one session code per session, when the
  identifier changes (Reset Escuadra).
- `lib/__tests__/telemetryQueueing.test.ts`: what About says of the waiting statistics, that
  nothing made before an opt-out or a reset is sent after it.
- `i18n/__tests__/catalogs.test.ts`: a hash of the English About. A change updates every
  catalog's `about`, each re-reviewed.
- `lib/__tests__/dataIntegrity.test.ts`: every stored photo's licence and credit, and the squads'
  integrity (`docs/license.md`).
- `theme/__tests__/userInterfaceStyle.test.ts`: the system-following theme.
- `scripts/claude/__tests__/repo.test.ts`: `CLAUDE.md` and these rules stay true to the
  repository.

## Generated files

`lib/squads.generated.ts`, `data/index.json`, `assets/flags/generated.ts` and
`lib/licences.generated.ts` are written by `npm run gen:squads`, `gen:flags` and
`gen:licences`. `npm run check` fails when one differs from what its generator writes:
regenerate it, never hand-edit it.
