# Path-scoped rules for CLAUDE.md, and release state out of the docs

## Goal

Every session loads the whole of `CLAUDE.md`: 497 lines, 30 KB, about 7–8k tokens,
2.5× the 200-line target in Claude Code's memory docs. About two-thirds of it matters
only when particular files are touched. It also carries release state that goes stale
the moment it changes: 47 commits in the last 60 days touched it.

This change keeps in `CLAUDE.md` only what every session needs, moves the rest into
`.claude/rules/` files that load when Claude works on matching paths, takes release state
out of the docs into a changelog, and adds checks so none of it grows back.

Not in scope: changing any rule's meaning (with one exception, the motion rule, see
[Decisions](#decisions)), the `docs/superpowers/` history, and the eval suite's pinned
commits.

## Findings

- **Size.** 497 lines. The Data model (947 words), the i18n, telemetry and theming
  rules (695), design handoff and shots (about 500) and the detail of guardrails 1, 2 and 5
  are relevant only to their files.
- **State in the docs.** "Current state" says 46 national squads; there are 157. The
  2.0.0 banner is an in-flight checklist that #116 already holds in full, down to
  "remove CLAUDE.md's ⚠️ release note". Guardrail 4 says "from the next store version".
  `docs/release.md`'s version table, which asks to be kept current, does not mention
  `release/1.0.1`, which exists. The README describes an Expo Go pin that `CLAUDE.md`
  says is superseded, and `npm run check` as typecheck, lint and format only.
- **History and ghosts.** The SDK 54→57 upgrade story; `docs/mobile-dev-setup.md`
  "should not come back"; "re-add the `@` imports"; the retired squad-factory skills.
- **Repetition.** "Disclosures ship in a store build" is stated in guardrails 1, 4 and 7,
  the Telemetry bullet and the 2.0.0 banner.
- **Broken pointers.** Five code comments cite sections that do not exist:
  "hard constraint #2" (`components/TeamRow.tsx`, `components/Flag.tsx`,
  `assets/flags/README.md`), the "once-per-launch home lockup" (`components/Wordmark.tsx`;
  it lives in `theme/tokens.ts`), "Play store-listing guardrails"
  (`app/store/feature-graphic.tsx`). Thirteen files cite guardrails by number.
- **Code ahead of the doc.** `theme/tokens.ts` makes the round-over celebration and the
  home lockup "the one carve-out" from the 300 ms motion rule; `CLAUDE.md` names only
  `autoAdvance`.
- **Testing standards** are split across `vitest.config.ts`, Working conventions and
  Architecture rules, and the stated layout (`__tests__/`) holds 34 tests against 62
  beside their code.

## How rules load (measured)

Claude Code 2.1.278, seven headless Haiku sessions against a throwaway repository, with an
`InstructionsLoaded` hook logging every load:

| Trigger                                                 | Rule loaded                                   |
| ------------------------------------------------------- | --------------------------------------------- |
| `Read` of a matching file                               | yes                                           |
| `Write` of a new matching file                          | **no** (anthropics/claude-code#23478)         |
| `cat` of a matching file through Bash                   | **no**, though the memory docs say it does    |
| Grep only                                               | no                                            |
| An Explore subagent reading a matching file             | yes, inside the subagent                      |
| A brace glob, `"data/*.{csv,txt}"`                      | yes                                           |
| An unquoted `**/*.json`                                 | every session: the YAML fails, the rule loads |
| A `PreToolUse` hook on `Write` with `additionalContext` | the model sees it                             |

Documented, not measured: `paths` is the only frontmatter field a rule has (keyword
loading exists only for skills); compaction drops a path-scoped rule until a matching file
is touched again, while `CLAUDE.md` is re-read from disk; `@` imports load at launch and
save nothing. Edit refuses to run on a file that was not Read, so edits load their rules.

## Design

### Three tiers

1. **`CLAUDE.md`, always loaded, at most 200 lines.** What the game is; the seven
   guardrails, one to three lines each, under their current numbers, with both legal
   guardrails complete (an asset can arrive by `curl`, which loads no rule); the release
   rules; scope; working conventions; commands; an index of the rules and docs, so a task
   about a topic can open its rule before touching a file. No state, no history.
2. **`.claude/rules/*.md`, loaded for matching paths.** The detail of each topic, with
   the check that enforces each rule named next to it.
3. **`docs/`, read on demand.** Procedures and concepts for people and agents:
   `release.md` and `license.md`, unchanged except as below.

### The rules

| Rule                   | `paths` (globs, all double-quoted)                                                                                                                                                                                                           | Takes                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `quiz.md`              | `lib/questionEngine.ts`, `lib/scoring.ts`, `lib/roundView.ts`, `lib/prng.ts`, `app/play/**`, `components/Answer*.tsx`, `components/SlotChip.tsx`, `components/Round*.tsx`                                                                    | Difficulty levels, distractors, engine purity, no text input in detail                            |
| `stores.md`            | `stores/**`                                                                                                                                                                                                                                  | Persisted vs ephemeral, AsyncStorage storage                                                      |
| `squad-data.md`        | `data/**`, `tools/squadctl/**`, `types/squad.ts`, `lib/squads*.ts`, `lib/dataIntegrity.test.ts`, `scripts/gen-squads.ts`, `scripts/roster-envelope.ts`, `scripts/envelope-check.ts`                                                          | The data model, `verified`, squadctl                                                              |
| `team-identity.md`     | `components/TeamMarker.tsx`, `components/TeamRow.tsx`, `components/Flag.tsx`, `lib/flags.ts`, `lib/stageView.ts`, `assets/flags/**`, `scripts/gen-flags.ts`, `data/squads/**`                                                                | Real colours, `marker`, the in-round banner, where flags show                                     |
| `photos.md`            | `lib/photos.ts`, `components/Photo*.tsx`, `components/SpotlightStage.tsx`, `components/QuestionFooter.tsx`, `components/PlayerCard.tsx`, `scripts/commons.ts`, `tools/squadctl/src/lib/photo-credit.ts`, `tools/squadctl/src/lib/enrich*.ts` | Guardrail 1 in detail                                                                             |
| `design-tokens.md`     | `theme/**`, `components/**`, `app/**`                                                                                                                                                                                                        | Guardrail 5 in detail, palettes and `useThemeColors()`, `ShareCard`, motion, `userInterfaceStyle` |
| `i18n.md`              | `i18n/**`, `app/**`, `components/**`, `lib/*View.ts`, `lib/shareResult.ts`, `eslint.config.js`                                                                                                                                               | Catalogs, budgets, display names, the About hash                                                  |
| `privacy-telemetry.md` | `lib/telemetry*.ts`, `lib/telemetrySdk.test.ts`, `app/about.tsx`, `lib/aboutView.ts`, `scripts/privacy-pages.ts`, `i18n/en.ts`, `i18n/translationNotice.ts`                                                                                  | Telemetry, guardrails 4 and 7 in detail                                                           |
| `fingerprint.md`       | `.github/**`, `scripts/ci/**`, `app.json`, `eas.json`, `package.json`, `package-lock.json`, `.gitignore`                                                                                                                                     | What moves the fingerprint, CI conventions, the SDK pin as a release decision                     |
| `expo.md`              | `app/**`, `components/**`, `package.json`, `metro.config.js`                                                                                                                                                                                 | The versioned SDK 57 docs, `expo-router` imports, `StyleSheet.absoluteFill`                       |
| `design-handoff.md`    | `design/**`, `app/**`, `scripts/capture-screens.mjs`, `scripts/screenshot-profiles.ts`, `scripts/generate-play-listing-assets.mjs`, `assets/images/**`, `theme/brand.ts`                                                                     | `design/`, `shots*`, `gen:play-assets`, when to regenerate                                        |
| `licensing.md`         | `assets/**`, `scripts/*licence*`, `scripts/licence-texts/**`, `lib/licences*.ts`, `i18n/UNICODE-LICENSE.txt`, `components/LicencesSheet.tsx`                                                                                                 | Generated notices, the allowlist is the owner's; `docs/license.md` for the rest                   |
| `testing.md`           | `**/*.test.ts`, `**/__tests__/**`, `vitest.config.ts`                                                                                                                                                                                        | Testing standards (below)                                                                         |
| `instructions.md`      | `CLAUDE.md`, `.claude/**`, `docs/**`, `README.md`, `CHANGELOG.md`                                                                                                                                                                            | How to write these files (below)                                                                  |

A rule stays under 100 lines. Editing a component loads up to six of them, about
3–4k tokens, and a session that never touches those files loads none.

**`testing.md`** gathers what the repository already does: Vitest in a node
environment, with the folders `vitest.config.ts` includes (a test outside them never
runs); screens and components verified on a device and by `npm run shots`, with no
React Native renderer on purpose, so logic worth testing lives React-free in `lib/`;
`__tests__/` mirroring the code with its fakes and fixtures, and areas that keep tests
beside their code keep that layout until they move whole; no network in tests; generated
files regenerated, never hand-edited; a pinned test that guards a disclosure or a legal
rule (`lib/telemetrySdk.test.ts`, the About hash, the photo checks in
`lib/dataIntegrity.test.ts`) failing means the disclosure or the rule changed, never that
the expectation is stale; `npm run check`'s real output before work is reported done.

**`instructions.md`** says how these files are written: `CLAUDE.md` holds only what
every session needs; a topic's detail goes in its rule; globs are double-quoted; a rule
names the check that enforces it; no status, dates or history (state lives in GitHub,
EAS and the changelog); open project files with Read, since rules do not load through
Bash.

### Hook: rules for a new file

A `PreToolUse` hook on `Write` in `.claude/settings.json` runs
`node scripts/claude/rules-hook.ts`. When the target file does not exist yet, it returns,
as `additionalContext`, the body of every rule whose `paths` match it. An existing file
needs nothing: Write refuses to overwrite a file that was not Read. Any error exits 0, so
the hook can never block a Write.

### Checks

`scripts/claude/rules.ts` is a pure module: a strict frontmatter parser (a `paths` list
of double-quoted strings, nothing else) and the matcher (`path.matchesGlob`, which Node 24
ships; braces work). The hook and the tests share it. `scripts/claude/__tests__/` holds
its unit tests and a repository test, run by `npm run check`, that fails when:

- `CLAUDE.md` passes 200 lines, or a rule passes 100;
- a rule's frontmatter does not parse strictly, or a rule has no `paths`;
- a glob matches no tracked file (a rule left behind by a rename);
- a repository path cited in `CLAUDE.md`, a rule, `docs/*.md`, `README.md` or
  `CHANGELOG.md` (a link, or a backticked path under a top-level folder with no
  placeholder) does not exist;
- any tracked file cites `.claude/rules/<name>.md` that does not exist, or a guardrail
  number `CLAUDE.md` does not have.

`theme/userInterfaceStyle.test.ts` pins `expo.userInterfaceStyle` in `app.json` to
`"automatic"`. `CLAUDE.md` calls a pinned theme the one theming failure that passes every
test.

No new dependency: the `yaml` package is only transitive.

### Release state

- **`CHANGELOG.md`** at the root, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
  form, newest first. A version's section is written when its release branch is cut, from
  its milestone's merged PRs, on `main` and picked to the branch. An over-the-air fix adds
  its line under its version's **Fixed**, with the date it shipped, in the fix's own PR,
  and reaches `main` with the pick. 1.0.0 and 1.0.1 are backfilled; their headings link
  their release branches, since 1.0.0's iOS and Android builds came from different commits.
- **Tags and GitHub Releases** from 2.0.0 on: once a version is approved, its built
  commit is tagged `vX.Y.Z` and a GitHub Release carries its changelog section. No
  workflow runs on tags.
- **`docs/release.md`**: the version table goes. In its place, where each kind of state
  lives: what shipped in `CHANGELOG.md`, what is live and on which runtime in EAS
  (`npx eas-cli build:list …`) and the store consoles, a version in flight in its
  milestone and release issue. "Cut a release" gains the changelog and tag steps. Play's
  one-time closed test stays as a note on that procedure.
- **`README.md`**: the release section becomes the App Store link and pointers to
  `CHANGELOG.md` and `docs/release.md`; the SDK pin reason, the `check` row and the layout
  are corrected.
- **#116**: two items become obsolete ("Current state describes 2.0", "remove
  `CLAUDE.md`'s ⚠️ release note"), and the changelog and tag steps join it.

## Where each part of `CLAUDE.md` goes

| Section today                              | Goes to                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the game is                           | Stays, shorter                                                                                                                                       |
| Current state                              | Deleted: counts come from `data/`, the feature list from the screens                                                                                 |
| Releases: the five rules                   | Stays                                                                                                                                                |
| Releases: the 2.0.0 banner                 | Deleted; #116 holds every step                                                                                                                       |
| Scope and roadmap                          | Stays                                                                                                                                                |
| Difficulty levels                          | `quiz.md`                                                                                                                                            |
| Guardrails 1–7                             | One to three lines each in `CLAUDE.md`; the detail to `photos`, `team-identity`, `quiz`, `privacy-telemetry`, `design-tokens`                        |
| Data model                                 | `squad-data.md`; colours, `marker` and the banner to `team-identity.md`                                                                              |
| Architecture rules                         | `quiz`, `stores`, `design-tokens`, `i18n`, `privacy-telemetry`, `licensing`; animations as one line in `CLAUDE.md` and in full in `design-tokens.md` |
| Environment: Node 24, `npm run check`      | Stays                                                                                                                                                |
| Environment: Expo SDK, the 54→57 notes     | `expo.md` keeps the two rules, drops the story; the pin's reason to `fingerprint.md`                                                                 |
| Environment: `userInterfaceStyle`          | `design-tokens.md`, pinned by a test                                                                                                                 |
| Environment: `design/`, shots, Play assets | `design-handoff.md`                                                                                                                                  |
| Working conventions                        | Stay; the test layout to `testing.md`                                                                                                                |
| Reference docs                             | The index; the `mobile-dev-setup.md` and briefs notes are deleted                                                                                    |

The five broken comments, and the comments that cite a `CLAUDE.md` section moving to a
rule (`components/TeamMarker.tsx`, `lib/stageView.ts`, `lib/questionEngine.ts`,
`lib/squads.ts`, `lib/squads.test.ts`, `lib/dataIntegrity.test.ts`, `vitest.config.ts`),
point at the rule, or at `theme/tokens.ts` for the lockup. Guardrail citations keep
their numbers.

## Decisions

- **The motion rule states the code's carve-out**: under 300 ms, except the round-over
  celebration and the home lockup (`theme/tokens.ts`), with `autoAdvance` a pause
  outside it. This records what shipped, it does not change it.
- **Release branches keep their own `CLAUDE.md`.** The rules describe `main`'s code
  (i18n, photos, telemetry) that `release/1.0.x` does not have, and the repository test
  would fail there on globs that match nothing. The new layout reaches a release when
  `release/2.0.0` is cut.
- **Guardrail numbers stay**, because thirteen files cite them.
- **The eval suite is untouched.** Its sandbox preloads no `CLAUDE.md` and its prompt
  says to read `CLAUDE.md`, but its cases are pinned to older commits. When `PINS` move
  past this change, the prompt adds `.claude/rules/`.

## Verification

- `npm run check`, with the new tests failing first on a deliberately broken rule,
  glob and path.
- Nothing lost: a fresh reviewer compares the old `CLAUDE.md` sentence by sentence with
  the new `CLAUDE.md`, the rules, the docs, the changelog and #116, and lists anything with
  no home that this spec does not delete on purpose.
- The fingerprint is unchanged: `npx expo-updates fingerprint:generate` for both
  platforms before and after.
- The hook: headless sessions that write a new `lib/__tests__/scratch.test.ts` and a
  new `lib/scratchView.ts` see `testing.md` and `i18n.md` respectively, and one that
  writes `scripts/scratch.ts`, which no rule matches, sees nothing extra.

## Limitations

- Compaction drops path rules until a matching file is touched again; an Edit of a file
  read before the compaction may not reload them.
- Rules do not load for files read through Bash; `instructions.md` and `CLAUDE.md` say
  to use Read, which is advice, not a guarantee.
- The spike measured 2.1.278. When Claude Code changes how rules load, re-run it:
  the throwaway repository and its prompts are in this spec's table.

## Owner inputs

- What 1.0.1 shipped and when, and 1.0.0's release dates, for the backfill.
- Approval to edit #116 as above.
- The issue: #165.
