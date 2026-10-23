---
paths:
  - "data/**"
  - "tools/squadctl/**"
  - "types/squad.ts"
  - "lib/squads*.ts"
  - "lib/confederations.ts"
  - "lib/__tests__/squads*.ts"
  - "lib/__tests__/dataIntegrity.test.ts"
  - "scripts/gen-squads.ts"
  - "scripts/roster-envelope.ts"
  - "scripts/envelope-check.ts"
---

# Squad data

## The model

Shirt number belongs to **squad membership, not to the player** — a player has
different numbers for club and country. Do not denormalise it onto the player.

```
data/index.json                       squad manifest — GENERATED, see below
data/players.json                     { id, name, fullName, birth, position, nationality, club, photo, wikiTitle }
data/squads/nation/<id>.json          { id, kind: 'nation', name, season, verified,
                                         primaryColor, secondaryColor, marker,
                                         members: [{ playerId, no, captain? }] }
data/squads/club/<league>/<id>.json   same shape, kind: 'club'. <league> is one of
                                       la-liga, serie-a, bundesliga, ligue-1,
                                       premier-league, ucl (see League in types/squad.ts)
```

`photo` is a `PhotoCredit` (`types/squad.ts`) or null: the Commons file, its
thumbnail URL (960 px for an original that wide, else as Commons serves it),
the original's width and height, the name the licence asks to credit, licence
and deed. The Commons page is derived from the file name
(`scripts/commons.ts`), not stored. Hotlinked, never copied.

`wikiTitle` is the Wikipedia article title the record came from — the only
field that is unique per person, since two different real people are both
rendered "Otávio". Null when the source links no article. Never a quiz answer;
identity only.

A player has **exactly one** position, not an array. Real players are more
flexible than that, but the quiz asks for one answer through one chip, and
same-position distractor selection needs a single key to group on.

`nationality` exists so a club squad can ask for it on level 3.

`data/index.json` is generated from the squad files by
`npm run gen:squads` (`scripts/gen-squads.ts`) — never hand-edit it;
`npm run check` fails if it's out of sync with what the generator produces.

One file per squad, so a future contribution touches exactly one file.

`League` (`types/squad.ts`) is the closed set of big-5-league folder names
under `data/squads/club/`, plus `ucl` for a Champions League group-stage
club with no big-5 domestic home. `SquadManifestEntry.league` carries it on
club entries (absent on nation entries).

The manifest also carries `lastUpdated`: a best score keeps the date it was set
on, so a squad update greys it as outdated (#180, `lib/bestScore.ts`).

A nation squad's confederation (the picker's Nations filter) is
`lib/confederations.ts`, keyed by the FIFA code `lib/flags.ts` gives its name. A new
nation needs both: `lib/__tests__/flags.test.ts` and
`lib/__tests__/confederations.test.ts` fail until it has them.

Static squad JSON is imported directly. It does **not** belong in a store.

## Verified, and how squads are made

⚠️ **Treat squad data as unfact-checked until its `verified` flag says
otherwise.** `verified` asserts that a squad file faithfully reflects its
Wikipedia source — not that the source is right — and it is never set by
hand: squadctl sets it from its assertion pass (below). Never present
`verified: false` data as authoritative.

Squad data is written by one path, `squadctl`, which produces `RosterEnvelope`s.

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

`squadctl enrich` runs after `apply` and writes each player's `photo` and,
where none is stored, `birth` from Wikidata, in batches of 50. A stored birth
date Wikidata disagrees with is a conflict it never overwrites, and holds that
player's photo until `squadctl birth` answers it.

Designing a team's colours and `marker`, and triaging the conflicts squadctl reports, is done by hand (see `team-identity.md` for the colours).
