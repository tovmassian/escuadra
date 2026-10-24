# Escuadra

A football squad memorisation trainer for mobile. The player picks a team, a club or a
national side, and answers a round of questions about its players: given a shirt number
and a few stats, which player is this? At higher difficulties, also their position, and
their club or nationality.

The point is **recognition, built by repetition**. It is a study
tool, not a party game: someone opens it to learn a squad before a tournament or a
season, in short repeated sessions. Every design decision follows from that: fast rounds,
instant feedback, and a results screen that shows what you got wrong, because the misses
are what the user came for.

_Escuadra_ means the squad, and _a la escuadra_ means a shot into the top corner of the
goal. A flawless round is **a la escuadra**: use that term in the UI rather than "perfect
score". Build on the existing scaffold and tokens; do not re-scaffold, and do not add a
second styling approach alongside the tokens.

## How these instructions load

This file holds what every session needs. Each topic's detail is a rule in
`.claude/rules/`, which loads when you Read a file its `paths` match; a hook gives a new
file its rules on Write. Rules do not load for files read through Bash, so open project
files with Read, not `cat`. Working on a topic before touching its files, in a plan, a
triage or an answer? Read its rule first. A rule that loaded for a file you change is part
of the change: when the change makes it untrue or incomplete (a new licence, a new photo
surface, a new event), update the rule in the same PR, so the next session is not misled.

| Rule                                                      | Covers                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`quiz`](.claude/rules/quiz.md)                           | Difficulty levels, tap-only answering, distractors, the question engine |
| [`stores`](.claude/rules/stores.md)                       | Persisted and ephemeral state                                           |
| [`squad-data`](.claude/rules/squad-data.md)               | The data model, `verified`, squadctl                                    |
| [`team-identity`](.claude/rules/team-identity.md)         | Team colours, markers, the in-round banner, flags                       |
| [`photos`](.claude/rules/photos.md)                       | Player photos and their credits                                         |
| [`design-tokens`](.claude/rules/design-tokens.md)         | Tokens, palettes, theming, motion                                       |
| [`i18n`](.claude/rules/i18n.md)                           | Catalogs, translations, display names                                   |
| [`privacy-telemetry`](.claude/rules/privacy-telemetry.md) | What leaves the device, About, telemetry                                |
| [`fingerprint`](.claude/rules/fingerprint.md)             | What moves the fingerprint, CI, the SDK pin                             |
| [`expo`](.claude/rules/expo.md)                           | Expo SDK 58                                                             |
| [`design-handoff`](.claude/rules/design-handoff.md)       | `design/`, screenshots, store assets                                    |
| [`licensing`](.claude/rules/licensing.md)                 | Licence notices and asset licences                                      |
| [`testing`](.claude/rules/testing.md)                     | Testing standards                                                       |
| [`instructions`](.claude/rules/instructions.md)           | How this file, the rules and the docs are written                       |

## Guardrails

Two kinds. **Legal** guardrails (2, with its asset-licensing rule) are never worked
around: stop and ask. **Product and engineering** guardrails are the defaults: an issue
that explicitly changes one wins, and updates the guardrail here and its rule in the same
PR. Code cites guardrails by number, so the numbers stay.

**In design work, a rule is an input, not a blocker.** When a new concept contradicts a
product or engineering rule here or in `.claude/rules/`, or needs something the design
system lacks, flag it and keep designing. If the concept is adopted, change the system
to fit it (the token, the rule, this file) in the same work, unless the owner calls it a
one-off exception. Legal guardrails never bend.

1. **Player photos are hotlinked Wikimedia Commons thumbnails, always credited.** Nothing
   shown or spoken names the player: never the Commons file name or caption. Each load reaches
   Wikimedia, so photos ship in a store build with the privacy disclosures (guardrail 4),
   never over the air. Detail: `photos`.
2. **No club crests, badges, logos, or shield shapes. Ever.** Trademark exposure, and the
   constraint outlives every version. Clubs are identified by text and a banded colour
   marker, never an emblem. National flags are the one carve-out: committed PNGs in
   `assets/flags/`, never Unicode flag emoji (detail: `team-identity`). A crest inside a
   licensed player photo is part of that photo: never crop to it, enlarge it, isolate it
   or use it to identify a team. About says so, and says the marks belong to their owners.

   **Asset licensing (legal):** every shipped image has a licence someone can name, and
   the app does what it asks: [`docs/license.md`](docs/license.md). Store badges on the
   `gh-pages` site are licensed artwork: Apple's and Google's badges only as their
   guidelines allow, unmodified (never recoloured, greyed out or set inside a sentence),
   only for a store where the app is live, with their credit lines in the footer.

3. **Retired.** Answering levels 1–3 by tap only is now a quiz rule (`quiz`), and a new
   mode may take other input. The number stays so existing citations keep their meaning.
