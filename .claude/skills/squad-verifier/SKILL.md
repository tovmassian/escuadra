---
name: squad-verifier
context: fork
description: Use when checking whether an existing Escuadra squad file (data/squads/nation/<id>.json or data/squads/club/<league>/<id>.json for a club) still matches its Wikipedia source — spot-checking one team or auditing several after a while, before trusting or re-verifying `verified` data. Produces a validity verdict per team; the only write it ever makes is setting that squad's own `verified` flag to match the verdict (`true` on VALID, `false` otherwise).
---

# Squad Verifier

## Overview

Given one or more existing squad ids (or "all"), re-fetch each squad's
current roster from the Wikipedia page recorded in its own `source` field
and diff it against what's stored in `data/squads/nation/<id>.json` (or
`data/squads/club/<league>/<id>.json` for a club) and `data/players.json`.
Report a validity verdict per team.

**Scope: players and membership only, never squad-level identity fields
(`primaryColor`, `secondaryColor`, `marker`, `season`).** Wikipedia's
infobox gives kit colours, but `primaryColor`/`secondaryColor` on a nation
squad are the flag's colours — an entirely different real-world fact per
the data model (a marker _is_ the flag for a nation, never the kit).
Diffing kit colours against flag colours produces confident-looking false
positives (Japan's away-kit navy read as contradicting its flag's red,
when the two were never the same thing). Club colours are closer to kit
colours but still brand identity, not membership — out of scope for the
same reason. Verify the roster; leave identity fields alone entirely.

**`verified` is the only field of committed squad data this skill may
write.** It has no authority to fix rosters, touch `players.json`, or edit
any other field of the squad file. Set `verified` to match the verdict:
`true` on a clean `VALID` result, `false` on anything else — including
flipping a stale `true` back to `false` when a previously-verified squad
has drifted out of date since its last check. That flag-flip is the full
extent of this skill's write to committed data; fixing the actual roster
after a bad verdict is [[squad-writer]]'s job (usually reached through
`squad-factory`), run separately by the user's choice. This skill also
writes a roster envelope (see the procedure below) — but that file lives
under `.claude/tmp/`, which is run scratch, not committed data, and
`data/index.json` changing afterward is a downstream consequence of
someone else regenerating it, not a write this skill performs.

## Parsing rules live elsewhere — follow them, don't reinvent them

**Read `.claude/skills/squad-factory/references/wikitext-roster-parsing.md`
before parsing anything, and follow it exactly.** It is the single source
for page title resolution, the two-step fetch, section selection, the two
club/nation template families and how to read them, field extraction, the
drop-rows rule, and the field-population rules (nationality, club, birth)
that decide what goes on the envelope this skill hands to `squad-writer`.
None of that is repeated here — restating it is exactly how this skill's
own copy and the retired `squad-updater`'s used to drift apart in the first
place.

One line worth keeping here so the warning isn't lost at a glance: **never
key a verdict off a prose summary of the roster table.** A fetch tool that
"lists the players" runs the page through a model that paraphrases or
drops tabular detail with no signal that it did — always pull the raw
wikitext and parse the template lines yourself. See the reference for the
exact URLs and template shapes.

## Delegate the check to a sonnet subagent, one per team

Verification is mechanical and its one permitted write (`verified`) lands
in a squad's own file, never a file shared across teams — so unlike
`squad-writer` (which must run its teams sequentially to avoid racing on
shared writes to `players.json`/`index.json`), multiple teams here have no
shared state and can be dispatched **in parallel**. For each team, launch
an `Agent` call:

- `subagent_type`: `general-purpose`
- `model`: `"sonnet"` — pin this explicitly; don't inherit the orchestrator's model
- no `isolation` — this stays local, not a cloud/worktree run
- prompt: the per-team procedure below, with the squad id and its `source`
  URL filled in, plus an instruction to return a structured verdict (see
  Report format), and an explicit reminder that `verified` in that squad's
  own file is the only field it may ever write — never `players.json`,
  `index.json`, or any other field of the squad file

Run in the background and collect each subagent's verdict before compiling
the final report if checking multiple teams; for a single team, foreground
is fine.

