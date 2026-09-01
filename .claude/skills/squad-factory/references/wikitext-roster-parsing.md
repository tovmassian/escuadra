# Wikitext roster parsing

Shared reference for parsing an Escuadra squad's roster out of Wikipedia.
Both `squad-fetcher` and `squad-verifier` read this file rather than
restating these rules — port any correction here, not into either skill.

## Never trust prose extraction of the roster table

Asking a fetch tool to "list the players" runs the raw page through a small
summarizing model first. On a plain narrative page that's fine; on a squad
table it is not — number/position/name are exactly the kind of tabular
detail a summarizer paraphrases, drops, or reorders without any signal that
it did. **Always pull the raw wikitext of the squad section and parse the
template lines yourself.** Never key match logic off a model's prose summary
of a roster. Fetch the sections/raw-wikitext URLs directly (`curl`/HTTP GET)
rather than through a fetch tool that summarizes through a model — WebFetch
always does this, so it's the wrong tool for this step regardless of
prompt.

## Page title resolution

For clubs the page title is usually `<Club_Name>` (e.g. `Inter_Milan`,
`FC_Barcelona`). For nations it's `<Country>_national_football_team`.

If the name is ambiguous (e.g. "Milan" → AC Milan vs Internazionale), don't
guess — and don't ask. Both skills that read this file are dispatched as
parallel subagents with no operator to prompt, so a question here either
hangs the run or gets answered by the agent asking it. Return status
`NEEDS_DECISION` instead, naming **every** candidate with enough detail to
tell them apart (page URL, league, or an existing squad id), and write no
envelope file. See `squad-fetcher`'s no-questions rule for the exact return
line; `squad-verifier` fetches a stored `source` URL and so rarely reaches
this, but it is dispatched the same way and is under the same constraint.

## The two-step fetch

1. Find the squad section index:

   `https://en.wikipedia.org/w/api.php?action=parse&page=<Title>&prop=sections&format=json`

2. Fetch the raw wikitext of that section, not a summary:

   `https://en.wikipedia.org/w/index.php?title=<Title>&action=raw&section=<N>`

Reproduce/parse the result verbatim.

## Section selection

No single title is used by every article. Scan the sections response and
take the **first** match in this priority order:

1. `Current squad`
2. `First-team squad`
3. `First team squad`
4. `Players`
5. `Recent call-ups`

Record whichever title matched in `team.sectionTitle`, spelled exactly as
the sections response prints it.

Nation and club pages tend to differ in which title they use. A national
team article usually has `Current squad`, and between tournaments sometimes
only `Recent call-ups`. English club articles frequently have neither:
Arsenal's section list runs `Players | First-team squad | Out on loan`,
which matches at priority 2. That is an ordinary club page, not a broken
one.

`Recent call-ups` is a call-up list, not a contract-based roster. When it is
the section that matched, note that in the report, add a `warnings[]` entry,
and record the "as of" date the section states.

**`SOURCE_BROKEN` is reserved for a page with no roster section at all** —
along with a page that 404s or has moved. A page carrying any of the five
titles above is parseable; falling further down the list is normal
operation, not a failure.

## The two template families

Two template families appear in the raw wikitext:

- Club squads: `{{Fs player|no=1|nat=ESP|pos=GK|name=[[Josep Martínez]]}}`
  — `nat` is a 3-letter FIFA code for the player's nationality.
- National squads: `{{nat fs g player|no=1|pos=GK|name=[[David Raya]]|age={{birth date and age|df=y|1995|9|15}}|caps=14|goals=0|club=[[Arsenal F.C.|Arsenal]]|clubnat=ENG}}`
  — no `nat` field (the whole page is one nationality); `club`/`clubnat` give
  the player's current club instead; `age` embeds an exact birth date.

`other=[[Captain (association football)|captain]]` marks the captain — this
is the only flag the data model tracks (`captain: true`); ignore
vice-captain, there's no field for it.

## Field extraction

