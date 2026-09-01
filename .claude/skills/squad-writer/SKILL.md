---
name: squad-writer
context: fork
description: Use when applying one or more validated roster envelopes to Escuadra's data — writing squad files, reconciling players.json, and regenerating the index. The only skill that writes shared squad data; runs teams strictly sequentially and never in parallel.
---

# Squad Writer

## Overview

Given a **list** of roster-envelope paths for one batch — produced earlier by
`[[squad-fetcher]]` (intake) or `[[squad-verifier]]` (maintenance) — apply
each to Escuadra's data: reconcile the envelope's members against
`data/players.json`, write the matching squad file, and regenerate the
generated outputs once at the end. Teams are processed **one at a time, in
order**, never in parallel.

This is the write half of the retired `squad-updater` (its steps 7-11). It is
the **only** skill permitted to write `data/players.json`, any file under
`data/squads/`, `data/index.json`, or `lib/squads.generated.ts`. It never
fetches or parses a Wikipedia page itself — every fact it writes comes from
the envelope files it's handed, already parsed and, for `identity`, already
sourced. If something about an envelope looks wrong, that's a reason to defer
the team (see The ambiguity rule) or refuse the batch (see The entry gate),
never a reason to go re-derive the fact from the source page.

## Never run this in parallel

Every team in a batch writes to the same `data/players.json` and, at the end,
the same generated outputs (`data/index.json`, `lib/squads.generated.ts`).
Two teams writing at once — whether dispatched as concurrent subagents inside
one run, or as two separate `squad-writer` invocations started around the
same time — can each read `players.json` before the other's write lands, then
both write back a version missing the other's change. That's a silent data
loss, not a crash, so there's nothing to notice until a player or squad
mysteriously reverts. Process the batch's teams strictly in sequence, and
never start a second `squad-writer` run while one is already in progress.

## The entry gate

Before touching anything, validate every envelope in the batch in one call:

```
node scripts/envelope-check.ts <path1> <path2> ...
```

On Windows, `node`/`npm` may not be on the shell's PATH by default — if a
bare call like this one fails, locate `node.exe`'s directory (commonly
`C:\Program Files\nodejs`) and prepend it to `PATH` for that command,
rather than trying alternate invocations one at a time. The same applies
to the batch-end regenerate's `node` call below.

This call never passes `envelope-check.ts`'s optional
`--against <storedSquad.json>` flag. That mode reports blast radius
against one stored squad's own roster — it needs a per-team stored-squad
path to diff against, and belongs to `squad-verifier`'s per-team check,
not this skill's single, multi-team entry-gate call.

Two distinct checks follow from this, and they act at different scopes:

- **Structural validity is a whole-batch gate.** If `envelope-check.ts`
  reports even one envelope malformed, refuse the entire batch — do not write
  anything for any team, including the ones whose envelopes were fine. Report
  the validation errors and stop.
