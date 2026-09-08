# squadctl

Deterministic squad data management for Escuadra. Moves the mechanical parts
of maintaining squad data — fetch a Wikipedia section, parse template lines,
reconcile against stored records, write JSON — off the `squad-factory` skills
and into a CLI.

The skills are **not** retired. Both paths produce the same `RosterEnvelope`
(`scripts/roster-envelope.ts`), so their outputs are directly diffable. The
intended end state is a combination: `squadctl --json` does the bulk work and
reports typed conflicts, and a skill spends tokens only on the residue that
needs judgement.

Design: `docs/superpowers/specs/2026-09-06-squadctl-design.md`.

## Running

**Node 24 or newer, first.** There is no build step and no TypeScript loader:
Node strips types natively and oclif imports the `.ts` command files directly,
which Node 22 cannot do.

```bash
nvm use                 # .nvmrc pins 24; do this once per shell
npm run squadctl -- <command> [flags]
```

On an older Node every command stops with a message naming the version and the
fix, rather than an `ERR_UNKNOWN_FILE_EXTENSION` from inside oclif. `npm run
check` and `npm run gen:squads` carry the same guard.

## Commands

### `registry init`

```bash
npm run squadctl -- registry init [--force]
```

Derives `data/teams.json` from every squad file already under `data/squads/`.
Every field the registry needs is already stored — `id`, `kind`, `name` and
`source` from the squad file, `league` from its folder path, and `identity`
from `primaryColor` / `secondaryColor` / `marker` — so existing teams cost no
authoring at all.

Refuses to overwrite a populated registry. Merging new entries into an
existing one is an operator edit, not a command.

### `registry check`

```bash
npm run squadctl -- registry check
```

The other direction from `registry init`: verifies `data/teams.json` still
agrees with the squad files `apply` wrote from it, instead of writing
anything. `apply` copies `name`, `source`, `kind`, `league` and `identity`
from the registry onto every squad file it writes, but nothing else checks
the two stay in sync — edit a colour or a name in `data/teams.json` and
forget to re-run `apply`, and the repo drifts silently. Also catches a squad
file with no registry entry at all.

A clean run prints how many teams agreed. A disagreement exits `5` and
prints every mismatch, naming both the squad file's value and the registry's.
Runs as part of `npm run check`, so drift is caught on the next check rather
than whenever someone happens to notice.

### `fetch`

```bash
npm run squadctl -- fetch                     # every team in the registry
npm run squadctl -- fetch --only sev,rma
npm run squadctl -- fetch --league la-liga
npm run squadctl -- fetch --kind nation       # the ~6x/year international-break sweep
npm run squadctl -- fetch --offline           # re-parse from cache, zero requests
npm run squadctl -- fetch --out path/to/dir
```

Reads each team's squad section into an envelope under
`.cache/envelopes/<runId>/`. Touches the network; writes no repo data.

A raw section request returns the matched section **and its subsections**, so
the parser cuts at the first heading after the first player row — otherwise
`===Reserve team===` and `===Out on loan===` land in the first-team squad.
Dropped headings are reported.

Two requests per team, ~200 ms apart: the section list, then that section's
raw wikitext. No per-player article is ever fetched.

**Cache.** The default fetches fresh and writes `.cache/wikitext/`. The cache
exists so a _parser_ change can be re-run at zero network cost, not so stale
data is served by default. `--offline` re-parses from it and makes no requests
at all. The section index is always re-resolved online and never trusted from
a previous run — a squad section's number moves as an article is edited.

**User-Agent.** Wikimedia policy allows refusing a generic or absent agent.
The default names the tool and points at the public repo.

## `data/teams.json` — the registry

One checked-in file is the single input to `fetch`. A registry entry with no
squad file simply _is_ a new team, so there is no separate intake path.

