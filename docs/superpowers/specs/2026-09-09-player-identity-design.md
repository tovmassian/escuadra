# Player identity — the Wikipedia article title as the match key

**Status:** design, approved 2026-09-09.

**Amends `2026-09-06-squadctl-design.md` §9**, which decided the opposite:
"Match key is the normalised name, and no `wikiTitle` is stored on `Player`."
That decision is reversed here, for the reason in §3.

## 1. Problem

Two different real people can share a display name across two squads, and
`squadctl` silently collapses them into one player record.

The live case. Both rows are Brazilian defenders displayed as `Otávio`, and
Wikipedia separates them only by article title:

```
sge #5  {{Fs player|no=5|nat=BRA|pos=DF|name=[[Otávio (footballer, born November 2005)|Otávio]]}}
pfc #6  {{Fs player|no=6|nat=BRA|name=[[Otávio (footballer, born 2002)|Otávio]]|pos=DF}}
```

`data/players.json` carries one record, `otavio`. Both
`data/squads/club/bundesliga/sge.json` and
`data/squads/club/ligue-1/pfc.json` point at it. Eintracht Frankfurt applied
first and created the record; Paris FC's apply matched it globally by
normalised name and, because a club squad owns `club` and `position`, rewrote
the club. Frankfurt's squad file now disagrees with Frankfurt.

**It is not a one-off.** Two more collisions of the same shape are already
sitting in the envelope cache, waiting on an ingest:

| name            | one person                                       | the other                                     |
| --------------- | ------------------------------------------------ | --------------------------------------------- |
| `Vitinha`       | `Vitinha (footballer, born February 2000)` (psg) | `Vitinha (footballer, born March 2000)` (gen) |
| `Nico González` | `Nicolás González (footballer, born 1998)` (juv) | `Nico González (footballer, born 2002)` (new) |

Neither Genoa nor Newcastle is ingested yet, so neither has landed. Both land
the day they are.

`lib/dataIntegrity.test.ts` catches it. `squadctl` does not:

```
pfc: unchanged — 26 parsed, 0 new, 0 departed
sge: unchanged — 26 parsed, 0 new, 0 departed
apply (dry run): 0 written, 2 unchanged, 0 conflicted, 0 failed
exit=0
```

Clean run, `verified: true` on both teams. This is the failure mode the tool
exists to prevent, and it is invisible to it.

## 2. Why reconciliation cannot see it

`reconcile.ts` matches a parsed row in three ordered steps. A collision of this
shape is invisible at every one:

1. **Stored member of this squad, by normalised name.** `sge` already lists
   `otavio`, so the row matches here and no later step runs. Titles are never
   consulted.
2. **Global `players.json` lookup, by normalised name.** Exactly one hit is
   treated as a confident match. Two or more hits raise `ambiguous-name`. A
   collision only ever produces _one_ candidate until a second record exists —
   and the second record is precisely what this bug prevents from being
   created.
3. **`possible-rename`.** Only reached by a row that matched nothing, so a
   collision never arrives here.

§9 argued that cross-squad collisions "are what step 2's global lookup flags
rather than guesses at". That holds only for a collision where both people are
_already_ stored — `fran-garcia` / `fran-garcia-torres`. For a first
collision it is exactly backwards: one candidate reads as certainty, and the
merge is written without a word.

## 3. Why the title, and why on `Player`

The discriminator already exists in the pipeline and is thrown away.
`wikitext-parse.ts` reads the wikilink target into `EnvelopeMember.title`,
`validateEnvelope` keys its duplicate check on name-plus-title, every envelope
on disk carries it — and `reconcile.ts` never reads the field. A Wikipedia
article title is unique per person by construction. It is the identity key,
and the tool is matching on the one field these two people share instead.

§9 kept it out of `Player` because within-squad collisions are separated by
position, then club, then shirt number, and cross-squad collisions were
assumed to surface at step 2. The first half still holds. The second does not,
and no discriminator on the row can rescue it: the two Otávios share
nationality, position, and squad-mate context. Only identity separates them,
and identity has to be _stored_ to be compared across two runs of two
different teams.

Rejected alternative: a `data/identities.json` sidecar read only by
`squadctl`, keeping the app's data model untouched. Rejected because it is a
second file to keep in sync with no reader positioned to catch drift, and
because the source article genuinely is a fact about the player, not about the
tool.

