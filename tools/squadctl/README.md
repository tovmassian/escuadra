# squadctl

Deterministic squad data management for Escuadra. Moves the mechanical parts
of maintaining squad data — fetch a Wikipedia section, parse template lines,
reconcile against stored records, write JSON — off the retired `squad-factory`
skill set and into a CLI.

The `squad-factory` skill set (`squad-fetcher`, `squad-writer`,
`squad-verifier`) has been removed: squadctl proved faster and more reliable,
so it now does that work directly. `squadctl --json` does the bulk work and
reports typed conflicts; the residue that still needs judgement — designing a
team's colours and `marker`, and resolving conflicts — is done by hand.

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

## Data mental model

**You edit inputs, squadctl writes outputs, and `verified` is never an
input.** Every file squadctl touches falls into exactly one of three tiers.
Knowing a file's tier tells you whether the right move is to open an editor
or run a command — including for every conflict in "Where the CLI hands over
to you" below.

### You own — hand-edit these

| file                                             | when                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| `data/teams.json`                                | adding a team; fixing a name, colour, marker or source |
| `PLAYER_TEMPLATE` in `src/lib/wikitext-parse.ts` | on an `unknown-template` conflict                      |
| `data/fifa-countries.json`                       | on an `unmapped FIFA code` failure                     |

Editing `data/teams.json` takes effect only on the next `apply` — until then,
`registry check` (part of `npm run check`) is what catches an edit here that
never got applied.

### Commands own — you cause the write, you do not type it

| file                  | written by                                              |
| --------------------- | ------------------------------------------------------- |
| `data/decisions.json` | `alias`, `split`, `exclude`, `birth`                    |
| `data/players.json`   | `apply`, `rename`, `retitle`, `fork`, `birth`, `enrich` |

### Generated — never touch, never hand-review

| file                                         | written by                                  |
| -------------------------------------------- | ------------------------------------------- |
| `data/squads/**/*.json`                      | `apply`                                     |
| `data/index.json`, `lib/squads.generated.ts` | `gen:squads`, which `apply` runs at the end |

Derivation runs one direction only:

```
data/teams.json
      |
      | fetch
      v
.cache/envelopes/<runId>/
      |
      | apply  <---  data/decisions.json (alias, split)
      |
      +--> data/squads/**/*.json
      |          |
      |          | gen:squads
      |          v
      |    data/index.json
      |    lib/squads.generated.ts
      |
      +--> data/players.json  (rename also writes this directly)
                 |
                 | enrich  <---  Wikipedia, Wikidata, Commons (.cache/wikimedia/)
                 v
           data/players.json  (photo, and birth where unknown)
```

Nothing upstream reads anything downstream of it. Hand-editing a squad file
to silence a conflict edits a generated artefact — the next `apply`
overwrites it, and the fix that actually sticks belongs at `teams.json`, at
a `rename`/`alias`/`split`, or in the parser.

`verified` does not appear in that diagram, because no command writes it — it
is the assertion pass's output (`assess()` in `src/lib/assertions.ts`),
recomputed every time `apply` runs. A team is `verified: false` because a
question is still open, one of the conflicts named below, not because a flag
was set. Answer the question with the command it names and re-run `apply`,
and `verified` clears itself.

That is true for a conflict, not for a hard failure. A team that fails
outright — zero members, a club squad under the minimum, more than one
captain, or no identity colour (the failure checks in `assess()`) — is never
written at all: `apply` records `status: 'failed'` and moves to the next
team before it ever builds a squad object. Whatever `verified` that team
already had on disk stays exactly as it was, stale or not. The run still
exits non-zero and names the team; only fixing the underlying failure and
re-running `apply` gives it a fresh `verified`.

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

**Nations with no shirt numbers.** Many nation articles publish their
current squad as a call-up list with `no=` empty (or `-`) on every row. They
parse cleanly, and `apply` **holds** them — see `apply` below.

**A shirt number listed twice.** Some articles give two players one number,
usually two matches' call-ups merged into one table. Every player sharing it
is written without a number, and the fetch report names them. The next sweep
restores the number once the article is corrected.

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

