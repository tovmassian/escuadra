# squadctl — deterministic squad data management

**Status:** design, approved 2026-09-06. Self-contained — every decision and
its rationale is recorded here.

## 1. Problem

Maintaining squad data through the `squad-factory` / `squad-fetcher` /
`squad-writer` / `squad-verifier` skill set costs roughly two days and a large
token spend for ~20 teams. Almost every step is mechanical: fetch a Wikipedia
section, parse template lines, reconcile against stored records, write JSON.
The only genuinely non-mechanical step is designing a team's colours and flag
marker, which happens once per team ever.

`squadctl` moves the mechanical work to a deterministic CLI.

**The skills are not retired.** They keep working, unchanged, alongside
`squadctl`. Both paths produce the same `RosterEnvelope`, so their outputs can
be diffed directly and the better one can win on evidence. The intended end
state is not one replacing the other but a combination: `squadctl --json` does
the bulk work and reports typed conflicts, and a skill spends tokens only on
the residue that needs judgement.

## 2. Target scale

100 clubs (5 leagues × 20) plus national teams. The figures below model **150
squads — 100 clubs and 50 nations** as a ceiling; the nations actually shipped
first are the subset whose markers the current `TeamMarker` can express, likely
30–40. Measured extrapolation from current per-unit sizes (221 bytes/player,
~1.8 KB/squad file):

|                | Today        | At 150 squads    |
| -------------- | ------------ | ---------------- |
| Squad files    | 29 (51 KB)   | 150 (268 KB)     |
| `players.json` | 711 (154 KB) | ~3,200 (~700 KB) |
| `index.json`   | 29 (8.6 KB)  | 150 (44 KB)      |
| Memberships    | 722          | 3,800            |
| **Total JSON** | **215 KB**   | **~1.0 MB**      |

**No architectural change is required.** Every access path is already
per-squad — `getRoster` joins one squad, `questionEngine` and `studyView` take
a roster as input — so nothing gets slower as the table grows.
`data/index.json` already exists so the picker never imports full squads; it
stays at 44 KB regardless of roster size. `lib/squads.ts` builds a ~3,200-entry
Map at module init and holds all squads resident: single-digit MB of heap, fine
at 150, worth revisiting somewhere past 500 squads.

**All 211 FIFA nations is explicitly out of scope**, and not for size reasons
(~2.3 MB, still fine). Two real constraints:

1. **`TeamMarker` cannot express many national flags.** It renders parallel
   bands plus optionally one centred disc or diamond. Crosses (England,
   Switzerland, Denmark, Sweden, Norway, Iceland, Finland), saltires (Scotland),
   stars (USA, Morocco, Senegal, Turkey, Korea, Australia) and cantons
   (Uruguay) have no representation. CLAUDE.md's rule that emblems and coats of
   arms are omitted already rescues Portugal, Croatia, Serbia, Slovakia,
   Slovenia and Mexico, so the FIFA top-20 gap is seven nations, three of which
   (England, Switzerland, Denmark) are the same cross shape.
2. **Marker design is human work**, once per team. 211 nations is 211 units of
   design judgement that no script removes.

Extending `TeamMarker` with `cross`, `saltire` and `star` is a design-system
task orthogonal to this CLI, but it is **on the critical path to the nation
target** and is not a long tail. Bands-plus-disc cannot express England,
Scotland, Switzerland, Denmark, Sweden, Norway, Iceland, Finland, USA, Morocco,
Senegal, Turkey, South Korea, Australia, Uruguay, Chile, Greece or Czech
Republic — most of a credible top-20 picker, including England and the USA.
Without that work the realistic nation ceiling is ~30; with it, ~45. Do it
before the nation sweep rather than shipping 30 nations and revisiting.

Because §5's registry makes adding a team an append, deferring nations until
then carries no architectural penalty and no rework.

## 3. Command surface

An oclif v4 app at `tools/squadctl/`.

```
squadctl registry init              # derive data/teams.json from existing squad files

squadctl fetch                      # every team in the registry
squadctl fetch --only sev,rma
squadctl fetch --league la-liga
squadctl fetch --kind nation        # the ~6x/year international-break sweep
squadctl fetch --offline            # re-parse from cache, zero requests
squadctl fetch --out .cache/envelopes/<runId>/

squadctl apply .cache/envelopes/<runId>/ [--dry-run]
```