- **`status` is a per-team filter, applied after the structural gate
  passes.** Process only envelopes whose `status` is `OK`. In practice this
  filter rarely does anything: both producing skills write an envelope file
  _only_ when `status: OK` (see `squad-fetcher`'s output contract) — a
  `NEEDS_DECISION`/`SOURCE_BROKEN`/`PARSE_FAILED` result never reaches disk
  as a file at all. Keep the check anyway as a defensive backstop rather than
  assuming the invariant always holds; if it's ever violated, skip that
  team's file rather than acting on a non-`OK` envelope.

## Procedure (per team)

0. **Read the stored squad file, if one exists**, at its nested path (see
   Quick reference). Needed for three things done later in this procedure:
   diffing for the report, carrying `identity` forward when the envelope
   omits it, and noticing a `verified: true → false` downgrade.
1. **Reconcile every envelope member** against `data/players.json` — see
   Player reconciliation. Stage the resulting `players.json` edits (new
   entries, updated fields) in memory; do not write them yet.
2. **If reconciliation raises an ambiguity for any member**, stop working on
   this team: apply The ambiguity rule, discard everything staged in step 1,
   and move on to the next team in the batch.
3. **Build the new `members` array** as a full replacement of whatever was
   stored — see The merge rule.
4. **Determine `primaryColor`/`secondaryColor`/`marker`** per The merge
   rule: taken from `envelope.identity` when present, otherwise carried
   forward unchanged from the file read in step 0.
5. **Write both files together, atomically as a pair**: the staged
   `players.json` edits from step 1, and the squad file at its nested path
   with the shape `{ id, kind, name, season, primaryColor, secondaryColor,
verified, marker, lastUpdated, source, members }` — `id`/`kind`/`name`/
   `season` copied from `envelope.team`; `primaryColor`/`secondaryColor`/
   `marker` from step 4; `verified` always `false` (see below); `lastUpdated`
   set to today's ISO date (`YYYY-MM-DD`); `source` set to
   `envelope.team.source`, the exact URL the envelope's producer fetched.
   A club squad's file lives under the league folder named by
   `envelope.team.league`; that value is not a field of the squad file
   itself, only of its path (see Quick reference) — trust it as given, it's
   already constrained by the producer's own closed-`League` no-questions
   rule, not something to re-derive here.

Only after every team in the batch has reached step 5 or been deferred at
step 2, move on to The batch-end regenerate.

## Player reconciliation

Do this for **every** member the envelope carries, not only the ones that
look new — an existing player's `club` can be stale from a prior session even
when nothing about _this_ team's fetch changed for them.

- **Match key**: normalised name — `normalizeName` in
  `scripts/roster-envelope.ts` is the reference implementation
  (case-insensitive, diacritics stripped, whitespace collapsed) — **plus
  `birth` where both the envelope member and a candidate stored player have
  one.** Fall back to name alone only when neither side has a birth date to
  compare.
- **On exactly one match**: reuse that player's existing `id`. Update
  whichever of `club`, `position`, `nationality` differs from what's
  currently stored. Never touch `photo` — it stays `null` in v0 regardless
  of what the envelope carries. Update `fullName` only when the envelope
  actually supplies a non-blank one for this member (it's optional there);
  otherwise leave the stored `fullName` untouched.
- **On no match**: create a new entry. The real player record shape is
  `{ id, name, fullName, birth, position, nationality, club, photo }` —
  populate `name`, `birth`, `position`, `nationality`, `club` directly from
  the envelope member's corresponding fields, and `photo: null` always. For
  `fullName`, use the envelope's `fullName` when present; when it's absent,
  use `name` itself — this matches the existing convention already in
  `players.json`, where a large share of entries have `name === fullName`
  because no fuller legal name is known. `id` follows the conventions
  already in the file: a kebab-case surname by default; a first-name form or
  another disambiguated form where the existing data already does so (e.g.
  `lautaro`, `pio-esposito`), or where the plain surname would collide with
  an id already in use.
- **On ambiguity** — multiple candidate matches, or a name match whose
  stored `birth` conflicts with the envelope member's `birth` (both present,
  values differ) — see The ambiguity rule; do not resolve it by guessing.

The envelope's `nationality`, `club`, `birth`, and `position` fields are
already the clean values the player record needs — whatever FIFA-code
translation or per-player birth-date lookup a new entry required already
happened when the envelope was produced upstream. This skill copies them
verbatim. It never reinterprets a member's `raw` wikitext line and never
fetches anything itself to fill a gap; `raw` is carried on the envelope for
audit purposes, not as an input this skill parses.

## The ambiguity rule

On multiple candidate matches for the same envelope member, or a name match
whose `birth` conflicts, **do not guess and do not partially write.**
Abandon that team entirely: report it as `NEEDS_DECISION`, naming every
candidate the operator must choose between (stored `id`, name, and birth
date where known), and **leave every one of that team's files
untouched** — no squad file write, no `data/players.json` edit, not even for
the members of that same team who matched cleanly and unambiguously. This is
exactly why step 1 stages reconciliation edits in memory rather than writing
them immediately: an ambiguity discovered on member 24 of 26 must not leave
the first 23 members' `players.json` updates sitting on disk.

A half-written squad file, or two real people silently merged into one
player record, is far worse than one team deferred to the operator.
Atomicity is per team: a team lands completely or not at all. One team's
`NEEDS_DECISION` never blocks or rolls back any other team already written,
or still to come, in the same batch.

## The merge rule

This is the hard invariant of the whole skill.

- **`members` is always a full replace.** The squad file's `members` array
  is exactly what this run's envelope parsed, mapped through reconciliation
  into `{ playerId, no, captain? }` per member — never a merge with whatever
  `members` array was stored there before. (The envelope's `EnvelopeMember.no`
  is a required integer — `validateEnvelope` rejects anything else — so a
  member written this way always carries a real shirt number; `SquadMember.no`
  being typed as `number | null` accommodates a case this skill's input never
  produces.)
- **`identity` — `primaryColor`, `secondaryColor`, and `marker` together —
  merges only when the envelope carries an `identity` key.** Present means:
  write `identity.primaryColor`, `identity.secondaryColor`, and
  `identity.marker` into the squad file verbatim, replacing whatever was
  there. **Absent means "not inspected," never "clear it."** An absent
  `identity` key must result in the squad file keeping exactly the
  `primaryColor`, `secondaryColor`, and `marker` already read from the
  stored file in procedure step 0.
- **State the consequence plainly: get this backwards even once and it wipes
  every marker in the repo.** Treating an absent `identity` as "no colour, no
  marker" — nulling the fields out, or substituting some placeholder — looks
  harmless on one team, but a maintenance sweep runs `identity`-less
  envelopes across _every_ stored team in the same batch. That single bug
  would silently erase every team's real colours and marker geometry in one
  run, with no signal until someone opens the picker. There is no automatic
  undo for that beyond git history.
- **Corollary — an absent `identity` presupposes a stored file to carry
  values forward from.** Per `squad-fetcher`'s own contract, `identity` is
  populated only on intake, when a squad id is freshly minted; a maintenance
  envelope for an id that already exists omits it. So if `identity` is
  absent from an envelope and step 0 finds **no** file at that squad's
  nested path, the envelope contradicts its producer's own contract. Treat
  that as a reason to defer the team (name the problem plainly, the same way
  an ambiguity is reported) rather than inventing a placeholder colour or
  marker to fill the gap — fabricating team colours is barred outright,
  contract inconsistency or not.

## `verified` is always false

Every write this skill makes sets `verified: false` — a brand-new squad and
a refresh of a squad that was previously `true`, alike. Scraping plus
envelope reconciliation is not the real source check that flag exists to
gate, no matter how clean the envelope looks. When step 0's read shows the
stored file had `verified: true`, say so explicitly in that team's line of
the report as a downgrade — don't let a `true → false` flip pass as an
unremarkable field write; the operator needs to know a previously-checked
squad now needs re-verification.

## The batch-end regenerate

Only after every team in the batch has reached step 5 of the per-team
procedure or been deferred by the ambiguity rule, run the generator exactly
once for the whole batch:

```
node scripts/gen-squads.ts
```

Use that direct `node` invocation, **not** `npm run gen:squads` — the npm
wrapper dominates cost on Windows for a script this cheap to invoke
directly. Run it **once**, not once per team: the generator rebuilds
`data/index.json` and `lib/squads.generated.ts` from _every_ file under
`data/squads/` on each invocation, so calling it after each team redoes the
same O(n) work n times for a result step 5 already ensured is correct on
disk before regeneration runs at all.

Never hand-edit `data/index.json` or `lib/squads.generated.ts` directly for
any reason — they exist only as this generator's output.

### If the generator itself fails

`gen-squads.ts` throws — before writing either output — on an unrecognised
league folder under `data/squads/club/`, a squad file whose `id` field
doesn't match its own filename, or two squad files sharing the same `id`.
The entry gate does not catch any of these in advance:
`validateEnvelope` only checks that a club envelope's `team.league` is a
non-empty string, not that it's one of the closed `League` values, so a
bad value can slip through the gate and only surface here.

**Recognise it** by the command exiting non-zero with one of those three
error messages, each naming the offending file directly.

**Know the state you're in when it happens:** every team's squad file and
`players.json` edits from step 5 are already correctly on disk — those
writes are not rolled back — but `data/index.json` and
`lib/squads.generated.ts` still reflect the pre-batch tree, since the
generator throws before writing either one. `npm run check`'s diff guard
will fail on this mismatch until it's resolved.

**Do not** hand-edit `data/index.json` or `lib/squads.generated.ts` to
paper over the mismatch — that prohibition holds even in this failure
case. The fix is to open the squad file the error names, correct the
actual structural problem (move it to the right league folder, correct
its `id`, or resolve the duplicate), and re-run
`node scripts/gen-squads.ts`. Once every file under `data/squads/` is
structurally sound, the same command that failed will succeed.

**Report it explicitly** rather than folding it into a normal completion
line: name the failing file and the generator's exact error, state that
the team-level writes already succeeded and are not at risk, and flag
that `data/index.json`/`lib/squads.generated.ts` are stale — and that
`npm run check` will fail — until the offending file is fixed and the
generator is re-run successfully.

## Report format

Per team written:

```
<team name> (<id>) — written; verified: false[, downgraded from true]
source: <envelope.team.source>
lastUpdated: <today>
as of: <envelope.team.asOf, or "not stated">
captain: <player name>, no <N>

Added: <player name> (no <N>), ...
Removed: <player name> (was no <N>), ...
Moved club: <player name>: <old club> → <new club>, ...
Number changes: <player name>: no <old> → <new>, ...
```

Omit any of the last four groups that's empty; for a brand-new squad (no
file existed before step 0), skip the diff groups entirely and just state
the roster size ("new squad, N players").