**A row is matched to a stored player primarily by an equivalent Wikipedia
article title, not by name.** "Equivalent" is deliberately looser than
equal: a bare link and a disambiguated one that share a base title are the
same article (`Endrick` and `Endrick (footballer, born 2006)`), and so are
two titles that agree once diacritics are folded (`Eric Garcia (footballer,
born 2001)` and `Eric García (footballer, born 2001)`) — both resolved
without asking. Title is decisive whatever the display names say: it is the
only thing that can join Juventus's "Nico González" to a record stored as
"Nicolás González". The normalised display name is the **fallback**, used
only when the row or the candidate record carries no title at all. When a
row's title instead **conflicts** with what a name match would have picked,
that is a `title-mismatch` — see below.

**A namesake is never matched.** Before the global steps, a same-named record
is set aside when it provably is someone else:

- the row and the record carry **different birth dates** — Uruguay's
  `Emiliano Martínez (footballer, born 1999)` against Argentina's goalkeeper,
  born 1992, stored under the bare title the row's link is base-equivalent to;
- or, for a nation row, **another nation's squad already holds the record** —
  a player plays for one nation. `apply` keeps this current through a run, so
  a nation applied earlier in the run counts like one on disk.

Neither applies when the row links the record's own article (equal once
normalised): the article decides. A row whose every same-named record was set
aside gets a new one (`aboubacar-camara-2`), reported as a warning, and the
team stays verified — nothing is left to decide. Two players in two nation
squads under one article title still fail `lib/dataIntegrity.test.ts`: that
is a real dual listing, and `exclude` answers it.

**A squad nobody can play is held.** A round asks ten numbered players
(`ROUND_LENGTH`), so a squad with fewer is not written: no squad file, no
player changes, and whatever is stored stays — a sweep never replaces
Brazil's numbered squad with its numberless call-up list. `held` is not a
failure and leaves the exit code alone; the next sweep writes the team once
its article numbers it.

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

### `retitle`

```bash
npm run squadctl -- retitle <playerId> "<article title as the source links it>"
```

Points a record at a different Wikipedia article title, for when the article
moved and the person did not. One of the three answers to a `title-mismatch`.
Never touches `name` — that is `rename` — and never rewrites an id.

### `fork`

```bash
npm run squadctl -- fork <playerId> "<article title of the other person>"
```

Writes a second record for a different real person who shares a display name —
the two Otávios, the two Vitinhas. Copies the name and position; deliberately
does **not** copy `birth`, `club` or `nationality`, because the birth date
belongs to the original and the next `apply` fills the other two from the row.

### `alias`

```bash
npm run squadctl -- alias <playerId> "<other name>"
npm run squadctl -- alias <playerId> --title "<other article title>"
```

Records another name one player is known by. Use it when two articles name the
same person differently and both are right — the case `rename` cannot fix,
because renaming to satisfy one squad breaks the other.

The `--title` form is the same idea one level up: two articles can _link_ one
person differently and both be right. Atlético links `Alejandro Grimaldo` where
Spain links `Álex Grimaldo`, and `retitle` cannot settle it — it just moves the
conflict to whichever squad links the other target. Recorded in
`decisions.json` under `titleAliases`, because a redirect is the one title fact
squadctl cannot re-derive without a network request.

### `split`

```bash
npm run squadctl -- split <teamId> <departedPlayerId> "<arrived name>"
```

The other answer to a `possible-rename`: these really are two different people.
Records the decision in `data/decisions.json` so the same question is not asked
every sweep, and the next `apply` writes the split. Idempotent — running it
twice changes nothing.

### `exclude`

```bash
npm run squadctl -- exclude <teamId> "<article title>" --reason "<why>"
```

Records that a club's article lists a player who does not belong in that
squad, and `apply` drops the row from then on.

**A player belongs to exactly one club — the one they actually play for.** The
club that owns the registration and collects the loan fee is irrelevant to the
quiz. Most of the time no decision is needed, because the article says so
itself: a loaned player's row carries an `other=` annotation and reconciliation
reads it (see _Loans_ below). This command is for the residue, where two
articles list the player identically and only the real world says which is
right — usually a completed transfer one club has not caught up with.

`--reason` is required, unlike every other decision's fields. This one
overrules the source outright, so the file records on whose say-so and `apply`
prints it back on every run. A stale override stays visible rather than
quietly shortening a squad forever.

Keyed on the **article title**, not the display name, so it survives the
article rewording the name. A row carrying no title never matches. Scoped to
one team: excluding a player from Verona leaves Torino untouched. Idempotent.