Two phases: `fetch` touches the network and is idempotent per input; `apply` is
a pure function of its inputs and touches the repo.

### Cache semantics

One flag, not a pair. **Default fetches fresh and writes the cache.** The cache
exists so a _parser_ change can be re-run at zero network cost, not so stale data
is served by default. `--offline` re-parses from `.cache/wikitext/` and makes no
requests. There is deliberately no flag to suppress the cache write: `.cache/` is
gitignored and a few KB per team, so suppressing it buys nothing.

### No `--season` flag

There is no multi-season state, so season is a single constant applied on every
write: `2026/27` for clubs, `2026` for nations. This also normalises `ars`,
`bar` and `psg`, which are stranded on `2025/26` while the other 20 clubs are
on `2026/27`.

### `--json` is global, not per-command

`static enableJsonFlag = true` on a shared `BaseCommand` gives every subclass
`--json`, suppresses human logging in that mode, and serialises whatever `run()`
returns. Commands always build one typed result object; the base class decides
how it renders. No per-command branching.

## 4. Module layout

```
tools/squadctl/
  package.json               oclif config + bin name ONLY; no dependencies
  bin/dev.js                 plain node entrypoint — no compile step
  README.md
  src/base-command.ts        BaseCommand: enableJsonFlag, shared reporter
  src/commands/registry/init.ts  `registry init` — bootstrap from stored squads
  src/commands/fetch.ts
  src/commands/apply.ts
  src/lib/wiki-fetch.ts      HTTP + disk cache. The only networked file.
  src/lib/wikitext-parse.ts  pure: wikitext -> ParsedRow[]
  src/lib/build-envelope.ts  pure: registry entry + rows -> RosterEnvelope
  src/lib/reconcile.ts       pure: rows + stored -> WritePlan
  src/lib/assertions.ts      pure: WritePlan -> failures / conflicts / warnings
  src/lib/fifa-countries.ts  code -> country lookup
  src/lib/registry.ts        TeamRegistry type + validator
  src/lib/write-json.ts      shared prettier formatAndWrite
```

Everything testable without a network lives in the pure layer. The commands do
argument parsing, I/O and reporting only.

**`@oclif/core` goes in the ROOT `devDependencies`, and nothing else does.**
There is deliberately no TypeScript loader: `package.json` pins
`node >=24.3.0`, Node 24 strips TypeScript natively, and `npm run gen:squads`
already relies on that by running `node scripts/gen-squads.ts` directly.
Adding `tsx` would pull ~12 MB of esbuild into the root `node_modules` to
provide a capability the runtime already has — and per the note below, the
root `node_modules` is exactly what Metro watches.

Node runs the `.ts` files in **strip-only** mode, which erases types but
compiles nothing. TypeScript constructs that need code generation are
therefore unavailable anywhere squadctl imports: no `enum`, no `namespace`,
and no constructor parameter properties (`constructor(readonly x: T)`) —
declare the field explicitly instead. `tools/squadctl/package.json` and
`scripts/package.json` both declare `"type": "module"` so those directories
are unambiguously ESM; the root `package.json` deliberately does not, because
Metro needs project `.js` to stay CommonJS.

`tools/squadctl/` must not have its own `node_modules`: `metro.config.js` calls
`getDefaultConfig(__dirname)`, so Metro watches the project root, and a nested
dependency tree is the one thing likely to disturb it. Expo Go on a physical
iPhone is the only way the app runs (CLAUDE.md), so this is not negotiable.

`scripts/roster-envelope.ts` stays where it is as the shared contract — the
skills' documentation references that path and `scripts/envelope-check.ts`
imports it. squadctl imports it upward rather than forking it, which is what
keeps the two paths' envelopes comparable.

`scripts/gen-squads.ts`'s `formatAndWrite` is extracted to
`src/lib/write-json.ts` and both call it.

## 5. `data/teams.json` — the team registry

One checked-in file is the single input to `fetch`. A registry entry with no
squad file simply _is_ a new team, so there is no separate intake path and no
`--intake` flag.