4. **Offline-first, and privacy disclosures always match the binary.** Core gameplay works
   with no connection, and squad data stays bundled. Network features are allowed when an
   issue asks for them, but any change to what leaves the device (analytics, crash
   reporting, a backend call, a new SDK) ships **together** with the privacy pages, the
   About text word for word, Apple's App Privacy answers and Google Play's Data safety
   form: in a store build, never over the air. `en.about.privacy` (`i18n/en.ts`) is the
   complete statement of what leaves the device. Detail: `privacy-telemetry`.
5. **Never hardcode a colour, spacing value, or font size.** Everything comes from the
   design tokens, colour from the active palette through `useThemeColors()`; add a
   missing token rather than inline a value. A team's identity colours are real-world
   fact carried on the squad, never invented. Detail: `design-tokens`.
6. **The product is called Escuadra.** "Squad Trainer", "Squad Game", "Squad Quiz" and the
   like, as a product name, are stale wherever they survive: fix them on sight.
   Descriptive store copy may use category words such as "football squad quiz".
7. **The About screen stays true.** It states what leaves the device and what is stored
   on it; how photos are shown and credited; which assets are used, under which licence;
   and that Escuadra is unaffiliated. A change that could make any of that untrue is
   flagged in its PR and fixes the text in the same PR. When the right wording is plain, write it. When the wording needs a privacy,
   licensing or legal judgement, stop and discuss it with the owner first.

## Releases

How changes reach users, the branch model and every procedure:
[`docs/release.md`](docs/release.md). What each version shipped:
[`CHANGELOG.md`](CHANGELOG.md). The rules no session may break:

- **Nothing is published or built from `main`.** OTA updates and store builds come only
  from `release/X.Y.Z` branches.
- **Nothing that moves the fingerprint lands on a locked release branch:** npm scripts,
  dependency changes, `.gitignore` lines, `app.json`, `eas.json`, `fingerprint.config.js`.
  A change that needs one is a new version.
- **A fix for a shipped version starts on its release branch** and reaches `main` by
  `git cherry-pick -x`. Docs and CI changes go the other way.
- **`runtimeVersion` stays on the `fingerprint` policy.** `appVersion` would hand
  JavaScript to binaries that can't run it.
- **CI calls tools directly** (`node scripts/ci/…`, `npx eas-cli …`), never through new
  npm scripts, and writes temporary files to `$RUNNER_TEMP`, never new `.gitignore` lines.

## Scope

Scope lives in GitHub, in milestones and issues, not in this file. If the issue being
worked on asks for something (analytics, photos, a backend call, a new mode,
monetisation), that is the decision: build it well within the guardrails. Stop and ask
only when a request would break a legal guardrail, or when no issue covers it and it
changes the product's direction.

## Working conventions

- **Node 24+: run `nvm use` first.** TypeScript runs through `node` directly, with no
  build step; on Node 22 every `.ts` entry point dies with `ERR_UNKNOWN_FILE_EXTENSION`.
- **Run `npm run check` and report its actual output** before claiming work is done.
- Prefer targeted edits over rewriting whole files.
- Flag design tradeoffs before building: a sentence in the plan, not a blocker, unless
  it touches a legal guardrail.
- TypeScript is strict, including `noUncheckedIndexedAccess`; never weaken it to make an
  error go away.
- User-visible text lives in `i18n/` and is read through `useT()`; `npm run lint` fails a
  hard-coded string in `app/` or `components/`.
- Animations stay under 300 ms by default, with the carve-outs in `design-tokens` (the
  launch intro, Home's drift, the round-over celebration); a design that needs longer
  changes the rule, as Guardrails says.
- Read the Expo docs for SDK 58 (https://docs.expo.dev/versions/v58.0.0/), never
  `latest`. An SDK upgrade is a release decision, not a dependency bump.

## Commands

```bash
nvm use               # .nvmrc pins 24; once per shell
npx expo start        # dev server; scan the QR with the iPhone Camera → Expo Go
npx expo start -c     # the same, clearing Metro's cache
npm run typecheck
npm run lint
npm test
npm run check         # everything CI runs; before reporting work done
```

## Reference

- [`docs/release.md`](docs/release.md): OTA updates, store builds, the fingerprint,
  release branches, rollback.
- [`docs/license.md`](docs/license.md): every shipped asset's licence, the photo
  licences accepted and refused, and how to change the list.
- [`CHANGELOG.md`](CHANGELOG.md): what each version shipped.
- [`tools/squadctl/README.md`](tools/squadctl/README.md): squadctl's commands, and every
  conflict it reports with the command that answers it.
- [`scripts/evals/README.md`](scripts/evals/README.md): grading an agent's issue triage
  with and without the `escuadra-issue-runner` skill.
- `docs/superpowers/specs/`: the design behind each feature; read the spec an issue names.
