# Escuadra

A football squad memorisation trainer for mobile.

## What the game is

The player picks a team — a club or a national side — and answers a round of
questions about that squad's players. Given a shirt number and a few stats,
which player is this? At higher difficulties, also their position, also their
club.

The point is **recognition under time pressure, built by repetition**. It is a
study tool, not a party game. Someone opens it to actually learn a squad before
a tournament or a season, in short repeated sessions. Every design decision
follows from that: fast rounds, instant feedback, and a results screen that
shows what you got wrong, because the misses are what the user came for.

The name carries the concept. _Escuadra_ means the squad, and _a la escuadra_
means a shot into the top corner of the goal — the perfect strike. A flawless
round is **a la escuadra**; use that term in the UI rather than "perfect score".

## Current state

The Expo app is scaffolded and runs. Design tokens from the design pass are in
the repo, in both a light and a dark palette. What's missing is the product:
the data layer, the question engine, the screens, and the stores.

Build on the existing scaffold and tokens. Do not re-scaffold, and do not
introduce a second styling approach alongside the tokens.

## v1.0.0 — definition of done

- [x] 96 club squads and 46 national team squads as static JSON in the repo
- [x] Team picker, grouped into clubs and nations, with best score per team
- [x] Three difficulty levels (below)
- [x] A 10-question round with instant per-question feedback
- [x] Results screen listing the players missed
- [x] Study screen — browsable full squad list, number / name / position / club
- [x] Best score per team-and-level persisted locally
- [x] Light and dark themes, following the device setting by default, with a
      toggle on Home
- [x] Runs on a physical iPhone — now via an EAS development build, not Expo Go
- [x] Ships to the App Store and Play Store — iOS 1.0.0 is on TestFlight,
      pending testing and submission for review;
- [] Ships to Play Market - neither built nor shipped;

That is the whole of v1. **Deferred, do not build or scaffold for:** player
photos, advertising, monetisation, authentication, any backend or network
call, multiplayer, leaderboards, and Exam mode (a full-squad run on shirt
numbers alone — worth reviving after v0 as a standalone feature, but not a
fourth difficulty level).

⚠️ **The iOS release is already in flight.** As of 2026-09-11 the Apple
Developer Program membership exists, EAS Build produces real binaries, and
version 1.0.0 sits in App Store Connect at _Prepare for Submission_ with
builds on TestFlight — it has never been sent for review. Android has not
been built at all yet. Shipping is therefore no longer a future step to plan
for; it is the phase the project is in, and asset licensing is a live release
blocker rather than a deferred concern: every shipped image must have a
licence someone can name. `assets/flags/README.md` is the worked example —
the flag set was replaced wholesale for exactly this reason. See the EAS
section under Environment for how builds and over-the-air updates work.

## Difficulty levels

| Level | Prompt               | Answer                                                                |
| ----- | -------------------- | --------------------------------------------------------------------- |
| 1     | Shirt number + stats | Player name, 4 options                                                |
| 2     | Shirt number + stats | Name (4 options), then position (GK / DF / MF / FW chips)             |
| 3     | Shirt number only    | Name (6 options), then position, then club or nationality — see below |

On level 3 the third part depends on `squad.kind`: a **club** squad asks the
player's **nationality**, a **nation** squad asks their **club**. Asking a nation
squad for nationality is a non-question, since every member shares it.

**One question, up to three parts.** A round is 10 questions at every level. A
level-2 or level-3 question is a single scored unit: it counts as correct only
when _every_ part is answered correctly. There is no partial credit. The progress
bar counts questions, not parts, so all three levels show 1..10.

Distractor quality is what makes or breaks this. Random wrong answers make the
game trivial; same-position and same-squad distractors make it a real test. On
level 3 the name distractors are drawn from the **same squad**, so they are
genuinely confusable.

## Hard constraints

Product-defining. Flag a conflict rather than working around any of these.

1. **No player photographs in v0** — but photos become the _primary_ element in
   v1, so the question screen keeps a hero slot that a square portrait can drop
   into without a redesign. It currently holds a large shirt number. Keep
   `photo: string | null` on the player type from day one.
2. **No club crests, badges, logos, or shield shapes. Ever.** Trademark
   exposure, and this constraint outlives v0. Clubs are identified by text and
   a banded colour marker (see `TeamMarker` in the data model section) — never
   an emblem. National flags are the one carve-out, because the rule exists
   for trademark exposure and a flag carries none: a nation's identity element
   is a committed PNG in `assets/flags/`, shown on the team picker, level-3
   nationality options, the `NAT` stat chip and the Study screen's affiliation
   column. Never a Unicode regional-indicator emoji (🇦🇷) — that depends on an
   OS flag-emoji font, and Windows ships none, so the Playwright capture behind
   `npm run shots` would render "AR". Crests, badges, logos, and shield shapes
   remain banned forever.