```ts
/** Hand-authored, or produced in batches by the `squad-factory` skill.
 *  `identity` cannot be derived — reading kit colours and expressing a flag as
 *  bands is design work — so an entry without it is a hard failure rather than
 *  an invented colour. */
export interface TeamRegistryEntry {
  id: string; // squad id; becomes the filename
  kind: 'club' | 'nation';
  league?: League; // required iff kind === 'club', absent otherwise
  name: string; // display name, e.g. "Juventus"
  source: string; // full en.wikipedia.org article URL
  identity: EnvelopeIdentity; // primaryColor, secondaryColor, marker
}
export type TeamRegistry = TeamRegistryEntry[];
```

The registry is validated before the first network call, so a malformed file
fails in milliseconds rather than halfway through 150 teams.

**Identity is authoritative here and `apply` always writes it through.** There
is no "present means overwrite, absent means preserve" rule, and no need for one:
a single authoritative source removes the hazard that such a rule existed to
guard against — a maintenance run wiping every marker in the repo.

### Bootstrapping the registry

`squadctl registry init` derives an entry for every squad file already under
`data/squads/`. Every field the registry needs is already stored: `id`, `kind`,
`name` and `source` come from the squad file itself, `league` from its folder
path, and `identity` from its `primaryColor` / `secondaryColor` / `marker`. The
29 squads in the repo therefore cost **no authoring at all**, and hand-authoring
is confined to teams that do not exist yet — where `identity` is the only field
that is genuine judgement rather than lookup.

It refuses to overwrite a populated `data/teams.json`. Merging new entries into
an existing registry is an operator edit, not a command.

## 6. Fetching

Two requests per team, sequential, ~200ms apart:

1. `.../api.php?action=parse&page=<Title>&prop=sections&format=json`
2. `.../index.php?title=<Title>&action=raw&section=<N>`

`<Title>` comes from the registry entry's `source` URL path segment. A
descriptive `User-Agent` naming the tool and a contact address is required —
Wikimedia policy allows refusing generic or absent agents. 150 teams is 300
requests at roughly 500 ms each: under two minutes, no concurrency needed.

Every raw section response is cached to
`.cache/wikitext/<title>.<section>.wikitext` **before** parsing. **The section
index is always re-resolved and never cached** — Arsenal's squad section is
index 24 today and that number is not stable.

Never route these through any tool that summarises through a model.

### A raw section request includes its subsections

`action=raw&section=<N>` returns the matched section **and everything nested
beneath it**. Most Spanish club articles put `===Reserve team===` and
`===Out on loan===` under `==Current squad==`, so parsing the whole response
pulls reserve and loaned-away players into the first team: Elche came back with
35 members against a stored 24, Rayo with 34 against 23.

The parser therefore cuts at **the first heading that follows the first player
row**. That rule handles both article shapes — a squad table directly under the
matched heading (cut at the next subsection) and a table nested one level down,
as when `Players` matches and the roster lives inside a subsection of it
(nothing is cut before the table is reached). Dropped headings are reported, not
silently discarded. `{{updated}}` is read from the whole section, since some
articles place it below the table.

### Section selection

First match wins, in order: `Current squad`, `First-team squad`,
`First team squad`, `Players`, `Recent call-ups`. Record the matched title
verbatim. Falling down the list is normal — most English club articles never use
`Current squad`. Only a page with no match is a failure.

Coverage was sampled across the FIFA ranking spectrum (Germany, Senegal, Panama,
Uzbekistan, Armenia, Malawi, Bhutan, San Marino, Guam): 9 of 10 matched, the
tenth being a title-encoding artefact of the test. Coverage does not degrade
meaningfully with ranking.

A `Recent call-ups` match is a call-up list, not a contract roster: it is a
conflict (§9), recorded with the section's stated "as of" date.

## 7. Parsing

Template match: `/^(nat\s+)?fs\s+[a-z\s]*player$/i`. A template that looks
player-ish but matches no known variant is a conflict, never a silent skip.

**Split parameters on `|` at brace/bracket depth zero only.** Naive splitting
breaks on `age={{birth date and age|df=y|1995|9|15}}`, which contains three pipes
inside `{{}}`. Track `{{ }}` and `[[ ]]` depth, parse into a generic
`Record<string, string>` of named parameters, then apply field rules.