```json
{
  "id": "sev",
  "kind": "club",
  "league": "la-liga",
  "name": "Sevilla",
  "source": "https://en.wikipedia.org/wiki/Sevilla_FC",
  "identity": {
    "primaryColor": "#FFFFFF",
    "secondaryColor": "#E20001",
    "marker": { "bands": ["#FFFFFF", "#E20001"], "orientation": "vertical" }
  }
}
```

`league` is required on `kind: "club"` and must be absent on `kind: "nation"`.

`identity` cannot be derived — reading kit colours and expressing a flag as
bands is design judgement, done once per team ever — so an entry without it is
a hard failure rather than an invented colour. It is authoritative: `apply`
always writes it through.

The registry is validated before the first network call, so a malformed file
fails in milliseconds rather than halfway through 150 teams.

### `apply`

```bash
npm run squadctl -- apply .cache/envelopes/<runId>/ [--dry-run]
```

Reconciles every envelope in the directory against what is stored, runs the
assertion pass, and writes squad files, `players.json` and the generated index.
Pure with respect to its inputs: same envelopes plus same repo state gives the
same result.

`verified` is the assertion pass's output — `true` only when a team has zero
conflicts. `lastUpdated` moves only when something else in the file did, so a
no-op sweep produces an empty git diff. `players.json` is written sorted by id
and `members` sorted by shirt number, nulls last.

### `rename`

```bash
npm run squadctl -- rename <playerId> "<name as the source spells it>"
```

Points an existing player record at a new spelling **without touching its id**,
which every squad file referencing that player depends on. `fullName` moves too
only if it was tracking `name` exactly; a divergent `fullName` is real data and
is left alone. This is one of the two answers to a `possible-rename`, and the
answer to a `name-variant` — see below.

### `alias`

```bash
npm run squadctl -- alias <playerId> "<other name>"
```

Records another name one player is known by. Use it when two articles name the
same person differently and both are right — the case `rename` cannot fix,
because renaming to satisfy one squad breaks the other.

### `split`

```bash
npm run squadctl -- split <teamId> <departedPlayerId> "<arrived name>"
```

The other answer to a `possible-rename`: these really are two different people.
Records the decision in `data/decisions.json` so the same question is not asked
every sweep, and the next `apply` writes the split. Idempotent — running it
twice changes nothing.

## `--json`

Global, via `enableJsonFlag` on the shared base command. It suppresses human
logging and serialises the command's typed result. Commands never branch on
output format themselves.

## The loop, end to end

```bash
npm run squadctl -- registry init          # once, ever
npm run squadctl -- fetch                  # network -> .cache/envelopes/<runId>/
```

`fetch` ends by printing the exact `apply` command for the run it just wrote,
so the run directory never has to be reassembled by hand:

```
fetch: 2 fetched, 0 failed
next:     npm run squadctl -- apply .cache/envelopes/2026-09-07T15-33-48-501Z --dry-run
          drop --dry-run to write
```

Read the conflicts, fix them (below), then re-run without `--dry-run` to write.

`fetch` never touches the repo. `apply --dry-run` never touches the repo.
Only a bare `apply` writes, and it regenerates `data/index.json` and
`lib/squads.generated.ts` itself at the end.

## Adding a new team

**You add a registry entry; squadctl creates the squad file.** Never write a
squad JSON by hand — `apply` produces it, including the league folder if that
league has no teams yet.

1. **Append an entry to `data/teams.json`.** A registry entry with no squad
   file simply _is_ a new team; there is no separate intake command.

   ```json
   {
     "id": "bay",
     "kind": "club",
     "league": "bundesliga",
     "name": "Bayern Munich",
     "source": "https://en.wikipedia.org/wiki/FC_Bayern_Munich",
     "identity": {
       "primaryColor": "#DC052D",
       "secondaryColor": "#0066B2",
       "marker": { "bands": ["#DC052D"], "orientation": "vertical" }
     }
   }
   ```

   `identity` is the only part that is real work, and the only part squadctl
   will not do for you: reading kit colours and expressing a flag as bands is
   design judgement, once per team ever. An entry without it is a hard failure,
   never an invented colour. The `squad-factory` skill is good at this in
   batches. `name` matters beyond display — it becomes the `club` on every
   member of a club squad, and the `nationality` on every member of a nation
   squad, so it must match the spelling `players.json` already uses.

