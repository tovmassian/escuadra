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
`FC_Barcelona`). For nations it's `<Country>_national_football_team`. If the
name is ambiguous (e.g. "Milan" → AC Milan vs Internazionale), don't guess —
ask the user which club is meant.

## The two-step fetch

1. Find the squad section index:

   `https://en.wikipedia.org/w/api.php?action=parse&page=<Title>&prop=sections&format=json`

2. Fetch the raw wikitext of that section, not a summary:

   `https://en.wikipedia.org/w/index.php?title=<Title>&action=raw&section=<N>`

Reproduce/parse the result verbatim.

## Section selection

Look for the section titled **"Current squad"** in the sections response and
prefer it. If a club/nation page only has "Recent call-ups" (common for
nations between tournaments), use that section instead — note in the report
that it's a call-up list, not a contract-based roster, and record the
"as of" date from the section.

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

## Quick reference

| Field              | Club squad source                                | Nation squad source               |
| ------------------ | ------------------------------------------------ | --------------------------------- |
| Shirt number       | `no=`                                            | `no=`                             |
| Position           | `pos=`                                           | `pos=`                            |
| Player nationality | `nat=` (FIFA code)                               | implied by the page itself        |
| Current club       | n/a (it's this team)                             | `club=` / `clubnat=`              |
| Birth date         | not in template — check player's own page if new | `age={{birth date and age\|...}}` |
| Captain            | `other=captain`                                  | `other=captain`                   |

---

See `docs/superpowers/specs/2026-08-31-squad-data-factory-design.md` for the
broader squad-data-factory design. `squad-fetcher` and `squad-verifier` both
read this file for wikitext parsing rules rather than restating them.