Wikilinks `[[Target#Anchor|Display]]`: **title** is `Target` with anchor
stripped, `_` to space, whitespace collapsed, HTML entities decoded, no
case-folding beyond the first character; **display** is `Display`, or `Target`
when there is no `|`.

### Three rules verified against live wikitext

**Captain** — exact `/^captain$/i` against the wikilink **display** text, never a
substring test. Arsenal's `other=` carries `captain`, `vice-captain` **and**
`3rd captain`; a `/captain/i` match with a vice-captain exclusion still returns
two captains and trips the "≤1 captain" hard failure on the very first team
parsed. Only one captain per squad is tracked — vice-captain, 3rd captain and
every other variant are ignored, since there is no field for them.

**A numberless row is kept**, with `no: null`, never dropped. `SquadMember.no` is
`number | null` by deliberate design: `int.json` carries one today, and
`questionEngine` keeps such a player as a name distractor while excluding them as
a question subject. Dropping the row deletes stored data.

**`asOf`** — parsed from the `{{updated|1 September 2026}}` template in the
section header, not read out of prose. Deterministic, with no natural-language
date handling.

### Field population

**`nationality`** — always a full country name matching the spelling in
`players.json`, never a raw FIFA code. Club squads translate `nat=`; nation
squads have no per-member field, so every member takes the squad's country.

**`club`** — matching the form in `players.json` (`Arsenal`, not `Arsenal F.C.`);
use the wikilink **display** text, never the title. Nation squads parse each
member's `club=`; club squads set every member to the registry entry's `name`.

### The FIFA country table

`data/fifa-countries.json`, seeded with the **full ~211-code set up front** and
reviewed once. Bootstrapping it from existing data does not scale: 23 clubs
yield 65 nationalities, but 100 big-5 clubs will surface roughly 110–130 distinct
codes, so a data-derived table would stop onboarding dead on an unmapped code
over and over. With the full set seeded, an unmapped code is a genuine exception
and a hard failure naming the code to add.

**Stored spellings win.** `players.json` already pins 65 country names, and a
table seeded from a FIFA code list will disagree with several of them —
`Côte d'Ivoire` against the stored `Ivory Coast`, `Czechia` against
`Czech Republic`, `Korea Republic` against `South Korea`, `Congo DR` against
`DR Congo`. Any of those forks the nationality string, leaving level-3
distractors comparing two spellings of one country and the Study screen showing
both. So: extract the 65 in-use spellings mechanically and let them override the
seed unconditionally; review the remaining ~146 by hand once.

## 8. `birth`

**Carried over, never fetched.** No per-player article request is ever made —
that request was the dominant cost of the old pipeline and the root of its
name-ambiguity machinery.

- A parsed player matched to an existing record **inherits that record's `birth`
  for free**. All 711 stored players have one today.
- Nation squads additionally parse `age={{birth date and age|df=y|Y|M|D}}`,
  which is already in the wikitext.
- A genuinely new player on a club squad gets `birth: null`.

`Player.birth` becomes `string | null`. Club-squad wikitext structurally never
carries a birth date, so its absence is **normal, not anomalous**: it is reported
as an informational count (`4 players with no birth date`), produces no
`warnings[]` entry, and does not affect `verified`. Blocking on it would leave
every club permanently unverified after each transfer window.

**UI consequence.** `lib/questionEngine.ts:196` computes `age` from
`player.birth` and the question screen renders it as a stat chip. `Question.age`
becomes `number | null`, `getAge` is guarded, and the chip row filters `AGE` out
when null. Level 1 goes from three chips to two; **level 2 goes from two to
one**, leaving nationality as the only stat beyond the shirt number for a club
squad player with no stored birth date. This is an accepted
regression in exchange for removing ~25 requests per club squad — but it is
recoverable, and is not intended to be permanent.

### Deferred: backfilling birth dates (v0.1)

Level 2 can be returned to two stat chips without ever reintroducing a
per-player article fetch. A separate `backfill-birthdates` command costs **two
requests per squad**, not per player:

1. `action=query&prop=pageprops&ppprop=wikibase_item&titles=A|B|C…` — up to 50
   titles per request, returning each page's Wikidata QID.
2. One SPARQL query to `https://query.wikidata.org/sparql`:
   `SELECT ?item ?dob WHERE { VALUES ?item { wd:Q… wd:Q… } ?item wdt:P569 ?dob . }`

The titles come from the wikilink **title** already parsed in §7 and held in
memory for the duration of the run. This deliberately does **not** require
storing `wikiTitle` on `Player`, which §9 rejects.

Wikidata is CC0, so this creates no licensing obligation. All 711 stored players
have a birth date today, so the command only ever does work for genuinely new
signings — on the order of 150 extra requests to hold level 2 at two chips
across 100 clubs. **Neither request shape has been tested against a live
endpoint** and both must be verified before being relied on. Not v0; recorded
here so the §8 saving does not silently become a permanent UI regression.

## 9. Reconciliation and what sets `verified`

Match key is the normalised name, and no `wikiTitle` is stored on `Player`.

**`normalizeName` folds more than diacritics.** NFD strips only _combining_
marks, so `ø đ ð ł æ œ ß þ ı ŋ ħ` survive it untouched and two sources
spelling one player differently never match — `Ødegaard` against `Odegaard`.
Those letters are transliterated explicitly, in the shared
`scripts/roster-envelope.ts` so the skill path folds identically. A match that
holds **only** because of that folding means the sources disagree on the
spelling, and raises a `name-variant` conflict: the stored name is kept and
named alongside the source's, because which is right is a human call.

**Normalised names are NOT unique within a squad.** An earlier draft assumed
they were; Brazil disproves it. That squad carries two different real people who
both normalise to `ederson`:

| shirt | article title                     | position | club       |
| ----- | --------------------------------- | -------- | ---------- |
| 23    | `Ederson (footballer, born 1993)` | GK       | Fenerbahçe |
| 2     | `Éderson (footballer, born 1999)` | MF       | Atalanta   |

Two mechanisms handle this, neither of which stores a title on `Player`:

1. **`EnvelopeMember.title`** carries the wikilink target, which _is_ unique by
   construction. `validateEnvelope` keys its duplicate-name check on
   name-plus-title, so one squad may legitimately contain two members sharing a
   display name.
2. **Reconciliation separates a collision group on data both sides already
   carry** — position, then club, then shirt number, first discriminator that
   resolves to exactly one candidate wins. Deterministic and order-independent.
   When nothing separates them it raises `ambiguous-name` rather than guessing.

The remaining cross-squad collision (`fran garcia` → `fran-garcia` /
`fran-garcia-torres`) is what step 2's global lookup flags rather than guesses
at.

Per team:

1. Match each parsed row to a **stored member of this squad** by normalised name.
2. An unmatched row → look up `players.json` **globally** by normalised name:
   exactly one hit reuses that record (inheriting its `birth`); more than one hit
   is a **conflict**; no hit creates a new player.
3. An unmatched stored member has departed. Removed from `members`; the player
   record is kept.
4. New player ids are `firstname-lastname` kebab-case (`david-raya`), not bare
   surnames — lower collision probability at scale, and ids are not user-facing.
   Collisions append a numeric suffix. **Existing ids are never rewritten**;
   renaming would break every squad file referencing them.

**Orphans are kept and never auto-pruned.** 39 exist today and they grow with
scale, but an orphan is precisely the record reused — birth date intact — when
that player appears in another squad next window. The report counts them; nothing
deletes them.

### The three tiers

| Tier              | Conditions                                                                                                                                                                                                                                               | Effect                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Hard failure**  | no matching section; zero members parsed; a club squad with fewer than 14 members parsed; more than one captain; duplicate shirt number within squad; `pos` not in GK/DF/MF/FW; `no` outside 1–99; unmapped FIFA code; registry entry without `identity` | Team is **not written at all**. The run continues with other teams. |
| **Conflict**      | ambiguous global name match; possible rename; spelling disagreement between sources; unrecognised player-ish template; roster change >40% vs stored; section matched `Recent call-ups`                                                                   | Team **is** written, `verified: false`, reason named in the report. |
| **Warning**       | departed players; generated player id; a `no: null` member; club member count <18; nation member count outside 20–30                                                                                                                                     | Written, `verified` stays `true`.                                   |
| **Informational** | new player with `birth: null`; orphan count                                                                                                                                                                                                              | Counted only.                                                       |