2. **Fetch and apply.**

   ```bash
   npm run squadctl -- fetch --only bay
   npm run squadctl -- apply .cache/envelopes/<runId> --dry-run
   npm run squadctl -- apply .cache/envelopes/<runId>
   ```

   `apply` writes `data/squads/club/bundesliga/bay.json`, adds every unknown
   player to `players.json`, and regenerates the index.

A brand-new team parses clean or not at all — there is no stored squad to
compare against, so the blast-radius check is skipped (it would otherwise trip
at 100%) and every player is new, which is a warning rather than a conflict.
Expect `written`, `verified: true`, and a long "new player id(s)" line.

### `registry init` is not for this

`registry init` runs **once for the bootstrap**, plus `registry check` on
every `npm run check`, plus `init --force` as the recovery path if
`data/teams.json` is ever lost or mangled. The bootstrap run derives
`data/teams.json` from squad files that already exist — for a repo that had
squads before it had a registry. Beyond that, `registry init` refuses to
overwrite a populated registry, because merging new entries into an existing
one is an operator edit, not a command. Adding a team after that point is
step 1 above: edit the file.

## Two rules that keep `players.json` stable

**Field ownership by squad kind.** A player sits in at most one club squad and
one nation squad, and the two articles disagree — Atlético calls Simeone MF,
Argentina calls him FW. Each kind owns the fields it is definitionally right
about and only fills blanks in the others:

| field         | owned by     | because                              |
| ------------- | ------------ | ------------------------------------ |
| `club`        | club squad   | they play there                      |
| `position`    | club squad   | its article tracks them week to week |
| `nationality` | nation squad | they play for that country           |
| `birth`       | neither      | never overwritten once known         |

Without this, whichever squad applied last won and the next sweep flipped it
back, so `players.json` could never produce an empty diff.

**Club names are canonicalised against the registry.** Argentina's article
writes `[[Inter Milan|Internazionale]]` where others write `[[Inter Milan]]`.
The display text forks one club into two names; the article title does not. For
any club in `data/teams.json`, the title is mapped back to the registry's
`name`, so a club appears under exactly one spelling — which matters because
level 3 asks a nation-squad player's club, and two spellings would appear as
two different answers.

## Where the CLI hands over to you

**squadctl decides what it can prove and stops at what it cannot.** A conflict
is not a bug and not a failure — the team still gets written. It means the file
now carries `verified: false` and is waiting on a judgement no parser can make.
Exit code `4` is precisely this signal: _review needed_, not _broken_.

Everything below is what a conflict means, what you decide, and the command
that hands the answer back.

### `possible-rename`

```
atm: conflicted (verified: false)
     conflict: possible rename — stored "Álex Grimaldo" (grimaldo) left the squad,
               source lists "Alejandro Grimaldo"
     fix:      one person:  npm run squadctl -- rename grimaldo "Alejandro Grimaldo"
               two people:  npm run squadctl -- split atm grimaldo "Alejandro Grimaldo"
```

Wikipedia changed how it spells a player, without the squad changing at all.

**The squad slot is HELD on the stored record and no new player is created.**
This is the one conflict where writing first and asking afterwards is
unrecoverable: it puts a second record for one person into `players.json`, with
the birth date dropped, pointed at by the squad — and no later command undoes
it. So nothing is written until you answer.

**You decide: same person, or two people?**

- **Same person** — point the existing record at the new spelling. The id never
  changes, because every squad file referencing this player uses it:

  ```bash
  npm run squadctl -- rename grimaldo "Alejandro Grimaldo"
  ```

- **Same person, and both names are right** — two articles can name one person
  differently and neither be wrong. Atlético writes "Alejandro Grimaldo",
  Spain writes "Álex Grimaldo". `rename` cannot settle that: it just moves the
  conflict to whichever squad uses the other spelling. Record both names
  against the one record instead:

  ```bash
  npm run squadctl -- alias grimaldo "Alejandro Grimaldo"
  ```