3. **No text input in the quiz. No keyboard for answering.** Every quiz answer
   is a tap — option cards and chip selectors are the entire input vocabulary
   there. This is deliberate: typing player names on a phone is the worst
   possible version of this app. Do not add free-text answering or fuzzy name
   matching to questions.

   The one exception is the **team picker's search field** (filtering the
   club/nation list as you type): narrowing a list is not answering a
   question, and typing a few letters is the normal way to find one team
   among ~20. Keep the exception scoped to that field — do not add free-text
   input anywhere else in the app.

4. **No auth, no accounts, no analytics SDKs, no network calls.** v0 is fully
   offline.
5. **Never hardcode a colour, spacing value, or font size.** Everything comes
   from the design tokens. If a token is missing, add it to the token file
   rather than inlining a value. This governs the app's own design system —
   backgrounds, text, spacing, semantic accent/success/error — never invented
   or arbitrary colour. It does **not** apply to team identity colour, which
   is real-world fact about a specific club or nation, not a design choice —
   see the data model section below. Never invent, rotate, or arbitrarily
   assign a team's colour; it must be the team's actual real colour.
   Colour specifically comes from the **active palette**, via
   `useThemeColors()` — never a module-scope capture. `StyleSheet.create` at
   module scope is evaluated once at import, so a component built that way
   looks correct and silently ignores the theme. Both palettes in
   `theme/tokens.ts` implement the same `Palette` interface: add a role to
   both or to neither.
6. **The product is called Escuadra.** "Squad Trainer", "Squad Game", "Squad
   Quiz" and similar all predate the name and are stale wherever they survive —
   including code comments, file headers and docs. Fix them on sight.

## Data model

Shirt number belongs to **squad membership, not to the player** — a player has
different numbers for club and country. Do not denormalise it onto the player.

```
data/index.json                       squad manifest — GENERATED, see below
data/players.json                     { id, name, fullName, birth, position, nationality, club, photo: null, wikiTitle }
data/squads/nation/<id>.json          { id, kind: 'nation', name, season, verified,
                                         primaryColor, secondaryColor, marker,
                                         members: [{ playerId, no, captain? }] }
data/squads/club/<league>/<id>.json   same shape, kind: 'club'. <league> is one of
                                       la-liga, serie-a, bundesliga, ligue-1,
                                       premier-league, ucl (see League in types/squad.ts)
```

`wikiTitle` is the Wikipedia article title the record came from — the only
field that is unique per person, since two different real people are both
rendered "Otávio". Null when the source links no article. Never a quiz answer;
identity only.

A player has **exactly one** position, not an array. Real players are more
flexible than that, but the quiz asks for one answer through one chip, and
same-position distractor selection needs a single key to group on.

`nationality` exists so a club squad can ask for it on level 3.

`primaryColor`/`secondaryColor` are the team's **real** identity colours
(hex), carried directly on the squad — content, not a design token. Get the
actual colour right; do not invent or rotate an arbitrary hue.

