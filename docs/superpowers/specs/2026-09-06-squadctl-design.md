# squadctl — deterministic squad data management

**Status:** design, approved 2026-09-06. Supersedes `squad-fetch-prespec_1.md`,
which is kept in the repo as the record of what changed and why.

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

Extending `TeamMarker` with `cross` and `saltire` is a separate design-system
task, orthogonal to this spec. Because §5's registry makes adding a team an
append, deferring nations carries no architectural penalty and no rework.

## 3. Command surface

An oclif v4 app at `tools/squadctl/`.

```
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

The pre-spec's `--refresh` / `--no-cache` pair is inverted and reduced to one
flag. **Default fetches fresh and writes the cache.** The cache exists so a
_parser_ change can be re-run at zero network cost, not so stale data is served
by default. `--offline` re-parses from `.cache/wikitext/` and makes no requests.
`--no-cache` is dropped: `.cache/` is gitignored and a few KB per team, so
suppressing the write buys nothing.

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
  bin/dev.js                 tsx loader — no compile step
  README.md
  src/base-command.ts        BaseCommand: enableJsonFlag, shared reporter
  src/commands/fetch.ts
  src/commands/apply.ts
  src/lib/wiki-fetch.ts      HTTP + disk cache. The only networked file.
  src/lib/wikitext-parse.ts  pure: wikitext -> ParsedRow[]
  src/lib/reconcile.ts       pure: rows + stored -> WritePlan
  src/lib/assertions.ts      pure: WritePlan -> failures / conflicts / warnings
  src/lib/fifa-countries.ts  code -> country lookup
  src/lib/registry.ts        TeamRegistry type + validator
  src/lib/write-json.ts      shared prettier formatAndWrite
```

Everything testable without a network lives in the pure layer. The commands do
argument parsing, I/O and reporting only.

**`@oclif/core` and `tsx` go in the ROOT `devDependencies`.** `tools/squadctl/`
must not have its own `node_modules`: `metro.config.js` calls
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

**Identity is authoritative here and `apply` always writes it through.** This
deletes the pre-spec's "identity present means overwrite, absent means preserve"
rule, whose entire purpose was stopping a maintenance run from wiping every
marker in the repo. With one authoritative source that hazard does not exist.

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

### Three corrections to the pre-spec, from live wikitext

| Rule           | Pre-spec                                    | Corrected                                    | Why                                                                                                                                                                           |
| -------------- | ------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Captain        | `/captain/i` and not `/vice[-\s]?captain/i` | exact `/^captain$/i` on the **display** text | Arsenal carries `captain`, `vice-captain` **and** `3rd captain`. The pre-spec rule returns two captains and trips its own "≤1 captain" hard failure on the first team parsed. |
| Numberless row | drop from `members`                         | **keep** with `no: null`                     | `SquadMember.no` is `number \| null`; `int.json` has one, and `questionEngine` deliberately keeps it as a name distractor. Dropping it deletes stored data.                   |
| `asOf`         | read the section's stated date              | parse `{{updated\|1 September 2026}}`        | It is a template in the section header. Deterministic, no prose reading.                                                                                                      |

Only one captain per squad is tracked. Vice-captain, 3rd captain and every other
variant are ignored — there is no field for them.

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
squad player with no stored birth date. This is an accepted, deliberate
regression in exchange for removing ~25 requests per club squad.

## 9. Reconciliation and what sets `verified`

Match key is the normalised name — no `wikiTitle` is added anywhere. Within a
single squad normalised names are unique by construction. The two real collisions
in the current data (`fran garcia` → `fran-garcia` / `fran-garcia-torres`,
`ederson` → `ederson` / `ederson-silva`) are **cross-squad**, which is exactly
the case step 2 flags rather than guesses at.

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
| **Conflict**      | ambiguous global name match; a `no: null` member; unrecognised player-ish template; roster change >40% vs stored; section matched `Recent call-ups`                                                                                                      | Team **is** written, `verified: false`, reason named in the report. |
| **Warning**       | departed players; generated player id; club member count <18; nation member count outside 20–30                                                                                                                                                          | Written, `verified` stays `true`.                                   |
| **Informational** | new player with `birth: null`; orphan count                                                                                                                                                                                                              | Counted only.                                                       |

**`verified` is the output of the assertion pass**: `true` when a team has zero
conflicts, `false` otherwise. A deterministic parse has no hallucination surface,
so a clean run is a legitimate verification — this inverts the pre-spec's "always
false on write", which would have downgraded all 29 manually-verified squads on
the first sweep.

The blast-radius check compares against the stored squad file, so it is **skipped
for a team that has none** — every new team would otherwise trip it at 100%.

**Failures are per-team, not per-run.** The pre-spec aborts the entire run on any
assertion failure; at 150 teams that lets one restructured page block the other 149. Known consequence: `int` has a numberless member today and will flip to
`verified: false` on its first sync.

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

`Conflict` is a discriminated union — `ambiguous-name`, `numberless-member`,
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

| File                                   | Change                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `types/squad.ts`                       | `Player.birth` becomes `string \| null`                                                     |
| `lib/questionEngine.ts`                | `Question.age` becomes `number \| null`; guard `getAge`                                     |
| `app/play/[squadId]/[level]/index.tsx` | filter the `AGE` chip when age is null                                                      |
| `scripts/roster-envelope.ts`           | `EnvelopeMember.no` accepts `null`; `validateEnvelope` updated to match `SquadMember`       |
| `scripts/gen-squads.ts`                | extract `formatAndWrite` to the shared module                                               |
| `vitest.config.ts`                     | add `tools/**/*.test.ts` to `include`                                                       |
| `.gitignore`, `.prettierignore`        | add `.cache/`                                                                               |
| `package.json`                         | `@oclif/core` + `tsx` in `devDependencies`; `squadctl` script                               |
| `CLAUDE.md`                            | correct the stale "every generated squad carries `verified: false`" line; document squadctl |

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

All pure — no network. Beyond fixtures, the **29 existing manually-verified
squads are a test oracle**: a parse that reproduces 722 human-checked memberships
is stronger evidence than any hand-written fixture.

## 14. Docs

`tools/squadctl/README.md`: the two commands, the registry format with a worked
entry, the conflict taxonomy and what to do about each, the `--json` schema and
exit codes. oclif generates `--help` from the command definitions.

## 15. Out of scope

- Player photos and licensing (v1).
- `TeamMarker` cross / saltire / star support — a separate design-system task.
- All 211 FIFA nations (§2).
- Retiring any skill. They coexist indefinitely.
- Any commercial API as a data source.
- Auto-detecting a team's league, or resolving ambiguous team names — the
  registry carries both explicitly.
- Concurrency.
