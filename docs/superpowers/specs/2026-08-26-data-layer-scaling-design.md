# Data layer scaling design

## Problem

Escuadra ships v0 with 11 hand-authored squads. The intended v0 content set
is much larger: UEFA member nations plus non-UEFA nations from the FIFA
top 40 (roughly 60-70 national squads), the "big 5" domestic leagues (La
Liga, Serie A, Bundesliga, Ligue 1, Premier League — roughly 20 clubs each),
and UEFA Champions League group-stage clubs not already covered by a big-5
league folder. That's on the order of 150-250 squad files.

The current data layer does not scale to that count:

- `lib/squads.ts` hand-lists one `import` line and one `SQUAD_FILES` entry
  per squad, because Metro requires static string-literal imports (no
  `require(`./squads/${id}.json`) by variable). The file's own comment
  already flags this: "Fine at this scale (a handful of squads); a codegen
  step would be worth it well beyond that." 150-250 hand-synced lines is
  well beyond that.
- `data/index.json` is a hand-maintained duplicate of fields that also live
  in each squad file (`primaryColor`, `secondaryColor`, `marker`,
  `verified`). `lib/squads.test.ts` exists specifically to catch the two
  falling out of sync — a symptom of the duplication being manual in the
  first place.
- `data/squads/` is a flat directory. At 150-250 files, browsing or
  reasoning about "what leagues/confederations do we have" has no structure
  to lean on.

This spec covers the **data layer only**: file layout, codegen, and schema.
It does not redesign `team-picker.tsx`'s UI (still a flat clubs/nations
list) — that's follow-up work once this data exists, tracked separately.

## Non-goals

- No database, no server, no network calls. CLAUDE.md's hard constraint #4
  (v0 is fully offline) already settles this; nothing in this spec
  requires revisiting it. Static JSON is the correct architecture for what
  v0 is, not a stopgap.
- No picker UI redesign (grouping/collapsing by league in the actual
  screen). This spec only adds the data the picker would need for that.
- No change to `players.json`'s shape or to the join logic in
  `getRoster`/`getPlayer`.

## Folder layout

```
data/
  players.json                          # unchanged shape, stays global
  index.json                            # becomes generated, see below
  squads/
    nation/<id>.json                    # e.g. nation/esp.json, nation/jpn.json
    club/<league>/<id>.json             # e.g. club/la-liga/rma.json
```

`<league>` is one of a closed set of folder names, matching the new
`League` enum (see Schema changes): `la-liga`, `serie-a`, `bundesliga`,
`ligue-1`, `premier-league`, `ucl`. A club plays in exactly one folder —
its domestic big-5 league if it has one, `ucl` only for a UCL group-stage
club with no big-5 home (expected to be rare-to-empty given the initial
scope, but the folder exists for it).

## Schema changes (`types/squad.ts`)

- New exported type: `League = 'la-liga' | 'serie-a' | 'bundesliga' |
  'ligue-1' | 'premier-league' | 'ucl'`.
- `SquadManifestEntry` gains `league?: League` — present for club squads,
  absent for nation squads. Enables a future picker to group clubs by
  league; not consumed by any screen in this spec.
- No changes to `Squad`, `Player`, `RosterEntry`, or `TeamMarker`.

## Codegen

New script `scripts/gen-squads.ts`, run via `npm run gen:squads`:

1. Globs `data/squads/**/*.json`.
2. Derives `kind` and `league` from the folder path: `nation/<id>.json` →
   `kind: 'nation'`; `club/<league>/<id>.json` → `kind: 'club', league:
   '<league>'` (folder name validated against the `League` enum — an
   unrecognized folder name fails the generation step, not a typecheck
   step, since it's discovered by directory listing).
3. Writes `lib/squads.generated.ts`: one `import squadXxx from
   '@/data/squads/.../xxx.json'` per file, plus the `SQUAD_FILES` map —
   same shape `lib/squads.ts` hand-writes today, just generated. Import
   identifiers are derived from the squad `id` (camelCased) with a
   generation-time error on collision.
4. Writes `data/index.json`: one manifest entry per squad file, built from
   that file's own `id`, `kind`, `name`, `season`, `primaryColor`,
   `secondaryColor`, `verified`, `marker`, and (for club squads) the
   derived `league`. This replaces today's hand-duplication — the squad
   file is the only place these fields are typed by a human or an LLM.

`lib/squads.ts` keeps its existing hand-written logic (`getSquad`,
`getPlayer`, `getRoster`, `listSquads`) unchanged, except it imports
`SQUAD_FILES` from `lib/squads.generated.ts` instead of listing files
itself.

`npm run check` runs `gen:squads` and then checks `git diff --exit-code`
on `lib/squads.generated.ts` and `data/index.json`. A squad file added or
edited without a regen fails `check` the same way a stale lockfile would.

## players.json

Stays exactly as it is today: one global flat JSON array, imported once in
`lib/squads.ts`, indexed by `id` into a `Map` at module load. A player
capped for both club and country is one entry, referenced by `playerId`
from both squad files — no duplication, no split-file cross-referencing
scheme. At full scope (~65 nations + ~130 clubs, accounting for
club/country overlap) this is estimated at roughly 15-20k lines — still a
plain JS array import, not a cost worth engineering around at this scale.

## Migration of the existing 11 squads

1. `git mv` each squad file from `data/squads/<id>.json` into its new path
   — 5 club squads into `data/squads/club/<their-real-league>/<id>.json`,
   6 nation squads into `data/squads/nation/<id>.json`.
2. Run `npm run gen:squads` once; confirm the generated `data/index.json`
   is field-for-field identical to today's hand-written one (same source
   data, now derived instead of typed) aside from the new `league` field
   on the 5 club entries.
3. Delete the hand-written import block from `lib/squads.ts` in favor of
   the import from `lib/squads.generated.ts`.

## Downstream consequences

- **`lib/squads.test.ts`**: the "manifest agrees with squad file" and
  "verified flag matches manifest" assertions become true by construction
  once `index.json` is generated — kept anyway as a regression guard on
  `gen-squads.ts` itself, not on authoring discipline. Add one new test
  (or a `check` step, see above) asserting generated output matches what's
  committed.
- **`squad-updater` skill**: currently hand-writes `data/index.json` and a
  `SQUAD_FILES` entry in `lib/squads.ts` (its SKILL.md steps 10/10a).
  Update it to: write only `data/squads/<path>/<id>.json` and append to
  `players.json`, then run `npm run gen:squads`. Remove all
  `index.json`/`lib/squads.ts`-editing instructions. Add guidance on which
  folder a given team belongs in (nation vs. club/\<league\>).
- **`squad-verifier` skill**: behavior unchanged (still only ever flips
  `verified` inside the squad file); update its file-path references to
  the new nested layout.
- **CLAUDE.md**: update the data model section — new folder layout, the
  `League` enum, and replace "`marker` must be duplicated identically into
  `data/index.json`" with "`data/index.json` is generated from the squad
  files by `npm run gen:squads`; never hand-edit it."

## Scope note (nations)

Per discussion, the national-team set for this expansion is UEFA member
nations plus non-UEFA nations from the FIFA world top 40 — not all 211
FIFA nations. This is a content-authoring scope decision, not a data-layer
one; it doesn't change anything above. Actually authoring the 150-250
squad files (via the `squad-updater` skill, one team at a time) is
follow-up execution work, not part of this spec.

## Future scaling (non-binding note)

CLAUDE.md's hard constraints already rule out a database or server for v0,
and nothing in this spec's problem (import scaling, manifest duplication)
is actually solved by one — both are import-mechanism problems, not
storage-volume problems. When the app eventually needs per-user state
beyond a best-score-per-team (session history, richer stats), the natural
next step is on-device storage (`expo-sqlite`), which preserves the
offline/no-accounts property. A server becomes necessary only the day
leaderboards or cross-device sync are actually built — already deferred
past v0 in CLAUDE.md.
