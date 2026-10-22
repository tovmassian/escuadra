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
- **Screens and components are verified on a device and by `npm run shots`**, not by unit
  tests: no React Native renderer is set up, on purpose.
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
