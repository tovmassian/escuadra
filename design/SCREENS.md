# Escuadra — screens, as they are today

This folder is the handoff surface between the Escuadra app and its Claude
Design project. **The repo is the source of truth.** This file is regenerated
from the app, not edited to describe an intention.

`tokens.ts` and `brand.ts` re-export the app's real definitions — they are not
copies. `screens/*.png` are captured from the running app by `npm run shots`.

Every screen is captured twice, once per shipped theme: the unsuffixed files
are dark, and their `-light` counterparts are the same screen in the light
palette. Dark keeps the plain filenames because it remains the app's default
identity, and because stable names let a capture be diffed against the
previous turn's.

## About the screenshots

They are **web-rendered, not device truth.** `react-native-web` is close but
not identical to iOS:

- Safe-area insets are zero on web, so top and bottom padding reads
  differently than on an iPhone.
- Font hinting and rendering differ.
- Haptics are a no-op and the splash screen does not exist.

Good enough to judge structure and hierarchy. **Not** good enough to judge
exact spacing from. Whether this fidelity is sufficient is an open assumption
being tested on this iteration.

A sibling `store/` profile captures the same screens at 1320×2868, Apple's
6.9" App Store listing size, via `npm run shots:store`. A `play/` profile
captures them again at 1080×1920 (9:16) as JPEGs, Google Play's
promotion-eligible phone screenshot size, via `npm run shots:play`. Both are
gitignored rather than committed — neither is part of this handoff surface,
just release artefacts, regenerated for each release and attached to its GitHub
Release (`docs/release.md`, Cut a release) — but the same web-rendered,
not device truth caveat above applies to them too, arguably more: a store
listing represents the real app to a prospective player more directly than a
design handoff does.

`npm run gen:play-assets` writes two more Play listing assets into `play/`
that aren't screen captures at all: `icon-512.png` (the shipped app icon
resized to Play's 512×512) and `feature-graphic.jpg` (1024×500, rendered from
the dedicated `app/store/feature-graphic.tsx` route — nothing like it exists
for iOS).

## Invariants

**Anything not on this list is open for redesign. Everything on it must
survive.** Each entry says what the behaviour is and why it exists, so a
deliberate constraint is distinguishable from an accident.

1. **Player photos fill the top of the question screen**, hotlinked from
   Wikimedia Commons, behind the shirt number. With no freely licensed photo,
   or while it loads, the team's colours and the number show. Each photo's
   credit — who to credit, licence, "cropped" — sits in muted text under the
   action button, always visible; Results and Study list every credit in a
   sheet behind "Photo credits · N".
2. **No club crests, badges, logos or shield shapes. Ever.** Trademark
   exposure. Clubs are identified by text and colour, drawn as banded
   rectangles — the same marker shape used for national flags. National
   flags are not covered by this rule — flags carry no trademark — and are
   used deliberately as the nation identity marker; the rendering is unified
   under one `TeamMarker` concept for both kinds.
3. **No text input anywhere. No keyboard.** Every answer is a tap: option cards
   and chip selectors are the entire input vocabulary. Typing player names on a
   phone is the worst possible version of this app.
4. **Never hardcode a colour, spacing value or font size** — everything comes
   from the tokens in `tokens.ts`. Team identity colour is real-world fact
   about a specific club or nation, not a design choice, and is exempt.
5. **Every animation stays under 300ms.** The app is played in fast repetitive
   bursts; slow transitions become infuriating by question six.
6. **Every part fits without scrolling at 360×640.** A scroll remains for large
   text sizes, so no option is ever out of reach.
7. **On levels 2 and 3, asking stops once a part is answered wrong.** The
   question is already lost; continuing to ask wastes the player's time.
8. **Per-part verdicts show the real result.** A part must never show a right
   verdict it did not earn: a green tile, a green slot or a check. An earlier
   version did, and it made the feedback untrustworthy, which is fatal for a
   study tool.
9. **No partial credit.** A level-2 or level-3 question is one scored unit,
   correct only when every part is right. The progress bar counts questions,
   not parts, so all three levels read 1..10.
10. **Results screen CTAs differ** by pass/fail and by whether the level
    ceiling has been reached. A fail's main button retries; a pass plays the
    next level, or at level 3 chooses a different team, with retry as an icon.
    Study this squad is always the second action, and the close button always
    chooses a different team.

## Screens

Nine routes (the results route renders two distinct states, ordinary and
flawless — see below). Route, file, and what it does.