**A departure and an arrival that look like the same person are a
`possible-rename` conflict.** Wikipedia edits a player's display form without
the squad changing at all: a live six-team trial found `Alejandro Grimaldo`
become `Alex Grimaldo` on Spain and `Dro` become `Dro Fernández` on PSG — two
of six teams. Step 2's global lookup misses both, so the plain rules create a
second player record for a person already in the table and orphan the first.

So after steps 1-3, departures and newly-created players **within the same
squad** are cross-checked: sharing a surname, or one name's tokens being a
subset of the other's, raises the conflict. It never merges the two — the
direction of a merge is not inferable and §9's whole stance is to flag
ambiguity rather than guess. It names the pair, writes `verified: false`, and
a human decides. A false positive (two unrelated players sharing a surname in
one window) costs one glance; a false negative costs a duplicate human in
`players.json` that nothing later removes.

**A `no: null` member is a warning, not a conflict.** It is a modelled,
unambiguous state rather than missing information: the source is known to list
that player without a number. Treating it as a conflict would leave any club
carrying one unnumbered new signing permanently `verified: false`, which across
100 clubs mid-transfer-window is a large and meaningless fraction of the table.
Conflicts are for ambiguity; a null number is certain.

**`verified` is the output of the assertion pass**: `true` when a team has zero
conflicts, `false` otherwise. A deterministic parse has no hallucination surface,
so a clean run is a legitimate verification, and the 29 manually-verified squads
already in the repo survive the first sweep rather than being downgraded by it.

Be precise about what that flag now asserts: **the squad file faithfully reflects
its Wikipedia section**, not that the section is correct. It is a much stronger
claim than the LLM-generated data's flag and a weaker one than a human
cross-check against a second source. CLAUDE.md's warning about unverified data is
written in the older, weaker sense and is corrected as part of §12.

The blast-radius check compares against the stored squad file, so it is **skipped
for a team that has none** — every new team would otherwise trip it at 100%.

**Failures are per-team, not per-run.** Aborting the whole run on any assertion
failure would, at 150 teams, let one restructured page block the other 149.

An envelope naming a team with no registry entry is a hard failure for that team:
`apply` needs the entry's `identity` and `league`, and inventing either is
exactly what §5 exists to prevent.

## 10. Writing

- `members` is a **full replace**, never merged.
- `identity` always written from the registry (§5).
- `photo` stays `null` unconditionally.
- `data/index.json` and `lib/squads.generated.ts` regenerated by running
  `scripts/gen-squads.ts` **once** at the end. Never hand-edited.

### Determinism

Two runs on the same cached wikitext must produce byte-identical files.

- `members` sorted by `no` ascending, `null` last.
- `players.json` sorted by id.
- Every write goes through the shared prettier `formatAndWrite`, so output
  matches `.prettierrc` exactly and `npm run check`'s `prettier --check` and
  `git diff --exit-code` both stay green. LF endings come from `.gitattributes`.
- **`lastUpdated` changes only when the rest of the file changed.** Load-bearing
  at 150 teams: a no-op sweep must produce an empty git diff.

## 11. Reporting and exit codes

```ts
interface TeamReport {
  id: string;
  status: 'written' | 'unchanged' | 'conflicted' | 'failed';
  verified: boolean;
  counts: {
    parsed: number;
    added: number;
    departed: number;
    newPlayers: number;
    noBirth: number;
  };
  conflicts: Conflict[];
  warnings: string[];
}
interface RunReport {
  runId: string;
  teams: TeamReport[];
  totals: {
    written: number;
    unchanged: number;
    conflicted: number;
    failed: number;
    orphans: number;
  };
  exitCode: number;
}
```

`Conflict` is a discriminated union — `ambiguous-name`, `possible-rename`, `name-variant`,
`unknown-template`, `blast-radius`, `call-ups-only` — each carrying the offending
rows. That structure is what lets a skill spend tokens only on the residue.

