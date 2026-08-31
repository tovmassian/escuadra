# Squad data factory design

## Problem

Squad data is maintained by two skills that don't talk to each other.
`squad-updater` fetches a team from Wikipedia and writes it; `squad-verifier`
re-fetches a stored team and reports drift. Both work. Neither composes.

Running an actual maintenance pass today means: invoke the verifier, read its
worksheet, decide which teams need repair, invoke the updater once per team,
paste the worksheet in, then re-check by hand. The orchestration lives in the
operator's head and the handoff medium is prose — the verifier writes English,
a human relays it, the updater re-interprets it. That is a lossy hop between
two agents that both already hold the same structured facts.

Two further problems follow from the split:

- **`squad-updater` is a monolith across a hazard boundary.** Its twelve steps
  mix read-only work that is perfectly parallel-safe (resolve page, fetch
  wikitext, parse roster) with writes to files shared by every team
  (`players.json`, and the generator's outputs). Because the write half can't
  be parallelised, the read half isn't either — the skill runs teams strictly
  in sequence. `squad-verifier`, which has no shared writes, already dispatches
  one subagent per team in parallel and is measurably the better-shaped skill
  for it.
- **The wikitext parsing rules are duplicated in both SKILL.md files** as prose,
  and have begun to drift. There is one set of rules and it should live in one
  place.

This spec replaces the two skills with three single-purpose workers and a thin
orchestrator, cut along the boundary that actually matters: parallel-safe reads
versus sequential shared writes.

## Non-goals

- **No scheduling.** The factory is invoked on demand. Cron is a designed-for
  extension (see the last section), not built here.
- **No auto-commit.** A run leaves the working tree dirty and reports what it
  did. Review and commit stay with the operator.
- **No new data sources.** Wikipedia remains the only source. The envelope
  contract is source-agnostic so a second source is additive, but none is
  added now.
- **No change to the squad or player JSON schemas**, beyond correcting
  CLAUDE.md's description of `players.json` to match reality (it omits
  `fullName` and `club`, both of which exist in the file today).
- **No photo handling.** Hard constraint #1 still holds for v0. The design is
  shaped so photos slot in later; nothing photo-related is built.
- **`verified` semantics are unchanged.** The writer always sets it `false`;
  the verifier sets it to match its verdict. Neither gains new authority.

## Architecture

Four components. The split is by **write hazard**, not by subject matter:

| Component        | Concurrency             | Touches                                        |
| ---------------- | ----------------------- | ---------------------------------------------- |
| `squad-fetcher`  | parallel, N subagents   | nothing on disk except its own envelope file   |
| `squad-verifier` | parallel, N subagents   | one `verified` flag, in that squad's own file  |
| `squad-writer`   | **strictly sequential** | `players.json`, squad files, generator outputs |
| `squad-factory`  | orchestrator only       | nothing — dispatches, partitions, reports      |

`squad-fetcher` and `squad-verifier` are both **readers**: they resolve a
Wikipedia page, pull raw wikitext, and parse a roster. They emit the same
artifact. `squad-writer` is the sole **writer**, and the sole owner of every
file more than one team can touch.

The orchestrator performs no data work of its own. It dispatches, partitions
results by status, sequences the writer, and compiles the report. If it finds
itself parsing wikitext or reconciling a player, the boundary has been drawn
wrong.

### Why the readers emit one shape

`squad-verifier` already parses the complete live roster — it has to, in order
to diff it. Today it discards that parse and emits prose. Emitting the parsed
roster costs it nothing and means the writer has exactly one input format,
regardless of which pipeline produced it.

The human-readable worksheet does not disappear. It remains the verifier's
report of _what changed_, for the operator. It simply stops being the
mechanism by which the fix is applied.

## The roster envelope

One per team, per run. Produced by both readers, consumed by the writer.