Never fix a dual membership by editing the squad file. Those are generated,
and `919f1f9` proved it — a player hand-removed from Arsenal was back on the
next `apply`.

### `enrich`

```bash
npm run squadctl -- enrich [--dry-run]
npm run squadctl -- enrich --only esp,rma   # just these teams' members
npm run squadctl -- enrich --offline        # re-run from cache, zero requests
```

Writes each player's photo credit (`photo`, a `PhotoCredit` in
`types/squad.ts`) and fills a birth date where none is stored. Runs after
`apply`, which ends by printing it when it added players. Touches the network
unless `--offline`; writes only `data/players.json`. Design and results:
`docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md`.

Per-player data comes in batches of 50, never one request per player — the
same rule `fetch` keeps. Four stages — the infobox only where birth dates
disagree — about 175 requests and under four minutes for the whole base at a
500 ms courtesy delay:

| stage     | asks for                                                                            |
| --------- | ----------------------------------------------------------------------------------- |
| Wikipedia | each `wikiTitle`'s free lead image and Wikidata item                                |
| Wikidata  | each item's `instance of`, date of birth and image (P31/P569/P18)                   |
| Infobox   | each article whose birth dates disagree: its infobox birth date and current club    |
| Commons   | each photo's next candidate: 960 px thumbnail, original size, licence, author, page |

Commons runs in passes: every photo's first candidate, then the item's own
image only for the photos whose first one proved unusable (2,200 files, then
1, for the whole base). Each lookup's query sits beside the reader that
depends on it — `lib/wikimedia-parse.ts`, `lib/photo-credit.ts` — so a field
read is a field asked for. Requests go through `lib/http.ts`, shared with
`fetch`: a pause before each, a 30 s timeout, and backoff on 429, 5xx and a
dropped connection.

