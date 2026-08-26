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

**The `verified` flag on the squad's own file is the only thing this skill
may write — nothing else, ever.** It has no authority to fix rosters, touch
`players.json`/`index.json`, or edit any other field of the squad file. Set
`verified` to match the verdict: `true` on a clean `VALID` result, `false`
on anything else — including flipping a stale `true` back to `false` when
a previously-verified squad has drifted out of date since its last check.
That flag-flip is the full extent of the write; fixing the actual roster
after a bad verdict is [[squad-updater]]'s job, run separately by the
user's choice.

## Critical rule: never trust prose extraction of the roster table

Same failure mode as squad-updater: asking a fetch tool to "list the
players" runs the page through a summarizing model that paraphrases or
drops tabular detail with no signal that it did. **Always pull the raw
wikitext of the squad section and parse the template lines yourself** —
fetch the sections/raw-wikitext URLs directly rather than through a
tool that summarizes through a model. Never key a mismatch verdict off a
prose summary of a roster.

## Delegate the check to a sonnet subagent, one per team

Verification is mechanical and its one permitted write (`verified`) lands
in a squad's own file, never a file shared across teams — so unlike
squad-updater (which must run its teams sequentially to avoid racing on
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

3. **Fetch the squad section from the stored `source` URL** — the same
   two-step Wikipedia fetch as squad-updater:
   - `https://en.wikipedia.org/w/api.php?action=parse&page=<Title>&prop=sections&format=json`
     to find the "Current squad" (or "Recent call-ups") section index.
   - `https://en.wikipedia.org/w/index.php?title=<Title>&action=raw&section=<N>`
     for the raw wikitext, parsed the same way squad-updater does:
     `{{Fs player|...}}` for clubs, `{{nat fs g player|...}}` for nations.
     If `source` 404s, has moved, or the "Current squad" section is gone,
     that itself is a finding — report it, don't guess a replacement URL.

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

5. **Do not check `season`, `primaryColor`, `secondaryColor`, or
   `marker`.** These are identity fields, not roster data, and Wikipedia's
   infobox doesn't reliably speak to the same fact this skill would be
   diffing against (kit colours vs. a nation's flag colours, in
   particular — see Scope above). Verification here means the `members`
   list and each member's player record; nothing on the squad file outside
   of `members` and `verified` is this skill's concern.

6. **`verified` is the one field this skill may write — set it to match
   the verdict (step 7), in either direction.** `VALID` → `verified: true`.
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

7. **Return a verdict.** `VALID` means the stored roster agrees with the
   current Wikipedia page in every checked respect — for a `VALID` team,
   the verdict line is the entire report; don't pad it
   with a list of everything that matched. Anything else is `STALE`/
   `INVALID`, and the report is judged by whether **squad-updater could
   apply the fix from your text alone, without re-fetching or re-parsing
   Wikipedia itself.** That means every discrepancy carries the raw
   wikitext values, not just "doesn't match" — write the report as if
   handing off a worksheet, not a headline.

## Report format (per team)

For a `VALID` team, one line is the whole report:

```
<team name> (<id>) — VALID (26/26 players match)
```

For `STALE`/`INVALID`, give squad-updater a worksheet it can act on
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
that's the one case squad-updater cannot reconstruct from a short summary,
since it needs the literal `no=`/`pos=`/`nat=`/`club=` fields to write a
correct `members` entry and, if the player is new to `players.json`, a
correct player record. For **dropped** and **drifted** players, the stored
`playerId` plus the two values either side of the arrow is enough — no need
to restate the whole player record when only one field moved.

For multiple teams, compile one such block per team plus a one-line
overall summary (e.g. "2/6 valid, 4 need a squad-updater refresh:
argentina, brazil, france, japan").

## Common mistakes

- Treating a WebFetch prose summary of the roster as ground truth instead
  of parsing raw wikitext — this hides real discrepancies behind a verdict
  that looks clean.
- Editing the roster, colours, `players.json`, or `index.json` under any
  verdict — this skill reports and, at most, flips one flag. Point the
  user at squad-updater for actual repairs.
- Leaving a stale `verified: true` in place on a non-VALID verdict —
  the flag must move to `false` the moment drift is confirmed, not stay
  frozen at whatever squad-updater last set it to. A verified squad going
  stale over time without the flag catching up is exactly the scenario
  this skill exists to close.
- Fabricating or guessing a replacement Wikipedia URL when the stored
  `source` is broken — report the broken link as a finding.
- Running one subagent per team sequentially "to be safe" — there's no
  shared-write hazard here (unlike squad-updater), so parallel dispatch is
  correct and faster.
- Flagging a transliteration/diacritic-only name difference at the same
  severity as a wrong shirt number or missing player — note it, but don't
  let it inflate a VALID roster to INVALID.
- Checking `season`, `primaryColor`, `secondaryColor`, or `marker` against
  Wikipedia at all — these are out of scope (see Scope above), and diffing
  kit colours against what's actually a nation's flag colour produces a
  false positive that reads as a real defect but isn't one.
- Reporting a non-VALID verdict as a headline count ("9 missing, several
  drifts") without the worksheet detail — squad-updater then has to
  re-fetch and re-parse Wikipedia itself, which defeats the point of
  running verification first. Always include the raw template line for
  every missing player, and old→new values for every drift.
- Padding a VALID verdict with per-player detail — nothing to hand off, so
  the one-line form is the whole report.