```ts
type RosterEnvelope = {
  status: 'OK' | 'NEEDS_DECISION' | 'SOURCE_BROKEN' | 'PARSE_FAILED';

  team: {
    id: string; // reused for a known squad; newly minted on intake
    kind: 'nation' | 'club';
    name: string;
    league?: League; // club only
    season: string;
    source: string; // exact article URL fetched
    sectionTitle: string; // "Current squad" | "Recent call-ups" | ...
    asOf: string | null; // the date Wikipedia claims, not today
  };

  // Present ONLY on new-team intake. Absent means "not inspected" — see below.
  identity?: {
    primaryColor: string;
    secondaryColor: string;
    marker: TeamMarker;
  };

  members: {
    name: string; // display name
    fullName?: string;
    no: number;
    position: 'GK' | 'DF' | 'MF' | 'FW';
    captain?: true;
    nationality?: string; // club squads: from nat=
    club?: string | null; // nation squads: from club=
    clubNat?: string;
    birth?: string; // ISO; nation templates carry it
    raw: string; // the literal template line
  }[];

  warnings: string[];
  decisions?: string[]; // populated when status is NEEDS_DECISION
};
```

### `raw` on every member

Each member carries the literal wikitext template line it was parsed from.
This generalises an insight already present in `squad-verifier` (which carries
raw lines for missing players so the updater need not re-fetch): the writer
never has to trust a paraphrase, and any later dispute is auditable against
source without a network call.

### `identity` is absent, not empty, on maintenance

`squad-verifier` is forbidden from checking `primaryColor`, `secondaryColor`,
`marker`, and `season` — for good reason, documented in its own Scope section:
a nation's marker is its flag, Wikipedia's infobox gives kit colours, and
diffing one against the other produces confident false positives.

So on a maintenance run the envelope carries **no** `identity` key. The
writer's rule is therefore:

- `members` — always full replace. It is always completely parsed.
- `identity` — merge only if the key is present. Absent preserves what is
  stored.

Getting this wrong wipes every marker in the repo on the first maintenance
sweep. The alternative considered — have the verifier echo the stored identity
back so the envelope is always complete and the writer is a dumb overwrite —
was rejected: it makes the verifier restate data it is explicitly not allowed
to verify, which invites precisely the bug the scope rule exists to prevent.
Explicit absence encodes the boundary in the data.

### Transport

Envelopes are too large to pass cleanly through a subagent's text report. Each
reader subagent **writes its envelope to a file** and returns only a one-line
status plus the path:

```
.claude/tmp/squad-factory/<runId>/<squadId>.json
```

`.claude/tmp/` is added to `.gitignore`. The orchestrator reads envelopes from
disk and hands paths — not contents — to the writer.

## `squad-fetcher`

Read-only. One team per subagent, model pinned to `sonnet`, dispatched in
parallel. Covers what are today `squad-updater` steps 1-6:

1. Resolve the Wikipedia page title.
2. Find the squad section index via the `action=parse&prop=sections` API.
3. Fetch raw wikitext for that section (`action=raw&section=<N>`).
4. Parse each template line per the shared reference.
5. Determine the squad id — reuse from `data/index.json` if known, otherwise
   mint one following the existing 3-4 letter convention.
6. On intake only: read real identity colours and build the `marker`.

It writes an envelope and nothing else. It never touches `players.json`, never
runs the generator, and never asks the operator a question — an ambiguous team
name returns `NEEDS_DECISION` with the candidates listed (see Failure
handling).

## `squad-writer`

The only component that writes shared state. Runs **one team at a time**,
never in parallel, and accepts a **list** of envelope paths for a batch rather
than being invoked once per team.

Per team, in order:

1. Reconcile each member against `players.json`.
2. Write the squad file at its nested path (`data/squads/nation/<id>.json` or
   `data/squads/club/<league>/<id>.json`).
3. Set `verified: false`, always — including when overwriting a squad that was
   previously `true`. Scraping is not the source check that flag requires.
4. Set `lastUpdated` to today and `source` to the URL actually fetched.

Then, **once for the whole batch** rather than once per team:

5. Run `node scripts/gen-squads.ts`.

Invoking the generator directly rather than via `npm run gen:squads` skips the
npm wrapper layer, which is the dominant cost on Windows. Running it once per
batch instead of once per team matters because the generator rebuilds
`data/index.json` and `lib/squads.generated.ts` from _every_ file under
`data/squads/` on each run — per-team invocation is O(n) redundant work that
grows with the data set.

### Player reconciliation