**Photo.** The article's free lead image, else the Wikidata item's own. It is
written only with an accepted licence (CC BY or CC BY-SA at any version, CC0,
public domain, and Commons' attribution-only "Attribution"), a thumbnail on
`upload.` or `thumb.wikimedia.org`, the original's width and height, and a
Commons page exactly where `commonsFileUrl` (`scripts/commons.ts`) derives it
from the file name — the page is not stored, the app derives it. GFDL,
"Copyrighted free use" and everything else is refused and listed; why each
licence is accepted or refused: [`docs/license.md`](../../docs/license.md).

**Credit.** The name a credit shows is the attribution the licence asks for,
from Commons' `Attribution` field — "Bryan Berlin / WikiPortraits", or the
agency that holds the rights rather than its photographer — else the
author. An unknown-author placeholder counts as no name, and so does anything
longer than 120 characters — a template's source box or licence banner, not a
person; the credit then names Wikimedia Commons and links the file's page,
which names the author in full. The attribution-only licence's one condition
is crediting the holder, so a photo under it with no name — in any spelling of
the licence — is refused (`incomplete-credit`, missing `author`). Every
`incomplete-credit` is listed with what it lacks. No photo comes from a
missing article, a disambiguation page, or an item that is not a person. The
photo is the latest lookup's verdict and is rewritten every run. A key no
lookup answers — its batch failed after its retries, the reply skipped it, or
`--offline` has nothing cached for it — keeps what is stored, is listed, and
exits `1`.

**Birth.** Filled only where unknown, and only from one day-precise Gregorian
Wikidata date (preferred-rank claims when there are any) that puts the player
at 15 to 45 on 1 July of their squad's season. A filled date has no other
source to agree or disagree with, so an age outside that is an
`implausible-birth` conflict, below. A stored date Wikidata disagrees with is
never overwritten: it is a `birth-mismatch`. Either conflict holds the photo.

**Cache.** Each key's answer — an article, an item, a file — is cached on its
own in `.cache/wikimedia/<stage>/` before any rule reads it, so a rule change
re-runs with `--offline` at zero network cost, for any selection: `--only`,
or the whole base after one `retitle`. An online run always asks again and
refreshes what it asked. Answers sit under a hash of their query's shape, so
a changed query is never served an old answer. Wikidata's are trimmed to the
three claims read (~80 MB untrimmed for the base); a rule on another property
needs one online run.

**Run it on a developer machine.** Wikimedia's APIs answered `429` to a cloud
session's shared IP after fewer than ten requests. GitHub Actions runners are
untested.

### `birth`

```bash
npm run squadctl -- birth <playerId> <YYYY-MM-DD>
npm run squadctl -- birth <playerId> --keep
```

The command answers to a `birth-mismatch` or an `implausible-birth`. A date
sets the stored birth date (refusing one that does not exist, like
1998-02-29), and removes any `keptBirths` entry for that player, which
confirmed the date it replaces. `--keep` records in `data/decisions.json`
(`keptBirths`) that the stored date stands against Wikidata's.

## Loans

Handled by the parser, with no decision needed. A club's own article states
the direction in the player template's `other=` parameter, and the two
directions mean opposite things:

| `other=`                        | meaning                                | row     |
| ------------------------------- | -------------------------------------- | ------- |
| `on loan from [[X]]`            | the player is **here**, on loan from X | kept    |
| `at [[Y]] until <date>`         | the player is **at Y**                 | dropped |
| `on loan to [[Y]] until <date>` | the player is **at Y**                 | dropped |

The third column is what ends up in the squad. So Dortmund keeps Nwaneri and
Arsenal does not; Valencia keeps Elliott and Liverpool does not.

Clubs that file loanees under an `===Out on loan===` heading are handled
earlier and differently, by `trimToFirstSquadTable`, which cuts at the first
heading after the first player row. Premier League and Serie A articles keep
them inline in the main table instead, which is why `other=` has to be read.

`isOutOnLoan` anchors at the start of the value and requires the wikilink —
`on loan from [[Atlético Madrid]]` contains "at" and must not read as a
departure. **An unrecognised phrasing keeps the row.** That leaves the player
in two squads and `lib/dataIntegrity.test.ts` fails loudly, which is the safe
direction: quietly shortening a squad on a phrasing nobody has seen yet is the
one you cannot recover from.

Dropped rows are reported as a warning, not a conflict — the source stated
plainly that the player is elsewhere, so nothing is being guessed — and are
excluded from `parsedCount`, which feeds the blast-radius ratio. Counting them
would make a club with several loanees out look like a page restructure.

## `--json`

Global, via `enableJsonFlag` on the shared base command. It suppresses human
logging and serialises the command's typed result. Commands never branch on
output format themselves.

## The loop, end to end

```bash
npm run squadctl -- registry init          # once, to bootstrap — see below
npm run squadctl -- fetch                  # network -> .cache/envelopes/<runId>/
npm run squadctl -- apply <runDir>         # envelopes -> squad files, players.json
npm run squadctl -- enrich                 # network -> photos and birth dates
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
`lib/squads.generated.ts` itself at the end. When it added players it ends
with the `enrich` command for their teams: a new record has no photo, and a
club-squad row carries no birth date.

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
   design judgement, once per team ever, done by hand. An entry without it is
   a hard failure, never an invented colour. `name` matters beyond display —
   it becomes the `club` on every member of a club squad, and the
   `nationality` on every member of a nation squad, so it must match the
   spelling `players.json` already uses.

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

| field         | owned by     | because                                                       |
| ------------- | ------------ | ------------------------------------------------------------- |
| `club`        | club squad   | they play there                                               |
| `position`    | club squad   | its article tracks them week to week                          |
| `nationality` | nation squad | they play for that country                                    |
| `birth`       | neither      | never overwritten once known; `enrich` fills it from Wikidata |
| `photo`       | `enrich`     | rewritten from Commons every run                              |

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

**What you touch:** `alias` and `split` write `data/decisions.json`; `rename`
writes `data/players.json` directly. Re-run `apply` afterwards either way.

### `omitted-row`

```
bra: "Ederson" could not be placed and is missing from the squad — ambiguous against ederson, ederson-silva
```

A parsed row could not be matched to anyone and could not safely be created, so
the squad is one player short. Reported explicitly because no member-count
guard notices a nation squad going 26 → 25.

**What you touch:** nothing directly — resolve the underlying
`ambiguous-name` and this clears with it.

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

**What you touch:** `data/players.json`, only through `rename` — never by
hand. Or keep yours and accept that it will be flagged again next sweep.

### `title-mismatch`

```
sge: conflicted (verified: false)
     conflict: identity conflict on otavio — stored "Otávio (footballer, born 2002)",
               source lists "Otávio (footballer, born November 2005)"
```

The row matched a stored record by display name, and the two link different
Wikipedia articles. Two different real people share a name — two Brazilian
defenders are both rendered `Otávio` — or one person's article moved. Nothing
in the data separates those, so squadctl writes nothing and asks.

**The squad slot is HELD on the stored record and no new player is created**,
for the same reason `possible-rename` holds: creating a second record for one
person is unrecoverable, and no later command undoes it. When the clashing
record is not in this squad at all there is no slot to hold, so the row is
omitted and reported as `omitted-row`.

**You decide: one person, or two?**

- **Same person, article moved** — point the record at the new title:

  ```bash
  npm run squadctl -- retitle otavio "Otávio (footballer, born November 2005)"
  ```

- **Same person, both titles right** — two articles can link one person through
  different targets. Atlético links `Alejandro Grimaldo`, Spain links
  `Álex Grimaldo`. `retitle` only moves the conflict to the other squad:

  ```bash
  npm run squadctl -- alias grimaldo --title "Alejandro Grimaldo"
  ```

- **Two different people** — write the second record:

  ```bash
  npm run squadctl -- fork otavio "Otávio (footballer, born November 2005)"
  ```

**What you touch:** `retitle` and `fork` write `data/players.json`;
`alias --title` writes `data/decisions.json`. Re-run `apply` afterwards either
way.

Note that most redirect pairs never reach you: a link to the undisambiguated
title (`[[Endrick]]` against `Endrick (footballer, born 2006)`) and an
accent-only difference (`Eric Garcia` against `Eric García`) are both resolved
as equivalent without asking.

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

The same conflict kind also fires on a **title** collision: a bare
`[[Otávio]]` is base-title equivalent to two different stored Otávio records,
and a title alone cannot separate them. There too the row's own position and
club are tried first, in that order — Portugal links a bare `[[Vitinha]]`
that relates to both `Vitinha (footballer, born February 2000)` and `...
born March 2000)`, and exactly one of the two is the MF at Paris
Saint-Germain the row describes. The conflict survives only when none of
that narrows to one candidate. This is not `title-mismatch` — nothing here
contradicts a name match, there simply are two candidates left — so the fix
is the same as for a name collision: read `data/players.json`, work out which
record the row means, and hand the answer back with `rename` (or `retitle`,
if the article title itself is what needs correcting).

**This one has no command.** Read `data/players.json`, work out which record
the row means, and hand the answer back with `rename` — never edit the file
by hand — usually by giving one player the fuller name they should have had:

```bash
npm run squadctl -- rename ederson-silva "Éderson Silva"
```

**What you touch:** `data/players.json` to read, `rename` to write it back.

### `unknown-template`

```
xxx: unrecognised player-ish template {{football squad player}} — parser needs teaching
```

Not a data problem — a parser gap. The row was **not** parsed, so the squad is
quietly one player short. Add the variant to `PLAYER_TEMPLATE` in
`src/lib/wikitext-parse.ts` with a fixture, then re-run `fetch --offline`
(the wikitext is already cached; this costs no requests).

**What you touch:** `PLAYER_TEMPLATE` in `src/lib/wikitext-parse.ts` — the
parser, not a data file.

### `blast-radius`

```
xxx: roster changed 62% against the stored squad
```

More than 40% of the roster moved. Usually the article was restructured or
vandalised, occasionally a real mid-window clear-out. **Read the diff before
applying.** If the parse is right, apply and the conflict clears next sweep
because the stored squad now matches. Skipped entirely for a team with no stored
squad, so new teams never trip it.

**What you touch:** nothing directly — read the diff, and if the parse is
right, a plain `apply` clears it.

### `birth-mismatch` (from `enrich`)

```
conflict: birth date on torres ("Ferran Torres") — stored 1998-02-29, Wikidata 2000-02-29 ("Ferran Torres")
    fix:      Wikidata is right:      npm run squadctl -- birth torres 2000-02-29
              wrong person:           npm run squadctl -- retitle torres "<their article title>"
              stored date is right:   npm run squadctl -- birth torres --keep