| #   | Route                             | File                                     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`                               | `app/index.tsx`                          | Home. Centred, stacked wordmark lockup as the headline, continue-card for the last played team, Start Training. A gear at the top right opens Settings; Home has no About link, language chip or theme toggle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2   | `/about`                          | `app/about.tsx`                          | About. Legal/attribution copy, data and image credits, with a Licences row that opens the Licences page, and the privacy section (photos, usage statistics, updates). No switches and no version line: both are on Settings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | `/team-picker`                    | `app/team-picker.tsx`                    | Team picker, one scrolling page: a round back button and the squad count, `PICK YOUR SQUAD`, a search field, Clubs / Nations tabs with their counts, and league pills on Clubs and confederation pills on Nations. Clubs are a plain A–Z list under a mono caption (`ALL CLUBS · 96`); Nations are grouped under big letter headings, with the caption `ALL NATIONS · A–Z` beside the first letter and a letter rail on the right edge. A row is the marker, the name, and either `LEVEL n` over the best score (`7/10`, green at 10/10) or a chevron when not played. Above either list, `YOUR SQUADS`: the tab's starred teams in a card, newest first, whatever pill is picked, hidden while a search is typed.                           |
| 4   | `/team/[squadId]/difficulty`      | `app/team/[squadId]/difficulty.tsx`      | Difficulty. The team's bands full bleed under a veil, with back and the Your squads star (outlined, filled once starred), the flag or marker, the name, and a mono line (league or NATIONAL TEAM · season · players). THE LADDER: cleared levels compact with their best (A LA ESCUADRA at 10/10, else CLEARED), the focused level a card with the escuadra corner, its best or NOT PLAYED YET, the description and PLAY LEVEL n, locked levels with SCORE 8/10 ON Ln. A best set before the squad's last update is grey with a clock and OUTDATED (BEST n/10 · OUTDATED on the card), and a line under THE LADDER reads Squad updated … Grey scores are from before. Exam mode, SOON. Study as an outline pill, then Updated … · Wikipedia. |
| 5   | `/team/[squadId]/study`           | `app/team/[squadId]/study.tsx`           | Browsable squad: back, Hide names and a cards/list toggle; the team's banner, "Squad" and a count; position filters with counts; every player in shirt-number order as photo cards or a list. Hide names covers each name. Photo credits end the list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6   | `/play/[squadId]/[level]`         | `app/play/[squadId]/[level]/index.tsx`   | A question. The photo (or the team's colours) fills the top; the shirt number with the escuadra corner, the slot chips that spell out the player, the prompt, a grid of answers and the footer sit in the thumb zone. A right answer moves on by itself; a miss waits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7   | `/play/[squadId]/[level]/results` | `app/play/[squadId]/[level]/results.tsx` | The round's result: close (a different team), the team and level, share; the score with the escuadra corner, the tier's title and verdict, the round strip; the missed players as snapping photo cards, or a 10/10's ten in circles; the actions; the share sheet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | `/settings`                       | `app/settings.tsx`                       | Settings. Back and title, then Play (Language row opening the language sheet, Appearance as Match phone / Dark / Light, Vibration), Privacy (the usage-statistics switch), Support (Rate), Coming next (Exam mode, dashed) and About (About Escuadra, Privacy, Licences: each opens a page), over the version line.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 9   | `/licences`                       | `app/licences.tsx`                       | Licences, opened from Settings or from About's credits. Back and title, a note that the texts stay in English, then the country names' Unicode notice (open), the fonts, and every bundled package, each a tap from its full text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Captures