`Player` gains:

```ts
/** Wikipedia article title this record was created from — unique per person
 *  by construction, where a display name is not. Null when unknown: a record
 *  predating this field, or a row the source lists as plain text with no
 *  article. */
wikiTitle: string | null;
```

Null is permanent and normal, not merely transitional: 169 of the 6,657 rows
across the current envelope cache (~2.5%) carry no wikilink at all.

## 4. The matching rule

Three rules, applied at **both** match points — step 1 (stored member of this
squad) and step 2 (global lookup). Fixing only step 2 would leave the live case
untouched, because it matches at step 1.

1. **An equivalent title is decisive**, whatever the names say — equivalent,
   not byte-equal; see below. This also strengthens `name-variant`: `Ødegaard`
   and `Odegaard` match on identity rather than on letter-folding.
2. **A name match whose titles are inequivalent is not a match.** Both sides
   carry a title and they do not relate: hold the row and raise
   `title-mismatch`.
3. **Null on either side falls back to today's behaviour** — normalised-name
   matching, unchanged. A name match against a stored `wikiTitle: null`
   back-fills it from the row.

Rule 3's back-fill is the migration (§7) and also what surfaces the live case:
whichever of `pfc` / `sge` applies first claims the title, and the other
conflicts on the same run.

**Wikipedia moves articles**, so a title mismatch can never auto-create a
record. A moved article and a second person are indistinguishable from the
data, and creating first is the unrecoverable direction — the same reasoning
that makes `possible-rename` hold rather than write.

### Titles are compared by equivalence, not equality

An article can be linked through a redirect, so **one person legitimately has
more than one link target** and byte-equality would flag them as two people.
Across the 2,479 distinct normalised names in the envelope cache, six carry
more than one title. Two of those six are one person under two targets, and
both are club-against-nation:

| record        | club article links                          | nation article links                        |
| ------------- | ------------------------------------------- | ------------------------------------------- |
| `endrick`     | `Endrick` (rma)                             | `Endrick (footballer, born 2006)` (bra)     |
| `eric-garcia` | `Eric Garcia (footballer, born 2001)` (bar) | `Eric García (footballer, born 2001)` (esp) |

Both are correctly merged today. Under byte-equality both would break on the
first nation sweep. Two equivalences, each cheap and local — no network
request, so `--offline` is unaffected:

**A. Base title.** One title equals the other with its parenthetical
disambiguator stripped: `Endrick` ≡ `Endrick (footballer, born 2006)`. A link
to the undisambiguated redirect. **Guarded**: it resolves only when exactly one
stored candidate matches that base. A bare `[[Otávio]]` against two stored
Otávios is `ambiguous-name`, never a coin flip.

**B. Normalised title.** `normalizeName` equality across the whole title:
`Eric Garcia (footballer, born 2001)` ≡ `Eric García (footballer, born 2001)`.

**Not `isTransliterationVariant`.** The obvious candidate is wrong, verified
against the real pairs: it requires the NFD fold itself to differ, so it fires
only on `ø đ ð ł æ œ ß þ ı ŋ ħ` and returns `false` for the Eric García pair.
Plain `normalizeName` equality is the predicate.

Both equivalences leave every true collision intact, which is the property
that matters. `Otávio (footballer, born November 2005)` and `Otávio
(footballer, born 2002)` share a base but differ in disambiguator; `Ederson
(footballer, born 1993)` and `Éderson (footballer, born 1999)` normalise apart
on the year. Verified on all six cases: two resolve silently, four conflict.

### Nation squads make identity stronger, not weaker

A player in both a club and a nation squad has two sources, and the concern is
that they disagree. In practice the _title_ is the field they agree on even
when the display name is not: Juventus renders `Nico González` and Argentina
renders `Nicolás González`, and both link `Nicolás González (footballer, born
1998)`. Normalised-name matching cannot join those two rows at all. Title
matching joins them, and in the same step keeps them apart from Newcastle's
different `Nico González (footballer, born 2002)`.

The residue is a pair like `grimaldo`, linked `Alejandro Grimaldo` from
Atlético and `Álex Grimaldo` from Spain: one person, two targets related by
neither equivalence. That is the same situation the `alias` decision already
exists for, one level up — see §6.