```

The stored birth date and Wikidata disagree. Either can be wrong, or the
title names a different person — a different birth date is how that shows
up.

**`enrich` first asks the article's infobox**, the tie-break below, made
mechanical: one batched request per 50 disagreeing titles, cached like the
other stages.

- Infobox = stored date: Wikidata is the odd one out, and the stored date
  stands (`confirmed`).
- Infobox = Wikidata's date, **and** the infobox's current club is ours: the
  stored date was a typo in the squad table, and Wikidata's is written
  (`corrected`). Without the club the article could be a namesake's — Iraq
  links Hussein Hassan to an Al-Zawraa player's article, and the squad says
  Erbil.

Of the first 103 on the new nations, 88 settled this way. What remains is a
conflict: `enrich` writes neither date and **holds the photo** until you
answer. Exit code `4`.

**You decide which source is right.** Read the article's infobox: this
project's source is Wikipedia, so it breaks the tie.

- **Infobox agrees with Wikidata**, and the article's club with ours: the
  stored date is wrong. `birth <id> <date>`. Most of the first run's 68 were
  this — dates the retired LLM pipeline invented.
- **Infobox agrees with the stored date**: Wikidata is the odd one out (a
  placeholder 1 January, a typo'd year). `birth <id> --keep`.
- **The article is someone else** — another nationality, club or decade:
  `retitle`, and `alias --title` the old link so `apply` keeps matching.
- **No majority**: leave it. The photo stays held, and nothing is guessed.

**What you touch:** `birth` writes `data/players.json`, `birth --keep`
writes `data/decisions.json`, `retitle` writes `data/players.json`. After
`birth`, re-run `enrich --offline`: a held photo is looked up with the rest,
so it needs no requests. After `retitle`, the new title is a new lookup:
`enrich --only <team>`.

### `implausible-birth` (from `enrich`)

```
conflict: birth date on veteran ("Veteran") — Wikidata's 1950-03-02 ("Veteran") makes them 76 in 2026, outside playing age 15–45
    fix:      wrong person:           npm run squadctl -- retitle veteran "<their article title>"
              the date is right:      npm run squadctl -- birth veteran 1950-03-02
