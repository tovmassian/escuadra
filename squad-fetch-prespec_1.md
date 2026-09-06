# Pre-spec: deterministic squad fetching

**Status:** pre-spec. This document carries decisions and constraints settled outside
the repo. It is deliberately incomplete: every field name, file shape and script
contract below marked **[VERIFY]** must be checked against the actual codebase before
the real spec is written. Where this document and the repo disagree, **the repo wins** —
report the disagreement rather than silently following either one.

**Your first task is not to write code.** It is to read the files listed in §1, then
produce a corrected spec that resolves every **[VERIFY]** and every item in §14.

---

## 1. Read these first

| Path                                                                 | What to extract                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `types/squad.ts`                                                     | Exact `Player`, `SquadMember`, `Squad`, `League` types. Which fields are optional.          |
| `data/players.json`                                                  | Record shape, `id` conventions, nationality spellings in use, entry count.                  |
| `data/index.json`                                                    | Shape, and how squad ids/leagues appear in it.                                              |
| `data/squads/` (2–3 files, incl. one club + one nation)              | Real squad file shape and formatting.                                                       |
| `scripts/roster-envelope.ts`                                         | `RosterEnvelope` / `EnvelopeMember` shape, `normalizeName`, status enum.                    |
| `scripts/envelope-check.ts`                                          | What `validateEnvelope` enforces.                                                           |
| `scripts/gen-squads.ts`                                              | What it reads, what it writes, what it throws on.                                           |
| `.claude/skills/squad-factory/references/wikitext-roster-parsing.md` | Existing parsing rules — this spec supersedes it, but port anything it has that this omits. |
| `.claude/skills/squad-factory/` (all skills)                         | The behaviour being replaced.                                                               |

Also check whether `EnvelopeMember.clubNat` and `Player.fullName` have any consumer
anywhere in the codebase. Both appear to be parsed/branched on but never read. If
confirmed unused, drop them.

---

## 2. What this replaces and why

`squad-fetcher`, `squad-writer` and `squad-verifier` are LLM skills executing a process
that is almost entirely mechanical. Handling ~20 teams currently costs two days and a
large token spend. Every step except national-flag marker design is deterministic.

The replacement is two scripts. The agentic skills are retired, except for one-time
intake design work (§11).

The dominant cost in the current pipeline is a per-player Wikipedia article fetch to
obtain `birth`, because `Player.birth` is required and club-squad wikitext doesn't carry
it. That is ~25 extra requests per club squad, the most fragile parse in the system
(biography infoboxes), and the root cause of the entire name-ambiguity/deferral
machinery. §6 and §7 remove it.

---

## 3. CLI contract

Two phases. Phase 1 touches the network and is idempotent per input. Phase 2 is a pure
function of its inputs and touches the repo.

```
node scripts/fetch-squads.ts \
  --kind club|nation \
  --league la-liga|serie-a|bundesliga|ligue-1|premier-league|ucl   # required iff kind=club
  --season 2025-26 \
  --urls  path/to/urls.txt \
  --out   .cache/envelopes/<runId>/ \
  [--refresh]        # bypass the wikitext cache
  [--no-cache]       # don't write to it either
```

```
node scripts/apply-squads.ts .cache/envelopes/<runId>/*.json [--dry-run]
```

- **League is an argument, never inferred.** One invocation = one league. It determines
  the output folder only.
- **`--season` is an argument.** `team.season` is currently required by
  `validateEnvelope` but derived nowhere in the existing skills — this closes that gap.
- **Input is a list of Wikipedia URLs**, one per line, `#` comments and blanks ignored.
  Because the input is URLs rather than team names, page-title resolution and
  ambiguous-name handling are out of scope entirely.
- `--dry-run` on phase 2 prints the full report and diff but writes nothing.

**[VERIFY]** whether the `RosterEnvelope` intermediate should survive. Recommendation:
keep it. It is a good interface, it gives a human-reviewable artifact between fetch and
write, and it means a parser change can be re-applied without re-fetching.

