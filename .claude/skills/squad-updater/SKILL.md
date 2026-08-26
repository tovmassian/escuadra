---
name: squad-updater
context: fork
description: Use when creating or refreshing an Escuadra squad file (data/squads/<id>.json) from Wikipedia — adding a new club/national team or syncing an existing one's roster, shirt numbers, or players.json entries. Accepts one or more team names and repeats the procedure for each, sequentially.
---

# Squad Updater

## Overview

Given a team name (club or nation), fetch that team's current squad from
Wikipedia and create or update the matching files in `data/`: the squad file,
`data/players.json`, and `data/index.json`. Multiple team names are handled by
running this same procedure once per team, **in sequence** — never in
parallel, since every team writes to the same two shared files
(`players.json`, `index.json`) and parallel writes would clobber each other.

## Critical rule: never trust prose extraction of the roster table

Asking a fetch tool to "list the players" runs the raw page through a small
summarizing model first. On a plain narrative page that's fine; on a squad
table it is not — number/position/name are exactly the kind of tabular detail
a summarizer paraphrases, drops, or reorders without any signal that it did.
**Always pull the raw wikitext of the squad section and parse the template
lines yourself.** Never key match logic off a model's prose summary of a
roster.

## Procedure (per team)

1. **Resolve the Wikipedia page title.** For clubs this is usually
   `<Club_Name>` (e.g. `Inter_Milan`, `FC_Barcelona`). For nations it's
   `<Country>_national_football_team`. If the name is ambiguous (e.g. "Milan"
   → AC Milan vs Internazionale), don't guess — ask the user which club is
   meant.

2. **Find the squad section index.** Fetch
   `https://en.wikipedia.org/w/api.php?action=parse&page=<Title>&prop=sections&format=json`
   and find the section titled **"Current squad"**. If a club/nation page
   only has "Recent call-ups" (common for nations between tournaments), use
   that section instead — note in your report that it's a call-up list, not a
   contract-based roster, and record the "as of" date from the section.

3. **Fetch the raw wikitext of that section**, not a summary:
   `https://en.wikipedia.org/w/index.php?title=<Title>&action=raw&section=<N>`.
   Reproduce/parse it verbatim. Two template families appear:

   - Club squads: `{{Fs player|no=1|nat=ESP|pos=GK|name=[[Josep Martínez]]}}`
     — `nat` is a 3-letter FIFA code for the player's nationality.
   - National squads: `{{nat fs g player|no=1|pos=GK|name=[[David Raya]]|age={{birth date and age|df=y|1995|9|15}}|caps=14|goals=0|club=[[Arsenal F.C.|Arsenal]]|clubnat=ENG}}`
     — no `nat` field (the whole page is one nationality); `club`/`clubnat`
     give the player's current club instead; `age` embeds an exact birth date.

   `other=[[Captain (association football)|captain]]` marks the captain —
   this is the only flag the data model tracks (`captain: true`); ignore
   vice-captain, there's no field for it.