## Procedure (per team)

1. **Locate and read the stored squad file.** The path depends on `kind`
   and, for a club, `league` — check `data/index.json` for this squad's
   `kind`/`league`, or search under `data/squads/` for the file whose `id`
   matches if you're unsure. Nation squads live at
   `data/squads/nation/<id>.json`; club squads live at
   `data/squads/club/<league>/<id>.json`. Note `kind`, `source`, and every
   `members` entry (`playerId`, `no`, `captain?`). `name`, `season`,
   `primaryColor`, `secondaryColor`, and `marker` are out of scope (see
   Scope above) — read past them, don't verify them.

2. **Resolve each `playerId`** against `data/players.json` to get `name`,
   `position`, `nationality`, `club`, `birth`.

3. **Fetch the squad section from the stored `source` URL**, following the
   parsing reference's two-step fetch, section-selection, and template
   rules exactly — don't re-derive them here. Section selection is a
   priority-ordered list of titles, not a single one: work down it and
   record the title that actually matched. If `source` 404s, has moved, or
   the page has **no** section matching any title on that list, that itself
   is a finding — report it (and, for the envelope in step 5, that's
   `SOURCE_BROKEN`) — don't guess a replacement URL. A page that matches
   further down the list is not a broken source.

4. **Diff the live roster against the stored one.** Check, per player:
   - Present in one list but not the other (dropped or added since the
     squad file was written).
   - Shirt number (`no` vs `no=`).
   - Position (`position` vs `pos=`).
   - Captain flag (`captain` vs `other=captain`).
   - Club squads: player's `nationality` vs the wikitext's `nat=` code.
   - National squads: player's `club` vs the wikitext's `club=`.
   - Name spelling/diacritics — flag a mismatch, but don't treat a pure
     transliteration difference the same severity as a wrong number or
     wrong position.