Per team deferred:

```
NEEDS_DECISION <team name> (<id if known>) — <reason>, naming every candidate
  (stored id, name, birth if known); no files touched for this team.
```

For a whole-batch refusal at the entry gate, report the validation errors
`envelope-check.ts` printed and state plainly that no team in the batch was
processed.

Close with a one-line batch summary (teams written, teams deferred, whether
the batch-end regenerate ran) — this is the per-team change summary the
orchestrator's own report is compiled from.

## Common mistakes

- Running two or more teams' writes in parallel, or starting a second
  `squad-writer` run while one is in progress — both race on the same
  `players.json` and generated outputs.
- Running `node scripts/gen-squads.ts` once per team instead of once at
  batch end, or reaching for `npm run gen:squads` instead of the direct
  `node` call.
- Treating an absent `identity` key as "clear the marker" instead of
  "preserve what's stored" — this is the single most damaging mistake this
  skill can make; see The merge rule's stated consequence.
- Fabricating a placeholder colour or marker when `identity` is absent and
  no stored file exists yet — an envelope in that shape is contract-broken,
  not licence to invent team colours.
- Duplicating a player in `data/players.json` instead of matching an
  existing entry by the normalised-name-plus-birth key.
- Guessing through an ambiguous name/birth match instead of applying The
  ambiguity rule, or writing a partial team — e.g. a squad file with
  reconciled members but a skipped `players.json` update, or vice versa —
  when an ambiguity is found partway through a team's members.