`marker` (`TeamMarker`, see `types/squad.ts`) is a club's sole visual
identity element, and every squad carries one — a nation's still feeds the
in-round banner, where no image fits. It's declarative band geometry, not an
asset: `bands` (fills, in draw order), `orientation`
(`horizontal` | `vertical`), an optional `weights` array for uneven bands, and
an optional `overlay` (a centred `disc` or `diamond` device, e.g. Japan's
disc or Brazil's diamond). For a club it's the club's own colours laid out as
bands — never an emblem. A nation's is its flag as geometry, kept for the
in-round banner only; everywhere else a nation shows its real flag image (see
`lib/flags.ts` and `components/Flag.tsx`).
Both `data/index.json` (the picker manifest) and each squad file carry
`primaryColor`/`secondaryColor`/`marker`, since the picker never imports full
squad JSON. `data/index.json` is generated from the squad files by
`npm run gen:squads` (`scripts/gen-squads.ts`) — never hand-edit it;
`npm run check` fails if it's out of sync with what the generator produces.

**In-round team marker is always a vertical banner, regardless of the
squad's real flag orientation.** The team picker (`TeamRow`) renders a
squad's marker at its true `orientation` — Spain's flag is genuinely
horizontal stripes there. But mid-round, on the question screen's header,
the marker always renders as thin, tall, vertical bands, using `bands` (and
`weights`) as the colour sequence and ignoring `marker.orientation`
entirely: Spain reads red/yellow/red left-to-right, not stacked. This is
`TeamMarker`'s `variant="banner"` (`components/TeamMarker.tsx`,
`sizes.teamMarkerBanner` in `theme/tokens.ts`) — always pass it on the
question screen, never the bare `marker` prop. A shape `overlay` (Japan's
disc, Brazil's diamond) doesn't survive the banner's height, so the banner
renders it as a third middle band instead of a centred shape — edge/middle/
edge, in the overlay's colour — derived from the marker's own data, never a
per-team special case.

One file per squad, so a future contribution touches exactly one file.

`League` (`types/squad.ts`) is the closed set of big-5-league folder names
under `data/squads/club/`, plus `ucl` for a Champions League group-stage
club with no big-5 domestic home. `SquadManifestEntry.league` carries it on
club entries (absent on nation entries) — not consumed by any screen yet,
but available for a future picker that groups clubs by league.

Static squad JSON is imported directly. It does **not** belong in a store.

⚠️ **Treat squad data as unfact-checked until its `verified` flag says
otherwise.** Shirt numbers and current clubs are precisely what models
hallucinate. `verified` asserts that a squad file faithfully reflects its
Wikipedia source — not that the source is right — and it is never set by
hand: it is an output of whichever pipeline wrote the file. Never present
`verified: false` data as authoritative.

Squad data is created and maintained two ways, which coexist and produce the
same `RosterEnvelope`, so their outputs can be diffed directly.

**`squadctl`** (`tools/squadctl/`, `npm run squadctl`) is the deterministic
path and the default one. `squadctl fetch` reads Wikipedia into envelopes and
`squadctl apply` writes them to the repo; `data/teams.json` is the single
registry of teams it knows about. It sets `verified` from its own assertion
pass — `true` only when a team parsed with zero conflicts.

A **conflict is a handover, not a failure**: the team is still written, but
`verified: false` and exit code `4` mean a judgement is waiting that no parser
can make — usually that Wikipedia has changed a player's spelling. Resolve
those with `squadctl rename <playerId> "<name>"`, which never rewrites an id,
then re-run `apply`. `tools/squadctl/README.md` documents every conflict kind,
what you decide, and the command that hands the answer back; the design is in
`docs/superpowers/specs/2026-09-06-squadctl-design.md`.

**The `squad-factory` skill set** remains for the residue that needs
judgement — designing a team's colours and `marker`, and triaging conflicts
squadctl reports. `squad-factory` orchestrates `squad-fetcher` (parallel
Wikipedia reads), `squad-writer` (the sole, sequential writer of
`players.json`, squad files, and the generated index) and `squad-verifier`
(parallel re-verification of existing squads).

## Architecture rules

- **`lib/questionEngine.ts` stays pure.** No React, no store imports, no I/O.
  Given a squad and a level, return questions. It's the piece most likely to
  need iteration and it must be trivially unit-testable.
- **Two stores only.** `stores/progress.ts` is persisted via AsyncStorage — best
  scores, teams played. `stores/session.ts` is ephemeral — current round state. A
  half-finished round must not survive an app restart.
- **Theming is two palettes and a hook.** `theme/tokens.ts` holds
  `palettes.dark` and `palettes.light`; `theme/resolveTheme.ts` is the pure
  preference-to-name resolver, kept React-free so Vitest (which runs in a node
  environment and cannot load `react-native`) can test it; `theme/useTheme.ts`
  exposes `useThemeName()` and `useThemeColors()`. The persisted preference
  lives in `stores/progress.ts` — it is not a third store.
- Zustand's `persist` defaults to `localStorage`, which does not exist here. Use
  `createJSONStorage(() => AsyncStorage)`.
- Every animation stays under 300ms. The app is played in fast repetitive bursts
  and slow transitions become infuriating by question six.

## Environment

⚠️ **Expo has changed a lot between versions.** Read the exact versioned docs
at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo code — not
the `latest` docs, which may describe APIs from a newer SDK this project
cannot use.

⚠️ **Do not upgrade the Expo SDK without deciding to cut a new store
build.** `package.json` is pinned to SDK 57. Expo Go is no longer the only
way to run the app — `expo-dev-client` is installed and EAS Build produces
development, simulator, preview and production builds — so the original
reason for the pin (Expo Go's App Store build dictating the SDK) has been
superseded. The pin now stands for a harder reason: the binary on TestFlight
is SDK 57, and an SDK bump changes the native runtime, which invalidates
every over-the-air update path and forces a new build and a new submission.
Treat an SDK upgrade as a release decision, not a dependency bump.

That 54 → 57 jump also surfaced two real breakages worth knowing about if the
SDK moves again: `expo-router` (SDK 56+) no longer allows importing directly
from `@react-navigation/*` in app code — import `ThemeProvider`/`DarkTheme`/
`Theme` from `expo-router` itself instead; and RN 0.86 removed
`StyleSheet.absoluteFillObject` in favor of `StyleSheet.absoluteFill`.
`DefaultTheme` is exported alongside `DarkTheme` and is the light theme's base.

⚠️ **`userInterfaceStyle` in `app.json` must stay `"automatic"`.** Pinning it
to `"dark"` or `"light"` locks the app to that theme and makes
`useColorScheme()` return the same value on every device, so the
system-following default silently never fires — with no error to trace it by.
This is the one theming failure that compiles, passes every test, and looks
correct on a matching phone. Verify it on a light device, not by reading the
diff.

⚠️ **Node 24+ is required — run `nvm use` before anything else.** TypeScript
runs through `node` directly here, with no build step, which needs Node 24's
native type stripping. On Node 22 every `.ts` entry point dies with
`ERR_UNKNOWN_FILE_EXTENSION`; `scripts/check-node.js` guards `check`,
`gen:squads` and `squadctl` so the message says so.

```bash
nvm use               # .nvmrc pins 24; once per shell
npx expo start        # dev server; scan QR with iPhone Camera → Expo Go
npx expo start -c     # same, clearing Metro cache
npm run typecheck
npm run lint
npm run check         # run before reporting any work complete
npm run shots          # capture design/screens/ from the running web build
npm run shots:store    # capture the 1320×2868 App Store profile to design/store/
```

`design/` is the handoff surface pushed to the Claude Design project.
`design/tokens.ts` and `design/brand.ts` re-export from `theme/tokens.ts` and
`theme/brand.ts` rather than copy — `design/handoff.test.ts` pins object
identity so they cannot quietly drift into a duplicate. `design/screens/`
holds PNGs captured by `npm run shots`; after any change to a screen,
regenerate them, or the design side is working from a stale picture.
`design/store/` is the same screens at App Store listing dimensions — it is
gitignored, not part of the `design/screens/` handoff surface, and is
regenerated via `npm run shots:store` only when needed for a store listing.

### EAS: builds, channels and over-the-air updates

The project runs on the EAS ecosystem. `eas.json` defines four build
profiles — `development`, `ios-simulator`, `preview` and `production` — and
each carries a `channel` of the same name. A build only ever receives updates
published to its own channel.

```bash
npx eas-cli build --profile production --platform ios   # cut a store binary
npx eas-cli submit --profile production --platform ios  # upload to App Store Connect
npx eas-cli update --channel production --message "..." # publish an OTA update
npx eas-cli update:roll-back-to-embedded --channel production  # undo a bad update
npx expo-updates fingerprint:generate --platform ios    # what runtime am I on?
```

`expo-updates` ships JavaScript, styles, images and static JSON — so squad
data corrections, question-engine changes, theme fixes and layout bugs all go
out over the air, in seconds, without a review cycle. Native dependencies,
Expo SDK bumps, permissions and anything in `app.json` do **not**: those need
a new build and a new submission.

⚠️ **`runtimeVersion` uses the `fingerprint` policy, deliberately — do not
change it to `appVersion`.** The fingerprint is a hash of everything that
affects the native runtime, computed by `@expo/fingerprint` at both build
time and publish time. An update only reaches builds whose fingerprint
matches, so a dependency bump automatically stops a stale update from being
served to an incompatible binary. `appVersion` (what `eas update:configure`
sets by default) derives the runtime from the `version` field alone, which
means bumping a native dependency inside the same version silently produces
JavaScript that can be delivered to a binary that cannot run it. The
fingerprint differs per platform; that is expected.

⚠️ **`eas.json` is itself a fingerprint input.** Editing it — adding a
profile, changing a channel — changes the runtime version and orphans every
build already in the field from future updates. Check the fingerprint before
and after any `eas.json` change, and rebuild if it moved.

⚠️ **Do not publish to the `production` channel while a build is in review.**
Review devices launch the app like any user and will pick up channel updates,
so a reviewer can end up running JavaScript that is not what was submitted.
Go quiet on the channel from _Add for Review_ until the app is approved.

Updates download in the background and apply on the **next** launch, not the
current one (`checkAutomatically` defaults to `ON_LOAD`,
`fallbackToCacheTimeout` to `0`, so launch is never blocked). Verifying an
update therefore means launching twice. `expo-updates` is inert in Expo Go
and in development — test the update pipeline on a `preview` or TestFlight
build, never by reading the config.

## Working conventions

- Prefer targeted edits over rewriting whole files.
- Flag design tradeoffs before building rather than resolving them silently.
- Run `npm run check` and report the actual output before claiming work is done.
- TypeScript is strict, including `noUncheckedIndexedAccess`. With a quiz engine
  full of `options[i]`, do not weaken it to make an error go away.

## Reference docs

None are checked in yet. `docs/mobile-dev-setup.md` was explicitly superseded by
the setup walkthrough and should not come back. If the design and logo briefs are
worth keeping in-repo, drop them at `docs/claude-design-brief.md` and
`docs/logo-brief.md` and re-add the `@` imports here.