Exit codes, stable because skills and scripts branch on them:

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| 0    | clean                                                     |
| 1    | network / HTTP                                            |
| 2    | no matching section                                       |
| 3    | parse produced nothing usable                             |
| 4    | conflicts present — files written, some `verified: false` |
| 5    | repo write or generator error                             |

Code `4` means _review needed_, not _broken_.

Because failures are per-team, the **process exit code is the highest severity
encountered across the run**. A sweep where 148 teams write cleanly and two hit
unmapped FIFA codes exits non-zero, and the `RunReport` says which two.

## 12. Changes to existing files

| File                                   | Change                                                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/squad.ts`                       | `Player.birth` becomes `string \| null`                                                                                                                                    |
| `lib/questionEngine.ts`                | `Question.age` becomes `number \| null`; guard `getAge`                                                                                                                    |
| `app/play/[squadId]/[level]/index.tsx` | filter the `AGE` chip when age is null                                                                                                                                     |
| `scripts/roster-envelope.ts`           | `EnvelopeMember.no` accepts `null`; `EnvelopeMember.title` added; `validateEnvelope` updated to match `SquadMember` and to key duplicate-name detection on name-plus-title |
| `scripts/gen-squads.ts`                | extract `formatAndWrite` to the shared module                                                                                                                              |
| `vitest.config.ts`                     | add `tools/**/*.test.ts` to `include`                                                                                                                                      |
| `.gitignore`, `.prettierignore`        | add `.cache/`                                                                                                                                                              |
| `package.json`                         | `@oclif/core` in `devDependencies`; `squadctl` script                                                                                                                      |
| `CLAUDE.md`                            | correct the stale "every generated squad carries `verified: false`" line; document squadctl                                                                                |

`EnvelopeMember.clubNat` is unused anywhere outside the type and skill prose and
is removed. `Player.fullName` also has no production consumer — only test
fixtures set it — but 711 records carry real values and 386 differ from `name`,
so **it is kept**: removing it deletes data rather than dead code.

## 13. Testing

Checked-in wikitext fixtures with exact expected parsed output:

1. Club at section priority 2 (Arsenal) — also the captain / vice-captain /
   3rd-captain guard.
2. Nation at priority 1 (`Current squad`).
3. Nation with only `Recent call-ups`.
4. A numberless row, asserting it is **kept** with `no: null`.
5. The depth-aware splitter: `age={{birth date and age|df=y|1995|9|15}}`.
6. A disambiguated wikilink: `[[Rodri (footballer, born 1996)|Rodri]]`.
7. An ambiguous global name match (`ederson`), asserting a conflict rather than a
   merge.
8. A renamed player (`Alejandro Grimaldo` -> `Alex Grimaldo`), asserting a
   `possible-rename` conflict rather than a new player record.

All pure — no network. Beyond fixtures, the **29 existing manually-verified
squads are a test oracle**: a parse that reproduces 722 human-checked memberships
is stronger evidence than any hand-written fixture.

### The oracle run is a gate, not a smoke test

Before `fetch` is pointed at a single new team, run it across all 29 stored
squads and `apply --dry-run`, then diff against what is committed. The diff must
be **exhaustively explainable**: the three season normalisations (`ars`, `bar`
and `psg` off `2025/26`, §3), plus any genuine roster drift traceable to a change
on the live page. A difference that is neither is a parser defect, and the fix is
to the parser — never to the data. Only once that diff is clean is the pipeline
trusted enough to author new teams into.

## 14. Docs

`tools/squadctl/README.md`: the two commands, the registry format with a worked
entry, the conflict taxonomy and what to do about each, the `--json` schema and
exit codes. oclif generates `--help` from the command definitions.

## 15. Out of scope

- Player photos and licensing (v1).
- `TeamMarker` cross / saltire / star support — a design-system task, out of
  scope for this CLI but a prerequisite for the nation target (§2).
- Backfilling birth dates — designed in §8, deferred to v0.1.
- All 211 FIFA nations (§2).
- Retiring any skill. They coexist indefinitely.
- Any commercial API as a data source.
- Auto-detecting a team's league, or resolving ambiguous team names — the
  registry carries both explicitly.
- Concurrency.
