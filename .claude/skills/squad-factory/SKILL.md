---
name: squad-factory
description: Use when adding or maintaining Escuadra squad data at batch scale — auditing and repairing existing teams, or taking on new clubs and nations. Orchestrates squad-verifier, squad-fetcher and squad-writer across many teams, running reads in parallel and writes sequentially, and reports what changed.
---

# Squad Factory

## The prime rule

**This skill orchestrates and never performs data work.** It does not fetch a
Wikipedia page, parse wikitext, reconcile a player against `players.json`, or
edit a squad file. If carrying out a batch would require any of those, the
boundary has been drawn wrong — dispatch a subagent to do it instead. Every
fact this skill reports comes from a worker's return line or report text, never
from this skill re-deriving or double-checking the fact itself. There is no
`context: fork` on this skill's own frontmatter, unlike the three it
coordinates — it stays in the session because dispatching and compiling is all
it ever does here.

The three workers, each doing exactly the slice their own name says:

- **`squad-fetcher`** — parallel-safe reader for new-team intake. Given one
  team name, writes one roster envelope on a clean parse; every other status
  is reported through its return line with no file written at all.
- **`squad-verifier`** — parallel-safe reader for maintenance. Given one
  existing squad id, diffs the stored roster against a fresh Wikipedia read
  and reports a verdict (`VALID`/`STALE`/`INVALID`); on a clean fetch it also
  writes a roster envelope — `status` describes whether the fetch itself
  succeeded, `verdict` describes the comparison, so a `STALE` team still
  produces an `OK` envelope. Its only write to committed data is that squad's
  own `verified` flag.
- **`squad-writer`** — the sequential writer. Given a **list** of envelope
  paths for one batch, it is the only skill permitted to touch
  `data/players.json`, any file under `data/squads/`, `data/index.json`, or
  `lib/squads.generated.ts`. It processes teams one at a time and regenerates
  the generated outputs exactly once, at the end of its own run.

## Two modes

- **`intake`** — one or more new team names. Phase 1 dispatches
  `squad-fetcher` per team.
- **`maintain`** — one or more existing squad ids, or the literal `all`.
  Phase 1 dispatches `squad-verifier` per team.

Every phase after phase 1 is shared between the two modes — the only
difference is which worker phase 1 calls and the extra `VALID` drop that
phase 2 applies in `maintain` mode (see below).

## Run id and envelope directory

Mint one run id at the start of a run — an ISO timestamp is fine (the
worked examples in `squad-fetcher`'s own SKILL.md use `2026-09-01T0417`, for
instance). That run id fixes the batch's envelope directory,
`.claude/tmp/squad-factory/<runId>/`, which is what every phase-1 dispatch is
told to write its envelope into and what phase 3 later reads from. Every team
in the same batch shares the same run id and directory; a re-run (retrying a
`NEEDS_DECISION` team after the operator resolves it, say) mints a new one.

## The six phases

### Phase 1 — read (parallel)

One `Agent` call per team, dispatched concurrently:

- `subagent_type: general-purpose`
- `model: "sonnet"` — pin this explicitly on every dispatch this skill makes.
  An omitted `model` silently inherits the orchestrator's own, which defeats
  the point of pinning it.
- no `isolation` — every dispatch in this skill stays local; none is a
  cloud or worktree run.
- prompt: instruct the subagent to invoke `squad-fetcher` (`intake`) or
  `squad-verifier` (`maintain`) **via the Skill tool, for this one team
  only**, passing the run's envelope directory. Hand the subagent exactly one
  team, never a list. This matters most for `squad-verifier`: its own
  SKILL.md is written for "one or more existing squad ids (or 'all')" and
  describes fanning out to one sub-subagent per team when it is handed
  several at once — that fan-out belongs to a human invoking it directly
  across a whole audit, not to a per-team dispatch this skill has already
  sliced down to one team. Handing it a multi-team list here would trigger
  that internal fan-out on top of this skill's own per-team dispatch —
  redundant nesting, not real parallelism gained. `squad-fetcher`'s own
  SKILL.md, by contrast, is written for exactly one team throughout and has
  no documented multi-team mode at all — handing it a list isn't "extra
  fan-out," it's input the skill was never built to accept.
- ask the subagent to return two things: the worker's own one-line or
  worksheet report (verbatim — this skill does not rewrite it), and, for
  routing, the worker's status/path outcome (`squad-fetcher`'s
  `<status> <squadId> <path>` form, or `squad-verifier`'s written envelope
  path plus verdict).

Run all of a batch's phase-1 dispatches in the background and collect every
result before moving to phase 2 — a batch of 12 teams is 12 concurrent calls,
not 12 sequential ones.

### Phase 2 — partition

Sort phase 1's results by what they allow to happen next:

- **Proceeds to phase 3** — `status: OK` in both modes, **and**, in
  `maintain` mode only, a verdict of `STALE` or `INVALID`. A `maintain` team
  whose verdict is `VALID` also has `status: OK` and a written envelope, but
  there is nothing to write, so it is dropped here rather than handed to
  `squad-writer` — it goes straight to the report's `Valid` list instead.
