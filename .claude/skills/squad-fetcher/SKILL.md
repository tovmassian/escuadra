---
name: squad-fetcher
context: fork
description: Use when fetching an Escuadra team's current roster from Wikipedia into a roster envelope — new-team intake, or a full re-read of a squad. Read-only: parses raw wikitext and writes one envelope JSON file, never touching players.json, squad files, or the generated index.
---

# Squad Fetcher

## Overview

Given one team name (club or nation), fetch its current roster from
Wikipedia and write it to **one output file**: a roster envelope at
`.claude/tmp/squad-factory/<runId>/<squadId>.json`. That envelope is the
entire deliverable. This skill's one guarantee is that nothing else on disk
is touched — not `data/players.json`, not any squad file under
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
template families (`{{Fs player|...}}` for clubs, `{{nat fs g
player|...}}` for nations), field extraction, the drop-rows-without-`no`
rule, and the never-trust-a-prose-summary rule. Those rules are not
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
   reference's two-step fetch. Prefer "Current squad"; fall back to
   "Recent call-ups" and record that fallback plus the "as of" date in
   `team.sectionTitle` / `team.asOf`. Neither section existing is
   `SOURCE_BROKEN`.

3. **Fetch the raw wikitext** of that section directly — never through a
   summarising tool.

4. **Parse each member** per the reference: shirt number, position,
   display name, captain flag, and (nation squads) `club`/`clubNat`/birth,
   or (club squads) `nat`. Keep the literal template line for every parsed
   member in `raw` — the writer needs it and must never have to re-fetch or
   re-parse Wikipedia to reconstruct a member it wasn't given verbatim.
   Drop any row with no `no=` value, per the reference's drop rule. Zero
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

7. **Write the envelope** to
   `.claude/tmp/squad-factory/<runId>/<squadId>.json` (create the
   directory if it doesn't exist) using the `RosterEnvelope` shape from
   `scripts/roster-envelope.ts` — read that file for the exact field
   names; don't work from memory or from this document's paraphrase of it.

8. **Validate before returning.** Run
   `node scripts/envelope-check.ts <path>` against the file you just wrote
   and fix any reported problem — a validation failure here means the
   envelope is malformed, not that the tool is wrong. Do not return until
   it reports the file `OK`.

9. **Return exactly one line**: `<status> <squadId> <path>`. Never return
   the envelope's contents as prose, and never paste `members` or
   `identity` into the response — the file on disk is the artifact; the
   return line is just its address and status.

## The identity rule

Include the `identity` key **only** on new-team intake (step 6). On a
maintenance re-read of a squad whose id already existed in
`data/index.json`, omit `identity` entirely — do not set it to `null`,
an empty object, or the values you happen to see on the page. An **absent**
key means "not inspected" and tells the writer to preserve whatever
`primaryColor`/`secondaryColor`/`marker` is already stored; an *incorrect*
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

## The no-questions rule

This skill runs as one of potentially many parallel subagents dispatched
in the same batch. It has no operator to prompt and must never block
waiting on one. Every ambiguity becomes a status on the envelope instead
of a question:

- **Ambiguous team name** (e.g. "Milan" could mean AC Milan or
  Internazionale) → `status: NEEDS_DECISION`, with each candidate named in
  `decisions[]`.
- **A club whose real domestic league isn't one of the closed `League`
  values** (`la-liga`, `serie-a`, `bundesliga`, `ligue-1`,
  `premier-league`, `ucl`) → also `NEEDS_DECISION`. Never invent a league
  folder or force the club into the nearest big-5 league to make the
  envelope valid.

A `NEEDS_DECISION` envelope still gets written and validated like any
other — it just carries no usable roster for the writer to act on, and the
downstream orchestrator (or whoever dispatched this skill) surfaces the
listed candidates to a human instead.

## Failure statuses

Use `scripts/roster-envelope.ts`'s exact status strings — there is no
freeform status text:

- **`SOURCE_BROKEN`** — the page 404s or has moved, or the page has
  neither a "Current squad" nor a "Recent call-ups" section to read a
  roster from.
- **`PARSE_FAILED`** — zero members survive parsing, or the template block
  is malformed in a way the reference's rules don't account for. State
  this plainly: **zero parsed members is `PARSE_FAILED`, never an empty
  `OK` squad.** An empty roster must never be written under status `OK`.

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
- Returning `status: OK` with an empty `members` array — that's
  `PARSE_FAILED`.
- Asking the operator anything, or blocking on an assumption that someone
  will answer — this skill cannot prompt; ambiguity is `NEEDS_DECISION`,
  not a question.
- Skipping `node scripts/envelope-check.ts <path>` before returning, or
  returning despite it reporting a problem.
- Returning the envelope's JSON contents in the response text instead of
  the one-line `<status> <squadId> <path>` — the file is the deliverable.