This is the highest-risk step in the system, because `players.json` is shared
by every squad and football is full of shared names and mononyms.

- **Match key**: normalised name (case-insensitive, diacritics stripped)
  **plus `birth` where available**. National-squad templates carry an exact
  birth date, which resolves most real collisions automatically. Fall back to
  name alone only when no birth date is available on either side.
- **On match**: reuse the `id`, update whichever of `club`, `position`,
  `nationality` changed. Never touch `photo` — it stays `null` in v0.
- **On no match**: create an entry, following the id conventions already in
  the file (kebab-case surname; first name or disambiguated form where the
  existing data already does so).
- **On ambiguity** — multiple candidates, or a name match whose birth date
  conflicts — **do not guess and do not partially write.** The team fails
  atomically with `NEEDS_DECISION` naming the candidates. A half-written squad
  file, or two real people silently merged into one player record, is far
  worse than one team deferred to the operator.

Atomicity is per team: a team either lands completely or not at all.

## `squad-verifier` (changes)

Scope, verdicts, parallel dispatch, and the `verified`-only write rule are all
unchanged and correct. Three modifications:

1. **Also emit a roster envelope**, alongside the existing worksheet, from the
   parse it already performs.
2. **Point at the shared parsing reference** rather than restating the rules.
3. **Correct one now-false statement.** The skill says `verified` is "the only
   thing this skill may write — nothing else, ever," and separately relies on
   someone regenerating `index.json` later. Once the orchestrator regenerates
   after a verify pass, `index.json` changes as a side effect of a verifier
   run. That is fine — derived state is not "data the skill wrote" — but the
   text must say so, or a future agent reads the contradiction and does
   something defensive.

## `squad-factory` (orchestrator)

One skill, two modes, sharing every phase after the first:

- **`intake`** — new teams by name. Phase 1 dispatches `squad-fetcher`.
- **`maintain`** — existing teams by id, or `all`. Phase 1 dispatches
  `squad-verifier`.

Phases:

| #   | Phase      | Concurrency | Detail                                              |
| --- | ---------- | ----------- | --------------------------------------------------- |
| 1   | read       | parallel    | fetcher (intake) or verifier (maintain), 1 per team |
| 2   | partition  | —           | by status; only `OK` proceeds                       |
| 3   | write      | sequential  | `squad-writer`, `OK` teams only                     |
| 4   | regenerate | once        | the writer's own batch-end generator run            |
| 5   | re-verify  | parallel    | `squad-verifier` on the teams just written          |
| 6   | report     | —           | compile                                             |

On `maintain`, phase 2 also drops teams whose verdict was `VALID` — there is
nothing to write. Phase 5 exists because the writer's own parse can be wrong
or incomplete; without it the report says "we ran the fix" rather than "the
fix is correct."

Phase 4 is not a separate actor: it _is_ `squad-writer`'s batch-end generator
run, listed as its own phase because re-verification must read a consistent
tree. Beyond it, the orchestrator's **final action in every pipeline is a
second regenerate**, after phase 5 — phase 5 flips `verified` flags that
`index.json` must pick up. Two generator runs per batch, never 2N.

**Done** means every dispatched team holds a terminal status. A team can
terminate at any phase — failing at phase 1 is terminal and does not block the
batch.

## Failure handling

No subagent ever asks the operator a question. A reader dispatched mid-batch
cannot prompt, so every decision surfaces in the final report instead.

| Status           | Cause                                                        | Effect                         |
| ---------------- | ------------------------------------------------------------ | ------------------------------ |
| `OK`             | clean parse                                                  | proceeds to the writer         |
| `NEEDS_DECISION` | ambiguous team name; ambiguous player match; unknown league  | team deferred, batch continues |
| `SOURCE_BROKEN`  | `source` 404s or moved; no "Current squad"/"Recent call-ups" | team deferred, batch continues |
| `PARSE_FAILED`   | zero members parsed; malformed template block                | team deferred, batch continues |

**Zero parsed members is a failure, never an empty squad.** An empty roster is
never written under any status.

**Blast-radius warning.** When a parsed roster differs from the stored one in
more than 40% of its members, the envelope gains a `warnings` entry — that
scale of change usually means a page restructure or vandalism, not a transfer
window.
On-demand this is advisory — the operator is reading the report. It is the
designated promotion point to a hard block if the factory is ever moved to
cron, where nobody is reading.