## 5. The `title-mismatch` conflict

```ts
| { kind: 'title-mismatch'; playerId: string; storedTitle: string;
    sourceTitle: string; rowName: string }
```

Hold semantics identical to `possible-rename`: the stored record keeps the
squad slot and takes the row's shirt number, nothing is created, the team is
written with `verified: false`, and the run exits `4`.

`describeConflict` / `conflictCommand` render all three answers, as
`possible-rename` already does for its three — and they are the same three,
one level up. "Both titles are his" is no more expressible as either of the
others than "both names are his" was:

```
sge: conflicted (verified: false)
     conflict: identity conflict on otavio — stored "Otávio (footballer, born 2002)",
               source lists "Otávio (footballer, born November 2005)"
     fix:      same person, article moved:  npm run squadctl -- retitle otavio "Otávio (footballer, born November 2005)"
               same person, both titles:    npm run squadctl -- alias otavio --title "Otávio (footballer, born November 2005)"
               two different people:        npm run squadctl -- fork otavio "Otávio (footballer, born November 2005)"
```

## 6. The three commands

`retitle` and `fork` write `data/players.json` through a pure lib function,
the way `rename` does. `alias --title` writes `data/decisions.json`, the way
`alias` already does for names.

**`decisions.json` is not involved in the first two.** Its header states it
exists for decisions squadctl cannot re-derive. These two it can: once each
record carries its own title, every future sweep re-derives the answer for
free. A decision entry here would be dead weight from the moment it was
written.

The one title fact that is _not_ re-derivable is a redirect (§4), because
resolving one needs a network request this tool will not make. That fact does
belong in `decisions.json`, and it goes there through `alias`.

### `retitle <playerId> "<title>"`

Same person, article moved. Sets `wikiTitle`. Never touches `name`, never
touches `id`.

### `fork <playerId> "<title>"`

Two different people. Writes a second record under a fresh id from the existing
`playerId()` helper (`otavio` taken → `otavio-2`; ids are not user-facing),
carrying the given title and copying `name`, `fullName` and `position` from the
original.

**`birth`, `club` and `nationality` are deliberately not copied.** `birth`
belongs to the original person, and a wrong birth date on a duplicate record is
the exact damage the `possible-rename` hold exists to prevent. `club` and
`nationality` are left null/empty because the next `apply` fills them from the
row under the existing field-ownership rules. `position` is copied only because
`Player.position` admits no null; a club squad's apply overwrites it from the
row on the next pass.

### `alias <playerId> --title "<title>"`

Same person, two unrelated link targets — the `grimaldo` case. Records the
extra title in `decisions.json` under a `titleAliases` array, parallel to the
existing `aliases`.

This mirrors the split the repo already makes for names, deliberately: the
canonical name lives on `Player`, the alternatives one source insists on live
in `decisions.json`. Titles now follow the same rule, so there is one mental
model rather than two. `alias` keeps its meaning unchanged — another thing this
player is known by — and gains a second dimension rather than a second command.

Reconciliation reads a player's titles the way it already reads their names:
`wikiTitle` plus every recorded title alias, and an equivalence against any of
them is decisive.

`titleAliases` is optional exactly as `aliases` is, and for the same reason —
every existing decision file predates it. `validateDecisions` gains a case.

## 7. Migration

No migration script and no big-bang rewrite. Every command that reads
`players.json` normalises `wikiTitle: p.wikiTitle ?? null` on the way in, so
the first write stamps an explicit null onto all 1,695 records, and rule 3's
back-fill replaces them with real titles as sweeps match rows. A team never
fetched again keeps nulls and behaves exactly as it does today.

That normalisation needs one home. `apply` and `rename` each read the file
with their own `JSON.parse(readFileSync(...))` today, and `retitle` and `fork`
would make four copies of the same read — one of which forgetting to normalise
is a silent bug. A shared `readPlayers(dataDir)` / `writePlayers(dataDir,
players)` pair in `src/lib/` absorbs the read, the normalisation and the
sort-by-id that all four then share. Scoped to that: no other refactoring of
these commands.

Bundle cost is roughly 50 KB across 1,695 records, on an app that makes no
network calls.

## 8. Testing