- **Terminal, does not proceed** — any non-`OK` status
  (`NEEDS_DECISION`/`SOURCE_BROKEN`/`PARSE_FAILED`). Per `squad-fetcher`'s and
  `squad-verifier`'s own contracts, no envelope file exists for these; the
  worker's one-line or worksheet return is the entire record of what
  happened, and it goes straight to the report's `NEEDS DECISION` section
  (or the equivalent broken-source/parse-failed note).

A team failing or being dropped here is terminal for that team. It does not
block, delay, or reduce the batch of envelope paths phase 3 receives for
every other team.

### Phase 3 — write (sequential, one call)

A **single** dispatch — one `Agent` call, same pinned parameters as phase 1
(`subagent_type: general-purpose`, `model: "sonnet"`, no `isolation`) — whose
prompt hands `squad-writer` the **entire list** of envelope paths that
survived phase 2's partition, invoked once via the Skill tool. Never one call
per team, and never run alongside phase 1 or phase 5 — `squad-writer`'s own
SKILL.md explains why: every team in a batch writes to the same
`players.json` and the same generated outputs, so two writers running at once
can each read before the other's write lands and silently clobber it. This
skill's job here is only to hand over the list and wait; the sequencing
itself is `squad-writer`'s own discipline to enforce, not something this
skill re-implements.

`squad-writer` may defer an individual team with its own `NEEDS_DECISION`
(a reconciliation ambiguity) without that affecting any other team in the
list — that, too, is `squad-writer`'s own atomicity guarantee, not a
partition this skill performs itself. Whatever team list `squad-writer`'s
report says it actually wrote is the list phase 5 re-verifies — not the
list phase 3 was handed, if the two differ.

### Phase 4 — regenerate

**This is not a phase this skill performs.** It is `squad-writer`'s own
batch-end generator run (`node scripts/gen-squads.ts`, called once after
every team in the batch has reached its own write step or been deferred) —
already complete by the time phase 3's single dispatch returns. It is listed
here as a phase only because phase 5 depends on it: phase 5 needs a tree
where the just-written squad files and the regenerated `data/index.json` /
`lib/squads.generated.ts` agree, and phase 3 returning is what guarantees
that. This skill does not invoke the generator here, and must not — doing so
would be a second, redundant regenerate for the same batch (see The two
generator runs below).

If `squad-writer`'s report says the batch-end regenerate itself failed
(`gen-squads.ts` throwing on a bad league folder, an id/filename mismatch, or
a duplicate id — see its own SKILL.md), report that failure plainly in this
skill's own report rather than folding it into a normal completion line, and
do not attempt to fix the named file — that is a squad file edit, which is
data work this skill does not perform. State that the team-level writes are
already safely on disk, and that `data/index.json` /
`lib/squads.generated.ts` are stale — and `npm run check` will fail — until
someone fixes the offending file and the generator is re-run.

### Phase 5 — re-verify (parallel)

One `Agent` call per team **`squad-writer` actually wrote** in phase 3 (not
merely the list it was handed — a team `squad-writer` deferred was never
written and has nothing to re-verify), dispatched concurrently with the same
pinned parameters as phase 1. Each subagent invokes `squad-verifier`, again
for exactly one team, via the Skill tool.

This phase exists because `squad-writer` never re-checks its own
reconciliation against the source — its parse of the envelope could itself be
wrong or incomplete, and skipping this step would let the final report claim
"we ran the fix" when the honest claim is only "the fix is correct" once
phase 5 confirms it. Run phase 5 regardless of mode: a freshly-intaken team
gets the same re-verify pass as a freshly-refreshed one.

### Phase 6 — report

Compile every phase's results into the operator-facing report (see Report
format below). No new fact-finding happens in this phase — everything in it
was already produced by a worker in an earlier phase.

## The two generator runs

**Exactly two runs of `node scripts/gen-squads.ts` happen in a batch, never
more, never `2N` for `N` teams:**

1. Once, inside phase 3/4, as `squad-writer`'s own batch-end regenerate —
   this skill does not call it; `squad-writer` does, after every team in its
   list has reached its write step or been deferred.
2. Once more, as this skill's own final action, **after phase 5** — because
   phase 5 flips `verified` flags (`squad-verifier`'s one permitted write to
   committed data) on the squad files phase 3 just wrote, and
   `data/index.json` must pick up that flip. Run this second regenerate
   directly (`node scripts/gen-squads.ts`, not `npm run gen:squads`, matching
   the convention `squad-writer` itself follows) as this skill's last step
   before compiling the report, whenever phase 3 wrote at least one team.

If phase 3 wrote nothing (every team in the batch was terminal at phase 1 or
2, or `squad-writer` deferred every team it was handed), skip the final
regenerate — there is nothing new for `data/index.json` to pick up, and
running the generator on an unchanged tree is a needless second invocation
for zero benefit, not "the safe default."

## Completion