---

## 4. Fetching

Two requests per team, no more.

1. `https://en.wikipedia.org/w/api.php?action=parse&page=<Title>&prop=sections&format=json`
2. `https://en.wikipedia.org/w/index.php?title=<Title>&action=raw&section=<N>`

`<Title>` is derived from the input URL's path segment.

**Never route these through any tool that summarises through a model.** Raw HTTP only.

**Cache** every raw section response to `.cache/wikitext/<title>.<section>.wikitext`
before parsing, and read from cache unless `--refresh`. Re-running the parser then costs
zero requests, and a changed output is attributable to your parser rather than to
Wikipedia.

**Send a descriptive `User-Agent`** identifying the tool and a contact address —
Wikimedia's policy allows refusing generic or absent agents. Requests are sequential
with a small delay (≈200ms); 20 teams is 40 requests and needs no concurrency.

### Section selection

Scan the sections response, take the **first** match in this order, record the matched
title verbatim:

1. `Current squad`
2. `First-team squad`
3. `First team squad`
4. `Players`
5. `Recent call-ups`

Falling down the list is normal — most English club articles never use `Current squad`.
Only a page with **no** match is a failure. A `Recent call-ups` match is a call-up list,
not a contract roster: record it in `warnings` along with the section's stated "as of"
date.

---

## 5. Parsing

### Template matching

Match any template in the section whose name matches `/^(nat\s+)?fs\s+[a-z\s]*player/i`.
This covers at least `Fs player`, `nat fs player`, `nat fs g player`,
`nat fs player no caps`. Do **not** hardcode an exact list — a template name that looks
player-ish but doesn't match a known variant is a warning, not a silent skip.

### Parameter splitting — implementation trap

**Split on `|` at brace/bracket depth zero only.** Naive splitting breaks on
`age={{birth date and age|df=y|1995|9|15}}`, which contains three pipes inside `{{}}`.
Track `{{ }}` and `[[ ]]` depth. Parse into a generic `Record<string, string>` of named
parameters first, then apply field rules — don't hardcode positional assumptions.

### Wikilink extraction

For any wikilinked value `[[Target#Anchor|Display]]`:

- **title** = `Target`, anchor stripped, `_` → space, whitespace collapsed, HTML entities
  decoded. Do not case-fold beyond the first character.
- **display** = `Display`, or `Target` when there is no `|`.

`[[Rodri (footballer, born 1996)|Rodri]]` yields title
`Rodri (footballer, born 1996)` and display `Rodri`. Both matter — see §6.

An unlinked plain-text `name=` value has no title: set `wikiTitle: null`, fall back to
the normalised display name as match key, and add a `warnings` entry.

### Captain flag

`other=` matching `/captain/i` **and not** `/vice[-\s]?captain/i`. Vice-captain has no
field and must not set `captain: true`.

### Drop rule

A row with no `no=` value is dropped from `members` (uncapped/fringe call-ups). Count
drops and report them.

---

## 6. The primary-key change

**Add `wikiTitle` to `EnvelopeMember` and to `Player`. Use it as the reconciliation match
key.** Do not change `Player.id` — squad files reference it, and the existing kebab-case
convention stays as the human-readable identifier.

Rationale, briefly: Wikipedia article titles are unique by construction. Two players
called Rodrigo have two different titles. This is an exact-match key that costs zero
additional requests, because the title is already in the `name=` wikilink you parse. It
replaces the current normalised-name-plus-birth key and, with it, the ambiguity rule, the
`NEEDS_DECISION` deferral path, and the name-only-match logic — those become unreachable
rather than automated.

It is also the join key to Wikidata (§7) and, later, to Commons for v1 photos.

### Migration

`data/players.json` has no `wikiTitle` today. Write a one-time
`scripts/backfill-wikititles.ts` that, for each stored squad, fetches its section
wikitext and maps normalised display name → `wikiTitle` **within that squad's scope**.
Name collisions within a single squad don't occur, so this is safe. Report any stored
player left unresolved for manual fixing; do not guess.

