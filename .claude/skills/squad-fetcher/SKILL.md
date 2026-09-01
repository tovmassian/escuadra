---
name: squad-fetcher
context: fork
description: Use when fetching an Escuadra team's current roster from Wikipedia into a roster envelope — new-team intake, or a full re-read of a squad. Read-only: parses raw wikitext and writes one envelope JSON file, never touching players.json, squad files, or the generated index.
---

# Squad Fetcher

## Overview

Given one team name (club or nation), fetch its current roster from
Wikipedia. On a clean parse, write it to **one output file**: a roster
envelope at `.claude/tmp/squad-factory/<runId>/<squadId>.json`. That
envelope is the entire deliverable when one is produced — this skill
writes at most one file, and (see the output contract) sometimes none at
all. Its one guarantee either way is that nothing else on disk is
touched — not `data/players.json`, not any squad file under
`data/squads/`, not `data/index.json`, not `lib/squads.generated.ts`. It
never runs `npm run gen:squads`. Reconciling players and writing squad
files is [[squad-writer]]'s job, run separately, later, sequentially, once
this skill's envelope (and every other team's) is in hand.

This is the read half of the retired `squad-updater` — its steps 1-6 only.
It is dispatched as one of potentially many parallel subagents, one per
team, because a pure read has no shared-write hazard: unlike a writer, two
fetches running at once can never race on the same file.

## Parsing rules live elsewhere — follow them, don't reinvent them

**Read `.claude/skills/squad-factory/references/wikitext-roster-parsing.md`
before parsing anything, and follow it exactly.** It is the single source
for page title resolution, the two-step fetch, section selection, the two
club/nation template families and how to read them, field extraction, the
drop-rows rule, and the never-trust-a-prose-summary rule. None of that is
repeated here — the reference exists specifically to end the drift that
happened when two skills each carried their own copy of the same rules.
If something about a page doesn't fit what the reference describes, that's
a `PARSE_FAILED` or `SOURCE_BROKEN` (see below), not licence to improvise a
new parsing rule inline.

The one instruction worth restating because it's the most common way to
get this wrong: **never use WebFetch, or any other tool that summarises a
page through a model, to read the roster.** Fetch the raw wikitext
directly (`action=raw&section=<N>`) and parse the template lines yourself.
A prose summary of a roster table is not ground truth at any point in this
skill.

## Procedure (one team)

1. **Resolve the Wikipedia page title**, per the reference's page-title
   rules. If the name is ambiguous (e.g. "Milan" → AC Milan vs
   Internazionale) do not guess — see the no-questions rule below.

2. **Find the squad section index** via the sections API, per the
   reference's two-step fetch and its section-selection rule. Record
   whichever section title you used in `team.sectionTitle`, and the
   section's "as of" date (if any) in `team.asOf`. Neither of the
   reference's two acceptable sections existing on the page is
   `SOURCE_BROKEN`.

3. **Fetch the raw wikitext** of that section directly — never through a
   summarising tool.

4. **Parse each member** per the reference, populating the envelope's
   `EnvelopeMember` fields (`scripts/roster-envelope.ts`): shirt number
   (`no`), `position`, display `name`, `captain` flag, and — nation
   squads only — `club`/`clubNat`/`birth`; club squads only —
   `nationality` (see the nationality rule below for exactly what value
   belongs there). Keep the literal template line for every parsed member
   in `raw` — the writer needs it and must never have to re-fetch or
   re-parse Wikipedia to reconstruct a member it wasn't given verbatim.
   Apply the reference's drop rule for members it doesn't want kept. Zero
   parsed members is `PARSE_FAILED` (see Failure statuses) — never an
   empty `OK` roster.

5. **Determine the squad id.** Check `data/index.json` first: if this team
   is already in the manifest, reuse its `id` exactly — this is a
   maintenance re-read, not intake. If the team isn't present, this is
   new-team intake: mint a short lowercase id following the existing
   convention (3-4 letters, e.g. `ars`, `rma`, `int`, `bra`), unique
   against every id already in `data/index.json`.

6. **On intake only** (id was minted in step 5, not reused): determine the
   team's real identity colours and build its `marker`, and set
   `identity` on the envelope — see the identity rule below. On a
   maintenance re-read of a team whose id already existed, skip this step
   entirely; do not populate `identity` at all.