| File                                          | Screen                                       |
| --------------------------------------------- | -------------------------------------------- |
| `screens/01-home.png`                         | Home                                         |
| `screens/01a-about.png`                       | About                                        |
| `screens/01c-settings.png`                    | Settings                                     |
| `screens/01c-settings-end.png`                | Settings, scrolled to the end                |
| `screens/01c-settings-language.png`           | Settings — language sheet                    |
| `screens/01d-licences.png`                    | Licences                                     |
| `screens/02-team-picker-clubs.png`            | Team picker, Clubs                           |
| `screens/03-team-picker-nations.png`          | Team picker, Nations                         |
| `screens/03b-team-picker-nations-jump.png`    | Team picker, Nations, jumped to S            |
| `screens/03c-team-picker-nations-uefa.png`    | Team picker, Nations, UEFA                   |
| `screens/02b-team-picker-clubs-starred.png`   | Team picker, Clubs, with Your squads         |
| `screens/03d-team-picker-nations-starred.png` | Team picker, Nations, UEFA, with Your squads |
| `screens/04-difficulty.png`                   | Difficulty ladder, a newcomer (club)         |
| `screens/04b-difficulty-nation.png`           | Difficulty, a nation part way up, outdated   |
| `screens/04c-difficulty-cleared.png`          | Difficulty, a club with every level cleared  |
| `screens/04d-difficulty-starred.png`          | Difficulty, a starred nation                 |
| `screens/05-study.png`                        | Study, cards                                 |
| `screens/05-study-list.png`                   | Study, list                                  |
| `screens/05-study-hidden.png`                 | Study, cards with Hide names on              |
| `screens/06-question-l1.png`                  | Question, level 1                            |
| `screens/07-question-l2.png`                  | Question, level 2                            |
| `screens/08-question-l3.png`                  | Question, level 3 — club part                |
| `screens/08-question-l3-nationality.png`      | Question, level 3 — nationality part         |
| `screens/09-results.png`                      | Results — failed round                       |
| `screens/09-results-passed.png`               | Results — passed, 9/10                       |
| `screens/09-results-flawless.png`             | Results — a la escuadra, 10/10               |
| `screens/09-results-share.png`                | Results — share sheet, Image                 |
| `screens/09-results-share-text.png`           | Results — share sheet, Text                  |
| `screens/09-results-share-flawless.png`       | Results — share sheet, a la escuadra         |
| `screens/09-results-credits.png`              | Results — photo credits sheet                |

The four team picker captures are a fresh install, so no row has a score: every row
ends in a chevron. `02-team-picker-clubs.png` is Clubs with All picked: the caption
`ALL CLUBS · 96` over banded markers, A to Z by name. `03-team-picker-nations.png` is
the Nations tab at the top with the All pill picked: the `A` heading in the accent colour
with the caption `ALL NATIONS · A–Z` beside it, flags at their true shape, and the rail
beside the first heading, every letter that has a group shown and `A` accented.
`03b-team-picker-nations-jump.png` is a tap on the rail's `S`, with `S` at the top and
accented in both the heading and the rail, which has ridden up to the screen's centre.
`03c-team-picker-nations-uefa.png` is Nations with UEFA picked: the caption `UEFA · A–Z`
beside the `A`, only UEFA's nations, and a rail of only their letters.

`02b-team-picker-clubs-starred.png` and `03d-team-picker-nations-starred.png` come after
Real Madrid, Arsenal, Spain and Armenia are starred, Armenia last by a tap on its star
(`04d-difficulty-starred.png`, the star filled). Each tab shows its own two under the
starred `YOUR SQUADS` caption, in a card, newest first; on Nations UEFA is picked and
Spain and Armenia still show, as the group ignores the pills. Armenia carries its
seeded level 3 score in the card as in the list, grey under a clock and `OUTDATED`: its
scores are seeded with a date before its squad's last update (#180).
`04b-difficulty-nation.png` shows the same on Difficulty: levels 1 and 2 compact and
grey with `OUTDATED`, level 3's card reading `BEST 6/10 · OUTDATED`, and the
`Squad updated …` line under `THE LADDER`. `04c-difficulty-cleared.png` is Liverpool's
scores on its current squad, so in colour.

Question captures carry real Commons photos, each credited on screen by the
line under the footer; a capture waits for its images to load.

All four question screens share one layout, top to bottom. The photo fills the
top edge to edge, with the round's progress bar, the close button, the team's
name with its vertical banner and the level, and the score pill floating over
it. The shirt number, large, with the escuadra corner beside it, sits over the
photo's lower edge on its own ground (dark in dark, near-white in light), so it
stays legible over any photo. Under it come the slot chips, one per thing the
player must name or is told; the prompt in the display face, with a `1/2` or
`3/3` part counter on the right from level 2 up; a two-column grid of answers;
the footer, which reads "Tap your answer" until a pick; and the photo credit.

`06-question-l1.png` is captured on arrival, unanswered. The slot chips show
what level 1 gives for free (position, age, club) beside `NAME ?`, the active
slot with the accent outline; the prompt is `WHO WEARS 7?` over four name
options and has no part counter, as there is only one part.

`07-question-l2.png` is captured on arrival, unanswered, like the level-1 shot.
What differs is the slots: position is no longer given, so `POS` is a dashed,
empty slot waiting behind `NAME ?`, and the prompt carries `1/2`.