## Report format

Preserves `squad-verifier`'s existing philosophy, which is right: a clean team
is one line, and detail appears only where the operator must act.

```
squad-factory maintain — 11 teams, 8 valid, 2 refreshed, 1 needs a decision

NEEDS DECISION
  milan — ambiguous: AC Milan (serie-a) vs Inter Milan (serie-a, already `int`)

Refreshed
  Argentina (arg) — 3 drifted, 1 dropped, 1 added; re-verified VALID
    - martinez "Lautaro Martínez": no 22 → 10
    ...

Valid
  Spain (esp) — 26/26
  Brazil (bra) — 26/26
  ...
```

`NEEDS_DECISION` items sort to the top: they are the only entries asking
anything of the operator.

## Guardrails

A `pre-commit` husky hook, carrying only the cheap data-integrity slice:

```sh
# Gate: a commit can never contain squad data out of sync with its generated index.
node scripts/gen-squads.ts
git diff --exit-code -- lib/squads.generated.ts data/index.json
```

`.husky/pre-push` keeps the full `npm run check` unchanged. Pre-commit is a
strict, cheap subset — one node startup — so the two do not meaningfully
overlap: one stops stale derived data from becoming a commit, the other stops
broken types, lint, or tests from leaving the machine.

The hook **fails rather than auto-stages**. The tempting version
(`gen-squads && git add …`) reads the _working tree_, not the index, so
staging three of six updated squads would generate an index reflecting all six
and quietly stage it — leaking unstaged work into the commit. Failing keeps
the operator in control, and in practice it should rarely fire, since the
writer regenerates at batch end anyway. It is a net, not the primary path.

This guardrail is independently useful: it also catches a hand-edited squad
file, which no amount of skill discipline would.

## Repo changes

**Added**

- `.claude/skills/squad-fetcher/SKILL.md`
- `.claude/skills/squad-writer/SKILL.md`
- `.claude/skills/squad-factory/SKILL.md`
- `.claude/skills/squad-factory/references/wikitext-roster-parsing.md` — the
  single home for template families, field meanings, the drop-rows-without-`no`
  rule, and the never-trust-a-prose-summary rule. `squad-fetcher` and
  `squad-verifier` both read it; neither restates it.
- `.husky/pre-commit`

**Modified**

- `.claude/skills/squad-verifier/SKILL.md` — the three changes above.
- `.gitignore` — add `.claude/tmp/`.
- `CLAUDE.md` — correct the `players.json` shape (add `fullName`, `club`);
  replace references to `squad-updater` with the new skill set.

**Retired**

- `.claude/skills/squad-updater/SKILL.md` — its steps 1-6 become
  `squad-fetcher`, its steps 7-11 become `squad-writer`, and its step 12
  (per-team report) becomes the orchestrator's phase 6. Nothing is lost; every
  rule in it lands in exactly one of the three.

## Designed-for extensions

Recorded so the next change is an extension rather than a rewrite.

**Photos (v1).** `photo: string | null` already exists on the player record,
and `players.json` is already the writer's exclusive property, so the _field_
is trivial. What is new is a third work category the current split has no slot
for: **parallel-safe writes to unshared paths** (`assets/players/<id>.jpg` —
one file per player, no contention). That becomes a fourth worker between
fetch and write, not a restructuring. Verification splits too: a JPEG cannot
be diffed against wikitext, so photo checking is "file exists / licence still
permits / right player" — which is why verdicts are keyed by scope rather than
one enum per squad. Storage (in-repo vs CDN), licence metadata, and the first
credential this project would ever need are a separate spec that hangs off the
side of this pipeline without reshaping it.

**Cron.** The `maintain` pipeline _is_ the cron payload; it needs no
structural change. What cron adds is policy, all at the orchestrator: an
output mode (branch or PR instead of a chat report), promotion of the
blast-radius warning to a hard block, and cross-run concurrency — the writer is
sequential within a run but not across runs, so a scheduled run and a manual
one could both touch `players.json`. Running cron on its own branch is
sufficient.