- `reconcile.test.ts`: a title match wins over a conflicting name; inequivalent
  titles hold the row and raise `title-mismatch`; a null stored title
  back-fills from the row; a row with no title behaves exactly as today; a
  recorded title alias matches.
- A title-equivalence table driven by all six real multi-title cases from the
  envelope cache — `endrick` and `eric-garcia` resolve, `otavio`, `vitinha`,
  `ederson` and `nico gonzalez` conflict. This is the test that fails if
  someone reaches for `isTransliterationVariant` again.
- Base-title equivalence is guarded: a bare `[[Otávio]]` against two stored
  Otávios raises `ambiguous-name` rather than resolving to either.
- A pure-function test file for `retitle` and `fork` alongside
  `rename.test.ts`, including that `fork` does not copy `birth`.
- `players-file.test.ts`: a record with no `wikiTitle` reads back as null, and
  a round-trip through read/write is stable.
- A reconcile fixture built from the real `pfc` / `sge` pair, as a regression
  against this exact collision.
- `lib/dataIntegrity.test.ts` is unchanged and stays as the repo-level
  backstop: `apply` and `npm run check` then assert the same invariant from
  two directions.

## 9. Changes to existing files

| file                                     | change                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `types/squad.ts`                         | `Player.wikiTitle: string \| null`                                      |
| `scripts/roster-envelope.ts`             | title-equivalence helpers, shared with the skill path                   |
| `tools/squadctl/src/lib/reconcile.ts`    | title-aware matching at steps 1 and 2; header comment is now false      |
| `tools/squadctl/src/lib/assertions.ts`   | `title-mismatch` kind, `describeConflict`, `conflictCommand`            |
| `tools/squadctl/src/lib/rename.ts`       | sibling pure functions for retitle and fork                             |
| `tools/squadctl/src/lib/decisions.ts`    | optional `titleAliases` array; `validateDecisions` case                 |
| `tools/squadctl/src/lib/players-file.ts` | new — shared `readPlayers` / `writePlayers`, normalising `wikiTitle`    |
| `tools/squadctl/src/commands/`           | `retitle.ts`, `fork.ts`                                                 |
| `tools/squadctl/src/commands/alias.ts`   | `--title` flag, writing `titleAliases`                                  |
| `tools/squadctl/src/commands/apply.ts`   | read and write `players.json` through the shared pair                   |
| `tools/squadctl/src/commands/rename.ts`  | same, replacing its own hand-rolled read/write                          |
| `tools/squadctl/README.md`               | `title-mismatch` handover section; the three commands; both file tables |
| `CLAUDE.md`                              | `data/players.json` field list gains `wikiTitle`                        |
| `data/decisions.json`                    | remove the inert `pfc` / `otavio` split entry (§10)                     |

## 10. Resolving the live case

The recorded split `{ team: pfc, departed: otavio, arrived: ... }` never fires:
`splitAccepted` is consulted only inside step 3, which a matched row never
reaches. It asserts something false about a pair it can never be asked about,
and is removed by hand as part of this change rather than growing an `unsplit`
command for a one-off.

Then, with the cache already warm and therefore at zero network cost:

```bash
npm run squadctl -- fetch --offline --only pfc,sge --out <dir>
npm run squadctl -- apply <dir>          # back-fills one title, conflicts on the other
npm run squadctl -- fork otavio "Otávio (footballer, born November 2005)"
npm run squadctl -- apply <dir>
```

End state: `pfc` keeps `otavio` (club Paris FC), `sge` points at `otavio-2`
(club Eintracht Frankfurt), both records carry their own title, and neither
team conflicts again.

## 11. Out of scope

- **Back-filling titles by fetching.** Titles arrive through normal sweeps.
  No per-player article request is made, then or ever.
- **Resolving redirects over the network.** The API would answer the redirect
  question exactly, at a request per link, and it would break `--offline`. The
  two local equivalences plus `alias --title` cover every observed case.
- **Merging two player records.** The inverse of `fork`. squadctl has never
  merged records and still does not; §"What squadctl will never do for you"
  stands.
- **An `unsplit` command.** One dead entry does not justify a command.
- **Using `wikiTitle` in the app.** It is data-layer identity only. No screen
  reads it, and it is not a quiz answer.