Run this before the first `apply-squads.ts` run. **[VERIFY]** how many entries
`players.json` currently holds.

---

## 7. `birth` handling

Age is displayed in-game, so `birth` is not dead weight — but it must stop being
expensive.

**v0:**

- `Player.birth` becomes **nullable** (`string | null`, `YYYY-MM-DD`). **[VERIFY]** what
  `types/squad.ts` declares today and what the UI does with a null — the age display
  needs to hide rather than render `NaN`.
- **Nation squads:** parse from `age={{birth date and age|df=y|YYYY|M|D}}`. Free, already
  in the wikitext.
- **Club squads:** `birth: null`. **Never fetch a player's article for it.** This is the
  single change that removes the two-day cost.

**v0.1 — separate script, `scripts/backfill-birthdates.ts`:** two requests per squad
fills every missing date.

1. `action=query&prop=pageprops&ppprop=wikibase_item&titles=A|B|C...` — up to 50 titles
   per request, returns each page's Wikidata QID.
2. One SPARQL query to `https://query.wikidata.org/sparql`:
   `SELECT ?item ?dob WHERE { VALUES ?item { wd:Q… wd:Q… } ?item wdt:P569 ?dob . }`

Wikidata is CC0, so nothing here creates a licensing obligation. **[VERIFY]** both
request shapes against live endpoints before relying on them — neither has been tested.

---

## 8. Field population

Two fields are not read directly off a template line. Both rules already exist in the
current reference and carry over unchanged.

**`nationality`** — always a full country name matching the spelling already used in
`data/players.json`, never a raw FIFA code.

- Club squads: translate the `nat=` FIFA code. Build the mapping table from the
  distinct nationality values already present in `players.json` so no new spelling is
  invented; fail loudly on an unmapped code rather than passing it through.
- Nation squads: no per-member field exists — set every member to the squad's country.

**`club`** — matching the form in `players.json` (`Arsenal`, not `Arsenal F.C.`); use the
wikilink **display** text, not the title.

- Nation squads: parse each member's own `club=`.
- Club squads: set every member to the squad's own `team.name`.

---

## 9. Writing (phase 2)

- **Atomic per run.** Reconcile every team in memory, run every assertion in §10, then
  write. Any assertion failure aborts the whole run with nothing written. There is no
  partial-batch state and no per-team deferral.
- **`members` is a full replace**, never merged with what was stored.
- **`identity` (`primaryColor`/`secondaryColor`/`marker`): present means overwrite,
  absent means preserve what's stored.** Absent must never mean clear. A maintenance run
  carries `identity`-less envelopes for every team at once, so inverting this wipes every
  marker in the repo in one run with no signal. If `identity` is absent **and** no stored
  file exists, abort — do not fabricate a colour.
- **`verified` is always `false`** on any write. Report a `true → false` downgrade
  explicitly.
- **`photo` stays `null`** in v0 unconditionally.
- Regenerate `data/index.json` / `lib/squads.generated.ts` by running
  `node scripts/gen-squads.ts` **once** at the end. Never hand-edit either.
  **[VERIFY]** whether direct `node` invocation is still preferred over `npm run` — the
  existing skill says yes, on Windows startup cost.

### Determinism

Two runs on the same cached wikitext must produce byte-identical files.

- `members` sorted by `no` ascending.
- `players.json` keys sorted.
- Fixed serialisation: 2-space indent, trailing newline, `\n` line endings. **[VERIFY]**
  against existing files — match whatever is there.
- **`lastUpdated` only changes when the rest of the squad file changed.** Otherwise a
  no-op re-run churns the git diff.

---

## 10. Assertions

These are the point of going deterministic: guarantees a model processing 26 rows in one
pass cannot give. All are hard failures unless marked warn.