- **Two different people** — record that, so the question is not asked again
  every sweep:

  ```bash
  npm run squadctl -- split atm grimaldo "Alejandro Grimaldo"
  ```

Both write `data/decisions.json`. Re-run `apply` afterwards.

### `omitted-row`

```
bra: "Ederson" could not be placed and is missing from the squad — ambiguous against ederson, ederson-silva
```

A parsed row could not be matched to anyone and could not safely be created, so
the squad is one player short. Reported explicitly because no member-count
guard notices a nation squad going 26 → 25. Resolve the underlying
`ambiguous-name` and it goes away.

### `name-variant`

```
ars: spelling disagreement on odegaard: stored "Martin Ødegaard",
     source "Martin Odegaard"
```

The player **did** match — but only because `normalizeName` folds letters NFD
cannot decompose (`ø đ ð ł æ œ ß þ ı ŋ ħ`). The two sources genuinely disagree
on the spelling, and squadctl keeps yours rather than overwriting it.

**You decide whose spelling is right.** Take the source's with the same command:

```bash
npm run squadctl -- rename odegaard "Martin Odegaard"
```

Or keep yours and accept that it will be flagged again next sweep.

### `ambiguous-name`

```
bra: ambiguous name "Ederson" matches ederson, ederson-silva
```

Two real people share a normalised name and nothing separated them. Within one
squad, squadctl first tries position, then club, then shirt number — so this
only survives when those are equal too, or when the collision is across squads.

When the collision is **inside** the squad, the whole group is held exactly as
stored rather than any of them being dropped. When it is across squads there is
nothing to hold, so the row is omitted and reported as `omitted-row`.

**This one has no command.** Open `data/players.json`, work out which record the
row means, and make them distinguishable — usually by giving one the fuller name
it should have had:

```bash
npm run squadctl -- rename ederson-silva "Éderson Silva"
```

### `unknown-template`

```
xxx: unrecognised player-ish template {{football squad player}} — parser needs teaching
```

Not a data problem — a parser gap. The row was **not** parsed, so the squad is
quietly one player short. Add the variant to `PLAYER_TEMPLATE` in
`src/lib/wikitext-parse.ts` with a fixture, then re-run `fetch --offline`
(the wikitext is already cached; this costs no requests).

### `blast-radius`

```
xxx: roster changed 62% against the stored squad
```

More than 40% of the roster moved. Usually the article was restructured or
vandalised, occasionally a real mid-window clear-out. **Read the diff before
applying.** If the parse is right, apply and the conflict clears next sweep
because the stored squad now matches. Skipped entirely for a team with no stored
squad, so new teams never trip it.

### `call-ups-only`

The article had no contract roster, only `Recent call-ups`. Nothing to fix —
this is a permanent property of that article until someone adds a squad section
upstream. The team stays `verified: false`, correctly.

## What squadctl will never do for you

- **Design a team's `identity`.** Reading kit colours and expressing a flag as
  bands is judgement, once per team ever. A registry entry without it is a hard
  failure, never an invented colour.
- **Merge two player records.** It flags; you decide.
- **Prune an orphan.** An orphan is exactly the record reused, birth date
  intact, when that player turns up in another squad next window. The report
  counts them; nothing deletes them.
- **Clear `verified` by hand.** It is the assertion pass's output, not a flag.

## Exit codes

Stable, because scripts and skills branch on them. Failures are **per-team**:
the process exit code is the highest severity encountered across the run, so a
sweep where 148 teams succeed and two fail still exits non-zero and the report
says which two.

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| 0    | clean                                                     |
| 1    | network / HTTP                                            |
| 2    | no matching section                                       |
| 3    | parse produced nothing usable                             |
| 4    | conflicts present — files written, some `verified: false` |
| 5    | repo write, registry, or generator error                  |

Code `4` means _review needed_, not _broken_.