7. **On `status: OK` only, write the envelope** to
   `.claude/tmp/squad-factory/<runId>/<squadId>.json` (create the
   directory if it doesn't exist) using the `RosterEnvelope` shape from
   `scripts/roster-envelope.ts` — read that file for the exact field
   names; don't work from memory or from this document's paraphrase of it.
   Include `warnings` as an array on every envelope you write — `[]` when
   there's nothing to flag, or a short note (e.g. a "Recent call-ups"
   fallback, a questionable name spelling) when there is; the field is
   required, not optional. On any other status
   (`NEEDS_DECISION`/`SOURCE_BROKEN`/`PARSE_FAILED`), **do not write a
   file at all** — go straight to step 9's failure return. See the output
   contract below for why.

8. **Validate before returning** (`OK` only). Run
   `node scripts/envelope-check.ts <path>` against the file you just wrote
   and fix any reported problem — a validation failure here means the
   envelope is malformed, not that the tool is wrong. Do not return until
   it reports the file `OK`.

9. **Return exactly one line** — the format depends on `status`. See
   "The output contract" below for the two exact forms and worked
   examples. Never return the envelope's contents as prose, and never
   paste `members` or `identity` into the response — the file on disk (when
   one exists) is the artifact; the return line is just its address and
   status.

## The output contract

**An envelope file is written only when `status: OK`.** Every other
status is reported entirely through the one-line return — no file, no
partial envelope, nothing under `.claude/tmp/squad-factory/`. This is
deliberate, not a shortcut: the envelope exists to hand `squad-writer` a
_parsed roster_, and the orchestrator only ever passes `OK` envelopes to
the writer regardless of status — a `NEEDS_DECISION`/`SOURCE_BROKEN`/
`PARSE_FAILED` envelope would have no consumer. It would also be
unsatisfiable: `validateEnvelope` requires `team.id`, `team.name`,
`team.season`, `team.source`, `team.sectionTitle` to be non-empty strings
and `team.league` to be set for a club — none of which are knowable for,
say, an unresolved "Milan" or a club in an unrecognized league. Reporting
the failure directly, instead of forcing values into a schema built for a
successful parse, avoids that whole class of problem. Failure information
lands in the run report the orchestrator compiles from every subagent's
return line, not in a file on disk.

The two return forms, exactly:

- **`status: OK`** → `OK <squadId> <path>` — `<path>` is exactly where the
  validated envelope was written.

  ```
  OK ars .claude/tmp/squad-factory/2026-09-01T0417/ars.json
  ```

- **Any other status** → `<STATUS> <identifier> - <reason>`, one line, no
  file written. `<identifier>` is the squad id when one was already
  resolved (a maintenance re-read that then hits `SOURCE_BROKEN` or
  `PARSE_FAILED` still knows its id); otherwise it's the team name exactly
  as given (an intake `NEEDS_DECISION` on an ambiguous name has no id to
  report). `<reason>` is one line the orchestrator's report can use
  verbatim — for `NEEDS_DECISION`, name every candidate with enough detail
  to disambiguate (page URL, league, or existing id); for
  `SOURCE_BROKEN`/`PARSE_FAILED`, state plainly what went wrong.

  ```
  NEEDS_DECISION Milan - ambiguous team name: AC Milan (https://en.wikipedia.org/wiki/AC_Milan) or Inter Milan (https://en.wikipedia.org/wiki/Internazionale, already stored as id "int")
  SOURCE_BROKEN atl - https://en.wikipedia.org/wiki/Atletico_Madrid has no section matching the reference's section-selection rule
  PARSE_FAILED bra - zero members survived parsing the "Current squad" section; the member rows didn't match the shape the reference describes
  ```

## The identity rule