A run is **done** once every dispatched team holds a terminal status:
written-and-confirmed, written-and-re-verify-flagged, valid (nothing to do),
or `NEEDS_DECISION`/`SOURCE_BROKEN`/`PARSE_FAILED` at whichever phase it
failed. A team can terminate at any phase — phase 1, phase 2's partition, or
`squad-writer`'s own ambiguity rule inside phase 3 — and **failing at any
phase is terminal for that team only**. It must never block or delay any
other team already in flight or still to come in the same batch. This is the
same atomicity discipline `squad-writer` already applies per team inside its
own list; this skill applies the equivalent discipline across the whole
batch, at every phase.

## No mid-run questions

None of the three workers can prompt an operator mid-batch — `squad-fetcher`
and `squad-verifier` say so explicitly in their own no-questions rules, and
`squad-writer`'s ambiguity rule exists for the same reason. This skill
inherits that constraint rather than working around it: every ambiguity,
broken source, or parse failure surfaces as a line in the final report, never
as a stop-and-ask partway through a batch. A twelve-team batch with one
`NEEDS_DECISION` still produces eleven finished teams and one clearly flagged
line, not a stalled run waiting on an answer nobody can give it mid-flight.

## No auto-commit

This skill never runs `git add` or `git commit`. A completed run leaves the
working tree dirty — new or changed squad files, `players.json`,
`data/index.json`, `lib/squads.generated.ts` — and reports what changed.
Reviewing that diff and deciding whether to commit it stays with the
operator, every time, including a run with zero `NEEDS_DECISION` teams and a
clean `npm run check`. Squad data is LLM-generated and unverified by
contract; an uninspected commit is exactly the failure mode that leaves in
place.

## Report format

```
squad-factory <mode> — N teams, N valid, N refreshed, N need a decision

NEEDS DECISION
  <team name> (<id if known>) — <status/verdict> — <reason, verbatim from
  the worker's return line or report>

Refreshed
  <team name> (<id>) — written; re-verified <VALID | still STALE/INVALID>
  <squad-writer's own per-team change summary — added/removed/moved
  club/number changes, verified: false[, downgraded from true]>

Valid
  <team name> (<id>) — VALID
```

Order the sections `NEEDS DECISION` first, then `Refreshed`, then `Valid` —
`NEEDS DECISION` leads because it is the only section asking the operator to
do anything. Omit any section with nothing in it. Follow `squad-verifier`'s
own reporting philosophy throughout: a clean team is one line, and expanded
detail (a worksheet, a candidate list, a diff) appears only for a team the
operator must actually act on. A `Refreshed` team whose phase-5 re-verify
still came back `STALE`/`INVALID` is not a clean line — surface its
worksheet detail the same as a `NEEDS DECISION` team, since that, too, is
something only the operator can resolve; do not let it read as an
unremarkable success.

Close with confirmation that the final regenerate ran (or, if phase 3 wrote
nothing, that it was correctly skipped) and a reminder that the tree is
unstaged and uncommitted.

## Common mistakes

- **Doing the data work itself** — fetching a page, parsing a template line,
  reconciling a player, or hand-editing a squad file, `players.json`,
  `data/index.json`, or `lib/squads.generated.ts` instead of dispatching to
  the worker that owns that job. This is the single most important rule this
  skill has; see The prime rule.
- Omitting `model: "sonnet"` on a dispatch, or passing an `isolation` value —
  every dispatch here is local and explicitly pinned; an inherited model
  defeats the pin, and an `isolation` value turns a local dispatch into a
  cloud or worktree run this batch was never meant to be.
- Running `squad-writer` more than once per batch, or once per team, or
  concurrently with anything else — phase 3 is exactly one call, taking the
  whole surviving list, and it must not overlap phase 1 or phase 5.
- **Running the generator twice in the same place**, or skipping the second
  run entirely — the batch needs exactly two `gen-squads.ts` runs total (one
  inside `squad-writer`'s own phase 3/4, one as this skill's own final step
  after phase 5), never `2N`, and never zero when phase 3 actually wrote a
  team.
- **Skipping phase 5** and reporting a written team as fixed without
  re-verifying it — the report must say the fix is confirmed correct, not
  merely that it was attempted.
- Handing a phase-1 or phase-5 dispatch more than one team at a time — that
  triggers `squad-verifier`'s own internal per-team fan-out on top of this
  skill's, which is redundant nesting, not extra parallelism.
- Letting one team's failure at any phase stall, delay, or drop other teams
  in the same batch — a `NEEDS_DECISION`, `SOURCE_BROKEN`, or `PARSE_FAILED`
  team is terminal for itself only.
- Stopping a batch mid-run to ask the operator anything — no worker here can
  prompt, and neither can this skill; every open question is a line in the
  final report.
- Committing the run's changes, or otherwise touching git, on the operator's
  behalf — this skill's output is a dirty working tree and a report, never a
  commit.
- Padding a `Valid` team's report line with per-player detail it doesn't
  need, or, conversely, compressing a `NEEDS DECISION` or still-invalid
  `Refreshed` team down to a headline with no worksheet — match
  `squad-verifier`'s own rule that report detail belongs exactly where the
  operator must act, and nowhere else.