Both level-3 captures show the **third part**, the only state where the whole
question is in play at once — `NAME` and `POS` slots settled green with their
answers filled in, the last slot (`CLUB ?` or `NAT ?`) active, the counter at
`3/3`, and the last part's four options still open. They are two different
questions, not one screen twice: `squad.kind` decides what the third part asks.
`08-question-l3.png` is a **nation** squad (Spain), so it asks the player's
**club** (`WHICH CLUB?`, text options); `08-question-l3-nationality.png` is a
**club** squad (Barcelona), so it asks their **nationality**
(`NATIONALITY?`) — and only nationality options carry flag images.

The three results captures are the three tiers `resultTier` distinguishes, all
from one Spain level-1 round. `09-results.png` is a failed round, 1/10: the
corner mark is grey, the title reads `THESE ARE THE ONES TO LEARN` over
"Score 8/10 to unlock level 2.", nine red segments and one green, and
`MISSED · 9 PLAYERS` with "Swipe for all" over a row of photo cards ("You
picked Marc Cucurella"), the third cut off at the edge. Its main button is `RETRY THIS ROUND`, with
`Study this squad` beneath and no retry icon. `09-results-passed.png` is a
cleared round that still missed one player, 9/10: the strike in `accentLine` with a
green ball, `LEVEL 1 CLEARED`, one card, and `PLAY LEVEL 2` as the main button,
with the retry icon beside `Study this squad`. `09-results-flawless.png` is the
10/10 **a la escuadra** state: a green score and title, the green strike with
its trail, `ALL 10 · NOTHING MISSED` over the ten players in green-ringed
circles, and the same actions as a pass.

The first two share captures are the failed round's Results with the share
sheet open, one per format. The sheet rises from the bottom over a dimmed scrim: a
handle, `SHARE YOUR ROUND` with a close ×, an **Image / Text** switch with a
sliding pill, a preview, a hint and the share button.
`09-results-share.png` is the Image format, the default: a scaled copy of the
share picture — the team's bands across the top, the escuadra mark and
wordmark, `SPAIN · 2026 · LEVEL 1`, the score with two grey bars for a corner,
`STILL LEARNING`, ten squares carrying the shirt numbers (green filled, red
outlined) and "Can you name Spain's squad?" over the link — then the hint
"Story-sized picture. No player photos, no names — friends can still play it."
and `SHARE IMAGE`. The picture always draws in the dark palette, so it is the
same in the `-light` capture; only the sheet around it changes.
`09-results-share-text.png` is the Text format: the message as a chat bubble
(the header, the score with its ten squares, the link, and "Preview" at the
bottom right), the hint "The score grid for group chats, with a link to the
app." and `SHARE TEXT`. On web the share button does nothing.
`09-results-share-flawless.png` is the Image format after the flawless round: the
picture turns green, with a green `10/10`, the strike with its ball and trail,
`A LA ESCUADRA` and ten green squares.

`09-results-credits.png` is the passed round's Results after a tap on
`Photo credits · N`: the same sheet, titled `PHOTO CREDITS` with a close ×,
lists each photo the round showed as its shirt number and name, then the
author, the licence and "cropped", the author and the licence underlined as
links. The sheet is as tall as the list, and scrolls only past the screen's
height. Study opens the same sheet, its rows named by shirt number only.

The three Study captures are Inter Milan, a club squad, so each line under a
name is a nationality with its flag (a nation squad shows the club instead).
`05-study.png` is the default view, cards: the top bar (back, `Hide names`, the
list toggle), the team's banner and `INTER MILAN · 2026/27` over `SQUAD` and
`24 players`, the `All 24 / GK 3 / DF 8 / MF 9 / FW 4` filters, then two columns
of photo cards in shirt-number order, each with its number, a position chip and
the name over the nationality; a player with no photo shows the team's bands.
`05-study-list.png` is the same squad after one tap of the toggle, which now
shows the grid glyph: 64 pt rows of avatar, number, name over nationality and a
position chip. `05-study-hidden.png` is the cards with `Hide names` on: the
button reads `Show names` and every name is a dashed `Tap to reveal` pill. The
`Photo credits · 21` line at the end of the list, named by shirt number, is
below the fold in all three.

## Vocabulary

_Escuadra_ means the squad, and _a la escuadra_ means a shot into the top
corner of the goal — the perfect strike. A flawless round is **a la escuadra**;
use that term rather than "perfect score". The product is called **Escuadra**;
"Squad Trainer", "Squad Game" and "Squad Quiz" are stale names that predate it.