| Check                                               | Level |
| --------------------------------------------------- | ----- |
| Section matched one of the five titles              | fail  |
| ≥1 member parsed                                    | fail  |
| Club squad member count ≥ 14                        | fail  |
| Club squad member count < 18                        | warn  |
| Nation squad member count outside 20–30             | warn  |
| Every member has `no`, `pos`, `name`                | fail  |
| `pos ∈ {GK, DF, MF, FW}`                            | fail  |
| `no` in 1–99                                        | fail  |
| `no` unique within squad                            | fail  |
| `wikiTitle` unique within squad                     | fail  |
| `wikiTitle` non-null                                | warn  |
| ≤1 captain per squad                                | fail  |
| `nationality` mapped to a known country name        | fail  |
| Unrecognised player-ish template variant in section | warn  |
| Roster size changed >40% vs stored squad            | warn  |

Warnings accumulate on the envelope's `warnings[]` and appear in the report; they never
block a write.

---

## 11. What stays human/LLM work

- **Marker and colour design on intake.** Reading kit colours and expressing a national
  flag as bands/weights/overlay is genuine design work, done once per team. Keep it as a
  small skill or a manual step; it is not part of these scripts.
- **Teaching the parser a new template variant**, when an unrecognised-variant warning
  fires.
- **Producing the input URL list.**

---

## 12. Failure behaviour

Exit non-zero with a structured, greppable line on stderr. No file is written on any
failure. Suggested codes: `1` network/HTTP, `2` no matching section, `3` parse produced
nothing usable, `4` assertion failure, `5` repo write/generator error.

The existing skills' `SOURCE_BROKEN` / `PARSE_FAILED` reasons map onto 2 and 3. **[VERIFY]**
whether the status enum in `roster-envelope.ts` should be kept for envelope contents even
though the failure path no longer produces envelope files.

---

## 13. Tests

Save raw wikitext fixtures and assert exact parsed output. Five shapes cover the field:

1. Club page matching at priority 2 (`First-team squad`) — e.g. Arsenal.
2. Nation page matching at priority 1 (`Current squad`).
3. Nation page with only `Recent call-ups`.
4. A page with a captain **and** a vice-captain (guards the §5 regex).
5. A page with a `no`-less row that must be dropped.

Plus a fixture with a disambiguated wikilink (`[[Rodri (footballer, born 1996)|Rodri]]`)
and one with `age={{birth date and age|...}}` to guard the depth-aware splitter.

These five replace the entirety of both skills' "Common mistakes" sections.

---

## 14. Resolve before writing the real spec

1. Does the `RosterEnvelope` layer survive, or does `fetch-squads.ts` write squad files
   directly? (Recommendation: survives.)
2. Exact `Player` / `SquadMember` / `Squad` shapes, and what changes to accept
   `wikiTitle` and a nullable `birth`.
3. Does the UI handle `birth: null` today? If not, what is the minimal change?
4. Do `clubNat` and `fullName` have consumers? If not, remove them from the envelope and
   from `Player`.
5. Current `players.json` entry count, and how many resolve cleanly in the §6 migration.
6. Which FIFA codes appear across the target leagues, and the exact country spellings
   already in `players.json` to map them to.
7. Does `gen-squads.ts` need any change, or does it work unmodified against the new
   files?
8. Retirement plan for `squad-fetcher` / `squad-writer` / `squad-verifier` and the shared
   parsing reference.

---

## 15. Out of scope for v0

- Player photos and the licensing/manifest architecture (v1).
- Automating the `verified` flag. An API-Football free-tier cross-check on roster size
  and shirt-number set is the intended mechanism later — 20 calls, never shipped in the
  binary. Its `name` values are unreliable and must not be used for name matching.
- Any commercial API as a data source. Wikipedia wikitext carries more of this schema
  than any API examined, including per-player nationality on club squads.
- Auto-detecting a team's league or resolving ambiguous team names.
- Concurrency. 40 sequential requests is fast enough.