5. **Write a roster envelope for `squad-writer`, from the live roster you
   just parsed for steps 3-4.** That parse already happened for the diff —
   emitting it costs nothing, and it's the same artifact `squad-fetcher`
   produces, so `squad-writer` can consume a verifier result directly
   instead of a human relaying this worksheet by hand. Build a
   `RosterEnvelope` (`scripts/roster-envelope.ts` — read it for the exact
   field names and optionality; don't work from a paraphrase of it):
   - `team.id`/`kind`/`league` from the stored file (step 1); `team.name`
     and `team.season` copied through from the stored file too, exactly as
     stored — carried along unverified, never diffed against Wikipedia,
     per the Scope rule.
   - `team.source`/`sectionTitle`/`asOf` from the fetch in step 3.
   - `members` is the **live Wikipedia roster** parsed in steps 3-4, not
     the stored one — the same shape `squad-fetcher` would produce fetching
     this team today.
   - **Apply the reference's Field population rules to every member** —
     the nationality rule, the club rule and the birth rule, in
     `wikitext-roster-parsing.md`. `nationality`, `club` and `birth` are
     not read straight off a template line; each has to be derived, and
     which one has to be derived flips with the squad's kind. A club
     squad's wikitext has no `club=`, so `club` comes from `team.name`; a
     nation squad's has no `nat=`, so `nationality` is the squad's own
     country; and `{{Fs player}}` carries no birth date at all, so a club
     squad's members new to `data/players.json` need theirs looked up.
     `squad-writer` copies these fields verbatim and derives nothing —
     omit one here and the field it needed simply never gets set.
   - **Omit the `identity` key entirely.** This skill is forbidden from
     checking `primaryColor`, `secondaryColor`, and `marker` (Scope,
     above), so it must never emit them — an absent key is what tells
     `squad-writer` to preserve the stored values; emitting it, even with
     values read straight off the page, would let unverified data
     overwrite a good marker.
   - `warnings: []`, unless step 6 below adds an entry.
   - Set `status: OK` when the page parsed cleanly, **regardless of the
     verdict** — `status` describes the fetch, `verdict` describes the
     comparison (step 9). A `STALE` or `INVALID` team still produces an
     `OK` envelope. Reserve `SOURCE_BROKEN`/`PARSE_FAILED` for when the
     fetch or parse itself failed (step 3's finding). On either of those
     statuses, **write no envelope file at all** and report the failure in
     the verdict instead — the same rule `squad-fetcher` follows, because
     `validateEnvelope` requires `team.id`/`name`/`season`/`source`/
     `sectionTitle` to be non-empty, which a broken source or a failed
     parse can't supply.

   On `status: OK`, write the file to `<envelope dir>/<squadId>.json`
   (create the directory if it doesn't exist), then validate it:
   `node scripts/envelope-check.ts <path>`. Fix any reported problem before
   moving on — a validation failure means the envelope is malformed, not
   that the tool is wrong.

   `<envelope dir>` is whichever directory the dispatch named. Invoked
   directly it is the run's own `.claude/tmp/squad-factory/<runId>/`;
   invoked by `squad-factory`'s phase-5 re-verify it is
   `.claude/tmp/squad-factory/<runId>/reverify/`, so a second read of the
   same team in the same run cannot overwrite the envelope phase 3 already
   consumed. Write where you were told; never rewrite an envelope that a
   `squad-writer` run may still be reading.

   The envelope is the machine handoff to `squad-writer`; the worksheet
   (step 9) remains the human-readable report. Neither replaces the
   other — produce both whenever an envelope is written.

6. **Check the blast radius — through the CLI, never by eye.** Only when
   step 5 wrote a file: run
   `node scripts/envelope-check.ts --against <stored squad path> <envelope path>`
   and record what it prints. Past `BLAST_RADIUS_THRESHOLD` (40% — see
   `scripts/roster-envelope.ts`) it prints a `BLAST RADIUS` line naming the
   percentage of the stored roster that changed; when it does, add a
   `warnings[]` entry to the envelope quoting that percentage and re-save
   the file. This warning is advisory on an on-demand run — the operator
   is reading the report — and is the designated promotion point to a hard
   block if the factory is ever moved to a schedule.

7. **Do not check `season`, `primaryColor`, `secondaryColor`, or
   `marker`.** These are identity fields, not roster data, and Wikipedia's
   infobox doesn't reliably speak to the same fact this skill would be
   diffing against (kit colours vs. a nation's flag colours, in
   particular — see Scope above). Verification here means the `members`
   list and each member's player record; nothing on the squad file outside
   of `members` and `verified` is this skill's concern.

8. **`verified` is the one field this skill may write — set it to match
   the verdict (step 9), in either direction.** `VALID` → `verified: true`.
   `STALE`/`INVALID` → `verified: false`, even if it was `true` going in —
   that's exactly the "verified once, now drifted" case this flag exists
   to catch, so leaving a stale `true` in place defeats the point of
   running verification. Write only that one field, in the squad file at its nested path
   (`data/squads/nation/<id>.json` or `data/squads/club/<league>/<id>.json`);
   never touch `players.json` or `index.json` — `index.json` is generated
   from the squad files by `npm run gen:squads` and will pick up the flip
   next time someone regenerates it (`npm run check`'s diff guard catches
   the interim staleness rather than this skill needing to run the
   generator itself).

9. **Return a verdict.** `VALID` means the stored roster agrees with the
   current Wikipedia page in every checked respect — for a `VALID` team,
   the verdict line is the entire report; don't pad it
   with a list of everything that matched. Anything else is `STALE`/
   `INVALID`, and the report is judged by whether **squad-writer could
   apply the fix from your text alone, without re-fetching or re-parsing
   Wikipedia itself.** That means every discrepancy carries the raw
   wikitext values, not just "doesn't match" — write the report as if
   handing off a worksheet, not a headline.

## Report format (per team)

For a `VALID` team, one line is the whole report:

```
<team name> (<id>) — VALID (26/26 players match)
```

For `STALE`/`INVALID`, give squad-writer a worksheet it can act on
directly, grouped by discrepancy type — omit any group that's empty:

```
<team name> (<id>) — STALE | INVALID
source checked: <URL>, section "<section title>" (as of <date Wikipedia lists, if any>)

Dropped (in stored file, not in current Wikipedia squad):
  - <playerId> "<stored name>" — was no=<N>, <pos>. Not found in current squad; not marked as loaned/left in the article — confirm before removing.

Missing (in current Wikipedia squad, not in stored file):
  - "<name as printed in wikitext>" — no=<N>, pos=<POS>, nat=<code> | club=<club>/<clubnat>, captain=<yes/no>
    raw: {{Fs player|no=<N>|nat=<code>|pos=<POS>|name=[[<link>]]}}   (or the nat-fs-g-player line for nations)

Drifted (present in both, fields differ):
  - <playerId> "<name>": no <stored> → <wikipedia>
  - <playerId> "<name>": pos <stored> → <wikipedia>
  - <playerId> "<name>": club/nationality <stored> → <wikipedia>
  - <playerId> "<name>": captain <stored> → <wikipedia>
```

Carry the exact raw template line for every **missing** player (step 4) —
that's the one case squad-writer cannot reconstruct from a short summary,
since it needs the literal `no=`/`pos=`/`nat=`/`club=` fields to write a
correct `members` entry and, if the player is new to `players.json`, a
correct player record. For **dropped** and **drifted** players, the stored
`playerId` plus the two values either side of the arrow is enough — no need
to restate the whole player record when only one field moved.

For multiple teams, compile one such block per team plus a one-line
overall summary (e.g. "2/6 valid, 4 need a squad-writer refresh:
argentina, brazil, france, japan").

## Common mistakes

- Treating a WebFetch prose summary of the roster as ground truth instead
  of parsing raw wikitext — this hides real discrepancies behind a verdict
  that looks clean.
- Hand-editing the roster, colours, `players.json`, or `data/index.json`
  under any verdict — the only committed data this skill ever writes is
  the one `verified` flip; `index.json` only changes later, as someone
  else's regeneration, never as this skill's own edit. Point the user at
  `squad-writer` (usually via `squad-factory`) for actual repairs.
- Leaving a stale `verified: true` in place on a non-VALID verdict —
  the flag must move to `false` the moment drift is confirmed, not stay
  frozen at whatever `squad-writer` last set it to. A verified squad going
  stale over time without the flag catching up is exactly the scenario
  this skill exists to close.
- Emitting an envelope whose members carry only what the template line
  literally printed — `nationality`, `club` and `birth` have to be derived
  per the reference's Field population rules, and which of them needs
  deriving flips with the squad's kind. The two failure shapes to watch for
  are a club squad's envelope with `club` set on nobody, and a nation
  squad's with `nationality` set on nobody; both look complete and are not.
- Leaving `birth` unset on a club-squad member who isn't in
  `data/players.json` yet — `Player.birth` is required, `{{Fs player}}`
  never carries it, and `squad-writer` won't fetch it. See the reference's
  birth rule.
- Reporting `SOURCE_BROKEN` because the stored page has no "Current squad"
  section, without working down the rest of the reference's section
  priority list first — most English club articles never use that title.
- Fabricating or guessing a replacement Wikipedia URL when the stored
  `source` is broken — report the broken link as a finding.
- Running one subagent per team sequentially "to be safe" — there's no
  shared-write hazard here (unlike `squad-writer`), so parallel dispatch is
  correct and faster.
- Flagging a transliteration/diacritic-only name difference at the same
  severity as a wrong shirt number or missing player — note it, but don't
  let it inflate a VALID roster to INVALID.
- Checking `season`, `primaryColor`, `secondaryColor`, or `marker` against
  Wikipedia at all — these are out of scope (see Scope above), and diffing
  kit colours against what's actually a nation's flag colour produces a
  false positive that reads as a real defect but isn't one.
- Reporting a non-VALID verdict as a headline count ("9 missing, several
  drifts") without the worksheet detail — squad-writer then has to
  re-fetch and re-parse Wikipedia itself, which defeats the point of
  running verification first. Always include the raw template line for
  every missing player, and old→new values for every drift.
- Padding a VALID verdict with per-player detail — nothing to hand off, so
  the one-line form is the whole report.