4. **Parse each row**: shirt number (`no`), position (`pos`, already one of
   GK/DF/MF/FW — use as-is, don't second-guess), display name (text after the
   `|` inside `[[...]]`, or the link target if there's no `|`), captain flag,
   and — for national squads only — `club`, `clubnat`, and birth date from
   `age`. If a row has no `no=` value (happens for uncapped/fringe call-ups),
   drop that player from `members` — a membership without a shirt number
   can't be quizzed, and `no` is required by the data model.

5. **Determine the squad id.** If updating an existing team, reuse its id
   from `data/index.json`. For a new team, invent a short lowercase id
   following the existing convention (`ars`, `rma`, `int`, `bra`, `arg` —
   3-4 letters, unique in the manifest).

6. **Determine real identity colours.** `primaryColor`/`secondaryColor` are
   the team's actual brand colours in hex — pull them from the Wikipedia
   infobox (`clubColors`/`pattern` params) or another reliable source. Never
   invent or reuse another team's colours. If the team already exists in
   `data/index.json` with correct colours, leave them unchanged.

7. **Reconcile players against `data/players.json`** — this file is shared
   across every squad, so a player already in it (e.g. a club player who's
   also on a national roster) must not be duplicated. Do this for **every**
   member of the squad you just parsed, not only the ones that look new to
   you — an existing player's `club` can be stale from a prior session even
   if nothing about _this_ team's fetch changed for them:
   - Match by name (case-insensitive, ignoring diacritics) against existing
     entries first.
   - If found, reuse its `id` and update whichever fields changed (`club`,
     `position`, `nationality`) — never touch `photo` (always stays `null`,
     hard constraint: no photos in v0).
   - If not found, create a new entry. Id is normally a kebab-case surname;
     when a player is overwhelmingly known by first name (existing examples:
     `lautaro`, `pio-esposito`) or a surname collides with an existing id,
     disambiguate the same way the existing data does — check what the rest
     of `players.json` already does before inventing a new pattern.
   - `nationality`: the FIFA `nat` code (club squads) mapped to the country
     name, or the squad's own country (national squads — every member shares
     it, that's _why_ level-3 nation questions ask for club instead).
   - `birth`: use the exact date from `age={{birth date and age|...}}` when
     present (national squad pages carry this). Club squad templates don't
     carry it — if the player is new to `players.json`, fetch their date of
     birth from their own Wikipedia infobox rather than leaving it blank.

8. **Write `data/squads/<id>.json`**, matching the existing shape exactly:
   `id, kind, name, season, primaryColor, secondaryColor, verified, marker,
lastUpdated, source, members`.
   `members` is `[{ playerId, no, captain? }]` — shirt number lives on the
   membership, never on the player.

   - `lastUpdated` — ISO date (`YYYY-MM-DD`) you're writing this file, i.e.
     today, not the "as of" date the Wikipedia section itself claims (that
     one still goes in your step-12 report, since it can predate today by
     weeks).
   - `source` — the exact Wikipedia article URL you fetched, e.g.
     `https://en.wikipedia.org/wiki/Argentina_national_football_team`. Set
     both fields on every write, new squad or refresh — a refresh always
     overwrites the old `lastUpdated`/`source` with the current ones, the
     same way it always resets `verified` to `false`.

   - `marker` — **required on every squad**, club or nation alike; it's the
     team's sole visual identity element, since crests/badges/shields are
     never used. Declarative band geometry, not an asset and not an emoji:
     `{ bands: string[], orientation: 'horizontal' | 'vertical',
weights?: number[], overlay?: { shape: 'disc' | 'diamond', color: string } }`.
     Bands run top-to-bottom for `horizontal`, left-to-right for `vertical`.
     Omit `weights` for equal bands.
     - **Nation squads**: the marker _is_ the national flag. National
       emblems and coats of arms are omitted by design — use the plain
       field. `overlay` is for a centred device on a flag (Japan's disc,
       Brazil's diamond) — clubs never carry one.
     - **Club squads**: the marker is the club's own colours as bands —
       never an emblem, per the "no crests, ever" constraint. A
       single-colour club (e.g. Arsenal, Real Madrid) gets a one-entry
       `bands` array, not a two-tone split; don't manufacture a second
       band from a trim colour that isn't a real second identity colour.
       The same object must be copied into the matching `data/index.json`
       entry; `lib/squads.test.ts` compares them. Hand-check marker colours
       against a real source rather than generating them.

9. **Set `verified: false`.** Always — for a brand-new squad and for one
   you're overwriting, even if it was previously `true`. Scraping + LLM
   parsing is not the "real source check" the data model requires before
   that flag can be `true`; say so explicitly in your report if you're
   downgrading a previously-verified squad, so the user can decide whether to
   re-verify.

10. **Update `data/index.json`** — add a new manifest entry, or update the
    existing one's `season`/colours in step with the squad file. Keep it in
    sync; the picker reads this file only, never the full squad JSON.

10a. **If this is a brand-new squad** (no prior entry in `data/index.json`),
it also needs wiring into `lib/squads.ts`: add a static `import` for the
new `data/squads/<id>.json` and a matching entry in `SQUAD_FILES`. Metro
requires string-literal imports, so this can't be done dynamically — the
file's own header comment says as much. Skipping this step doesn't error
at write time; it silently makes `getRoster()` return an empty array for
the new squad, which only surfaces later as failing
`lib/squads.test.ts` assertions. Do it in the same pass as writing the
squad file, not as a follow-up fix.

11. **Run `npm run check`** before reporting the team done, and report its
    actual output. On Windows, `node`/`npm` may not be on the shell's PATH by
    default — if a bare `npm` call fails, locate `node.exe`'s directory
    (commonly `C:\Program Files\nodejs`) and prepend it to `PATH` for that
    command rather than trying alternate invocations one at a time.

12. **Report per team**: players added, removed, or moved club; number
    changes; the captain; the "as of" date Wikipedia lists for the section
    you used; and the `source` URL and `lastUpdated` date you wrote.

## Quick reference

| Field              | Club squad source                                | Nation squad source               |
| ------------------ | ------------------------------------------------ | --------------------------------- |
| Shirt number       | `no=`                                            | `no=`                             |
| Position           | `pos=`                                           | `pos=`                            |
| Player nationality | `nat=` (FIFA code)                               | implied by the page itself        |
| Current club       | n/a (it's this team)                             | `club=` / `clubnat=`              |
| Birth date         | not in template — check player's own page if new | `age={{birth date and age\|...}}` |
| Captain            | `other=captain`                                  | `other=captain`                   |

## Common mistakes

- Treating a WebFetch prose summary of the roster as ground truth instead of
  parsing raw wikitext — silently wrong numbers/names slip through this way.
  Fetch the sections/raw-wikitext URLs directly (`curl`/HTTP GET) rather than
  through a fetch tool that summarizes through a model — WebFetch always
  does this, so it's the wrong tool for this step regardless of prompt.
- Writing a brand-new squad's JSON file without also wiring it into
  `lib/squads.ts` (step 10a) — the write succeeds silently; only the test
  suite catches the omission.
- Running multiple teams' updates in parallel — they share
  `players.json`/`index.json` and will race.
- Duplicating a player in `players.json` instead of matching an existing
  entry by name.
- Inventing or rotating team colours instead of pulling the real ones.
- Setting `verified: true`, or leaving a stale `true` in place, after a
  scrape — this skill's output is never auto-verified.
- Populating `photo` — it stays `null` in v0 regardless of what Wikipedia has.
- For a national team, grabbing an old/cached call-up list instead of the
  most recent "Current squad"/"Recent call-ups" section.
- Leaving `lastUpdated`/`source` stale on a refresh — both get overwritten
  with the current date and the URL you actually fetched, every time.