```

No birth date was stored, and Wikidata's would put the player at an age no
squad player has. A filled date's only source is the item it came from, so
nothing else can disagree with it; this is how a title naming an older
namesake shows up. `enrich` fills nothing and **holds the photo**. Exit code
`4`. Read the article: if it is someone else, `retitle` (and `alias --title`
the old link); if the date is right — a 46-year-old goalkeeper — `birth` stores
it, and from then on it is checked against Wikidata rather than filled. A
namesake of the same age is not caught here.

`enrich` also warns, without exiting non-zero, about a title that leads to a
**disambiguation page**: find the person's own article, `retitle` to it, and
`alias --title` the link the source uses.

### `call-ups-only`

The article had no contract roster, only `Recent call-ups`. Nothing to fix —
this is a permanent property of that article until someone adds a squad section
upstream. The team stays `verified: false`, correctly.

**What you touch:** nothing — there's no fix to apply, only a permanent
property of the article to accept.

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

Code `4` means _review needed_, not _broken_. A held team (`apply`) raises no
code at all: nothing is wrong, the article just is not playable yet.

`enrich` uses the same table: `1` when a lookup went unanswered — a batch
failed after its retries, the reply skipped a key, or `--offline` had nothing
cached for it (those players keep what they had) — `4` when a `birth-mismatch`
or `implausible-birth` is waiting, `5` for a repo error. Its `4` writes
everything else and never touches `verified`, which is a squad file's
assertion, not a player's.

**Stable under `--json` too, but only because the base command makes it so.**
oclif's own wrapper (`@oclif/core@5.0.0` `lib/command.js:202`) falls back to
`process.exitCode = process.exitCode ?? err.exitCode ?? 1`, and a
`this.error(msg, { exit: N })` call raises a `CLIError` that stores `N` on
`error.oclif.exit`, never on `exitCode` — so that `?? 1` used to win, and
every such error exited `1`. Without `--json` nobody noticed, because the
rethrow reaches oclif's top-level handler, which does read `oclif.exit`;
with `--json` the error is serialised instead of rethrown, and the process
exited `1` — which this table calls network / HTTP, so a consumer read a
registry error as a transient failure and retried it. `BaseCommand.catch`
(`src/base-command.ts`) now forwards `oclif.exit` to `process.exitCode`
before delegating, and `src/commands/registry/check.integration.test.ts`
pins it by spawning the CLI and comparing the code with and without the
flag. The payload still carries the code at `error.oclif.exit`.