Parse each row for: shirt number (`no`), position (`pos`, already one of
GK/DF/MF/FW — use as-is, don't second-guess), display name (text after the
`|` inside `[[...]]`, or the link target if there's no `|`), captain flag,
and — for national squads only — `club`, `clubnat`, and birth date from
`age`.

## The drop rule

If a row has no `no=` value (happens for uncapped/fringe call-ups), drop
that player from `members` — a membership without a shirt number can't be
quizzed, and `no` is required by the data model.

## Field population — what the wikitext doesn't carry

Three envelope fields are not simply read off a template line; each is the
reader's job to settle. `squad-writer` copies the envelope's fields verbatim
into a player record and derives nothing of its own, so this is the only
place these values ever get resolved. Skip one and the writer either stores
a raw FIFA code as a player's nationality, leaves a required field empty, or
has to break its own no-derivation contract to compensate.

All three apply to **both** readers. Nothing about them is intake-specific:
a `squad-verifier` envelope feeds the same writer and must carry the same
fields.

### The nationality rule

`EnvelopeMember.nationality` must be a full country name, in the same form
`data/players.json` already stores throughout (`Spain`, not `ESP`).

- **Club squads**: translate the wikitext's `nat=` FIFA code into the
  country's full name. Match the spelling already used elsewhere in
  `data/players.json` rather than inventing a new one.
- **Nation squads**: the wikitext carries no per-member nationality field —
  the whole page is one nationality — so set every member's `nationality`
  to the squad's own country. That every member shares one nationality is
  exactly why the level-3 question on a nation squad asks for the player's
  club instead.

### The club rule

`EnvelopeMember.club` must be the player's current club, in the same form
`data/players.json` already stores throughout (`Arsenal`, not
`Arsenal F.C.`).

- **Nation squads**: the wikitext supplies each member's own `club=` field
  directly — parse it per Field extraction, same as any other wikilinked
  field. A national squad is drawn from many different clubs, so this is
  genuine per-member data.
- **Club squads**: the wikitext carries no per-member club field — everyone
  on the page is the same club — so set every member's `club` to the
  squad's own team name (`team.name` on the envelope). This is the exact
  mirror of the nationality rule with the two kinds swapped: on a club
  squad every member shares one club and nationality varies per player; on
  a nation squad it is the reverse.

### The birth rule

`Player.birth` is a **required, non-optional** field of the stored player
record (`types/squad.ts`). Nothing downstream can invent it, and nothing
downstream catches its absence.

- **Nation squads**: `age={{birth date and age|df=y|YYYY|M|D}}` carries the
  exact date — parse it into `birth` as `YYYY-MM-DD`.
- **Club squads**: `{{Fs player}}` carries no birth date at all. Look each
  member up in `data/players.json` by normalised name. **If the player is
  new there, fetch their date of birth from their own Wikipedia article's
  infobox** rather than leaving `birth` blank — a new player record cannot
  be written without one.

  When the player _is_ already stored, carrying `birth` through anyway is
  the better default rather than a formality: a name-only match on a club
  squad is precisely what `squad-writer` must treat as ambiguous, since two
  real people sharing a name must never be merged into one record. A birth
  date on the envelope is what lets the writer match confidently instead of
  deferring the whole team for an operator decision.

## Quick reference

| Field              | Club squad wikitext | Nation squad wikitext             |
| ------------------ | ------------------- | --------------------------------- |
| Shirt number       | `no=`               | `no=`                             |
| Position           | `pos=`              | `pos=`                            |
| Player nationality | `nat=` (FIFA code)  | not in the template               |
| Current club       | not in the template | `club=` / `clubnat=`              |
| Birth date         | not in the template | `age={{birth date and age\|...}}` |
| Captain            | `other=captain`     | `other=captain`                   |

**This table describes the _wikitext_, not the envelope.** "Not in the
template" means the reader derives the value per Field population above; it
never means the field is absent from the envelope. Every envelope member
carries `nationality` and `club` whatever the squad's kind, and `birth`
whenever the birth rule calls for it. Nor is `nationality` ever the raw
`nat=` code — the code is what the page prints, the full country name is
what the envelope carries.

---

See `docs/superpowers/specs/2026-08-31-squad-data-factory-design.md` for the
broader squad-data-factory design. `squad-fetcher` and `squad-verifier` both
read this file for wikitext parsing rules rather than restating them.
