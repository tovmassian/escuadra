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
the repo. What's missing is the product: the data layer, the question engine,
the screens, and the stores.

Build on the existing scaffold and tokens. Do not re-scaffold, and do not
introduce a second styling approach alongside the tokens.

## v0 — definition of done

- [ ] ~10 club squads and ~10 national team squads as static JSON in the repo
- [ ] Team picker, grouped into clubs and nations, with best score per team
- [ ] Three difficulty levels (below)
- [ ] A 10-question round with instant per-question feedback
- [ ] Results screen listing the players missed
- [ ] Study screen — browsable full squad list, number / name / position / club
- [ ] Best score per team-and-level persisted locally
- [ ] Runs on a physical iPhone via Expo Go

That is the whole of v0. **Deferred, do not build or scaffold for:** App Store
and Play Store distribution, player photos, image licensing, advertising,
monetisation, authentication, any backend or network call, multiplayer,
leaderboards, and Exam mode (a full-squad run on shirt numbers alone — worth
reviving after v0 as a standalone feature, but not a fourth difficulty level).

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
   exposure, and this constraint outlives v0. Teams are identified by text and
   a banded colour marker (see `TeamMarker` in the data model section) — never
   an emblem. National flags are the one carve-out: a nation's marker _is_ its
   flag, rendered as geometry rather than an asset, because the rule exists
   for trademark exposure and a flag carries none. Crests, badges, logos, and
   shield shapes remain banned forever.
3. **No text input anywhere. No keyboard.** Every answer is a tap — option cards
   and chip selectors are the entire input vocabulary. This is deliberate:
   typing player names on a phone is the worst possible version of this app. Do
   not add free-text answering or fuzzy name matching.
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
6. **The product is called Escuadra.** "Squad Trainer", "Squad Game", "Squad
   Quiz" and similar all predate the name and are stale wherever they survive —
   including code comments, file headers and docs. Fix them on sight.

## Data model

Shirt number belongs to **squad membership, not to the player** — a player has
different numbers for club and country. Do not denormalise it onto the player.

```
data/index.json                       squad manifest — GENERATED, see below
data/players.json                     { id, name, fullName, birth, position, nationality, club, photo: null }
data/squads/nation/<id>.json          { id, kind: 'nation', name, season, verified,
                                         primaryColor, secondaryColor, marker,
                                         members: [{ playerId, no, captain? }] }
data/squads/club/<league>/<id>.json   same shape, kind: 'club'. <league> is one of
                                       la-liga, serie-a, bundesliga, ligue-1,
                                       premier-league, ucl (see League in types/squad.ts)
```

A player has **exactly one** position, not an array. Real players are more
flexible than that, but the quiz asks for one answer through one chip, and
same-position distractor selection needs a single key to group on.

`nationality` exists so a club squad can ask for it on level 3.

`primaryColor`/`secondaryColor` are the team's **real** identity colours
(hex), carried directly on the squad — content, not a design token. Get the
actual colour right; do not invent or rotate an arbitrary hue.

`marker` (`TeamMarker`, see `types/squad.ts`) is the team's sole visual
identity element — required on every squad, club or nation, since
crests/badges/shields are never used (hard constraint #2). It's declarative
band geometry, not an asset: `bands` (fills, in draw order), `orientation`
(`horizontal` | `vertical`), an optional `weights` array for uneven bands, and
an optional `overlay` (a centred `disc` or `diamond` device, e.g. Japan's
disc or Brazil's diamond). For a nation the marker _is_ the national flag;
for a club it's the club's own colours laid out as bands — never an emblem.
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

⚠️ **Squad data is LLM-generated and not fact-checked.** Shirt numbers and
current clubs are precisely what models hallucinate. Every generated squad
carries `verified: false`. Never present unverified data as authoritative and
never clear that flag without a real source check.

Squad data is created and maintained through the `squad-factory` skill set:
`squad-factory` orchestrates `squad-fetcher` (parallel Wikipedia reads),
`squad-writer` (the sole, sequential writer of `players.json`, squad files,
and the generated index) and `squad-verifier` (parallel re-verification of
existing squads).

## Architecture rules

- **`lib/questionEngine.ts` stays pure.** No React, no store imports, no I/O.
  Given a squad and a level, return questions. It's the piece most likely to
  need iteration and it must be trivially unit-testable.
- **Two stores only.** `stores/progress.ts` is persisted via AsyncStorage — best
  scores, teams played. `stores/session.ts` is ephemeral — current round state. A
  half-finished round must not survive an app restart.
- Zustand's `persist` defaults to `localStorage`, which does not exist here. Use
  `createJSONStorage(() => AsyncStorage)`.
- Every animation stays under 300ms. The app is played in fast repetitive bursts
  and slow transitions become infuriating by question six.

## Environment

⚠️ **Expo has changed a lot between versions.** Read the exact versioned docs
at https://docs.expo.dev/versions/v54.0.0/ before writing any Expo code — not
the `latest` docs, which describe SDK 57+ APIs this project cannot use.

⚠️ **Do not upgrade the Expo SDK.** The version in `package.json` is pinned to
what the App Store build of Expo Go supports, which lags the current SDK. There
is no Apple Developer Program membership and no development build, so Expo Go on
a physical iPhone is the _only_ way this app runs. Upgrading the SDK breaks the
ability to run it at all. Moving to a development build is a v1 decision.

```bash
npx expo start        # dev server; scan QR with iPhone Camera → Expo Go
npx expo start -c     # same, clearing Metro cache
npm run typecheck
npm run lint
npm run check         # run before reporting any work complete
npm run shots          # capture design/screens/ from the running web build
```

`design/` is the handoff surface pushed to the Claude Design project.
`design/tokens.ts` and `design/brand.ts` re-export from `theme/tokens.ts` and
`theme/brand.ts` rather than copy — `design/handoff.test.ts` pins object
identity so they cannot quietly drift into a duplicate. `design/screens/`
holds PNGs captured by `npm run shots`; after any change to a screen,
regenerate them, or the design side is working from a stale picture.

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