Include the `identity` key **only** on new-team intake (step 6). On a
maintenance re-read of a squad whose id already existed in
`data/index.json`, omit `identity` entirely — do not set it to `null`,
an empty object, or the values you happen to see on the page. An **absent**
key means "not inspected" and tells the writer to preserve whatever
`primaryColor`/`secondaryColor`/`marker` is already stored; an _incorrect_
present key would overwrite good stored data with something this skill was
never asked to verify (kit colours read off an infobox are not the same
fact as a nation's flag, for instance).

When `identity` is included, it must be **real, sourced colour**, never
invented, guessed, or rotated:

- A single-colour club (e.g. Arsenal, Real Madrid) gets a **one-entry**
  `bands` array — a plain field, not a manufactured two-tone split from a
  trim or away colour that isn't a genuine second identity colour.
- A nation's marker **is its flag** — bands and, where applicable,
  `weights`/`overlay` reproducing the flag's real geometry. National
  emblems and coats of arms are omitted by design; do not add an overlay
  to represent one.
- `primaryColor`/`secondaryColor` are hex, and must be the team's actual
  colours from a reliable source (e.g. the Wikipedia infobox's
  `clubColors`/`pattern` fields) — never a value chosen because it "looks
  about right."

## The nationality rule

`EnvelopeMember.nationality` must be a full country name, in the same form
`data/players.json` already stores throughout (`Spain`, not `ESP`) —
`squad-writer` copies this field verbatim into a new player record and
performs no translation of its own, so this envelope is the only place a
raw code ever gets converted.

- **Club squads**: translate the wikitext's `nat=` FIFA code into the
  country's full name. Match the spelling already used elsewhere in
  `data/players.json` rather than inventing a new one.
- **Nation squads**: the wikitext carries no per-member nationality field —
  the whole page is one nationality — so set every member's `nationality`
  to the squad's own country. That every member shares one nationality is
  exactly why the level-3 question on a nation squad asks for the player's
  club instead.

## The no-questions rule

This skill runs as one of potentially many parallel subagents dispatched
in the same batch. It has no operator to prompt and must never block
waiting on one. Every ambiguity becomes status `NEEDS_DECISION` on the
return line instead of a question:

- **Ambiguous team name** (e.g. "Milan" could mean AC Milan or
  Internazionale) → `NEEDS_DECISION`, with every candidate named in the
  return line's reason (see the output contract).
- **A club whose real domestic league isn't one of the closed `League`
  values** (`la-liga`, `serie-a`, `bundesliga`, `ligue-1`,
  `premier-league`, `ucl`) → also `NEEDS_DECISION`. Never invent a league
  folder or force the club into the nearest big-5 league to make the
  envelope valid.

**No envelope file is written for `NEEDS_DECISION`** — per the output
contract, this status is reported entirely through the return line. The
downstream orchestrator (or whoever dispatched this skill) surfaces the
listed candidates to a human from that line, not from a file.

## Failure statuses

Use `scripts/roster-envelope.ts`'s exact status strings — there is no
freeform status text. Like `NEEDS_DECISION`, neither of these writes an
envelope file — both are reported entirely through the return line, per
the output contract:

- **`SOURCE_BROKEN`** — the page 404s or has moved, or the page has
  neither section the reference's section-selection rule accepts.
- **`PARSE_FAILED`** — zero members survive parsing, or the member rows
  are malformed in a way the reference's rules don't account for. State
  this plainly: **zero parsed members is `PARSE_FAILED`, never an empty
  `OK` squad.** An empty roster must never be reported as `OK`.

## Common mistakes

- Using WebFetch, or any other tool that summarises through a model, to
  read the roster — the wrong tool for this step regardless of prompt.
  Fetch raw wikitext directly.
- Writing to `data/players.json`, any squad file, `data/index.json`, or
  `lib/squads.generated.ts`, or running the generator — none of that is
  this skill's job; it writes exactly one file, its own envelope.
- Emitting `identity` on a maintenance re-read of a team whose id was
  already in `data/index.json` — `identity` is intake-only. Guessed or
  "current infobox kit colour" values are never an acceptable substitute
  for omitting the key.
- Guessing a `League` value for a club outside the closed set instead of
  returning `NEEDS_DECISION`.
- Leaving `nationality` as the raw `nat=` FIFA code, or leaving it unset for
  a nation-squad member, instead of the full country name `squad-writer`
  expects to copy verbatim — see the nationality rule.
- Returning `status: OK` with an empty `members` array — that's
  `PARSE_FAILED`.
- **Writing an envelope file for `NEEDS_DECISION`, `SOURCE_BROKEN`, or
  `PARSE_FAILED`** — only `OK` ever produces a file; forcing values into
  `team.id`/`team.league`/etc. to satisfy the schema on a status that
  doesn't have them yet is exactly the mistake the output contract exists
  to rule out.
- Asking the operator anything, or blocking on an assumption that someone
  will answer — this skill cannot prompt; ambiguity is `NEEDS_DECISION`,
  not a question.
- Skipping `node scripts/envelope-check.ts <path>` before returning an
  `OK`, or returning despite it reporting a problem.
- Omitting `warnings` from a written envelope, or setting it to anything
  other than an array — `[]` is required when there's nothing to flag.
- Returning the envelope's JSON contents in the response text instead of
  the one-line return format — the file (when one exists) is the
  deliverable, not the response.