- Setting `verified: true`, or leaving a previously-`true` value in place,
  on any write this skill performs — it is always `false` after this skill
  touches a squad file.
- Populating `photo` from anything the envelope carries, or from any other
  source — it stays `null` in v0 unconditionally.
- Hand-editing `data/index.json` or `lib/squads.generated.ts` instead of
  letting the batch-end generator produce them from the squad files just
  written.
- Processing an envelope whose `status` isn't `OK`, or skipping the
  `node scripts/envelope-check.ts` entry gate before touching any file.
- Re-deriving a fact (a FIFA nationality code, a player's birth date, a
  club's real colours) from `raw` or from a fresh fetch instead of trusting
  the envelope's already-clean fields — that work belongs to whichever
  reader produced the envelope, not to this skill.
- Leaving `lastUpdated`/`source` stale on a refresh — step 5 overwrites
  both with today's date and the envelope's `team.source` on every write,
  new squad or refresh alike, with no exceptions.

## Quick reference

| What                 | Value                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Nation squad path    | `data/squads/nation/<id>.json`                                                                                                            |
| Club squad path      | `data/squads/club/<league>/<id>.json`, `<league>` = `envelope.team.league`                                                                |
| League folder values | `la-liga`, `serie-a`, `bundesliga`, `ligue-1`, `premier-league`, `ucl`                                                                    |
| Squad file shape     | `{ id, kind, name, season, primaryColor, secondaryColor, verified, marker, lastUpdated, source, members }`                                |
| Squad member shape   | `{ playerId, no, captain? }`                                                                                                              |
| Player record shape  | `{ id, name, fullName, birth, position, nationality, club, photo }`                                                                       |
| Player id convention | kebab-case surname; first-name/disambiguated form where existing data already does so (`lautaro`, `pio-esposito`) or to avoid a collision |
