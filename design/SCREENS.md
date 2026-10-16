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
just release artefacts regenerated on demand — but the same web-rendered,
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

Seven routes (the results route renders two distinct states, ordinary and
flawless — see below). Route, file, and what it does.

| #   | Route                             | File                                     | Purpose                                                                                                                                                                                                                                                                  |
| --- | --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `/`                               | `app/index.tsx`                          | Home. Centred, stacked wordmark lockup as the headline, continue-card for the last played team, Start Training.                                                                                                                                                          |
| 2   | `/about`                          | `app/about.tsx`                          | About. Legal/attribution copy, data and image credits, the privacy section (photos, usage statistics, updates), and the running update line.                                                                                                                             |
| 3   | `/team-picker`                    | `app/team-picker.tsx`                    | Team picker, segmented into Clubs and National Teams. Each row shows a mono sub-line — `LEVEL n · BEST n/10` or `NOT PLAYED`, green once cleared.                                                                                                                        |
| 4   | `/team/[squadId]/difficulty`      | `app/team/[squadId]/difficulty.tsx`      | The difficulty ladder in level order: the focused level expanded into a card with its description and a Play button, the other levels compact (locked ones stating their unlock condition), and Study, an outline button until level 1 is cleared and a text link after. |
| 5   | `/team/[squadId]/study`           | `app/team/[squadId]/study.tsx`           | Browsable squad: back, Hide names and a cards/list toggle; the team's banner, "Squad" and a count; position filters with counts; every player in shirt-number order as photo cards or a list. Hide names covers each name. Photo credits end the list.                   |
| 6   | `/play/[squadId]/[level]`         | `app/play/[squadId]/[level]/index.tsx`   | A question. The photo (or the team's colours) fills the top; the shirt number with the escuadra corner, the slot chips that spell out the player, the prompt, a grid of answers and the footer sit in the thumb zone. A right answer moves on by itself; a miss waits.   |
| 7   | `/play/[squadId]/[level]/results` | `app/play/[squadId]/[level]/results.tsx` | The round's result: close (a different team), the team and level, share; the score with the escuadra corner, the tier's title and verdict, the round strip; the missed players as snapping photo cards, or a 10/10's ten in circles; the actions; the share sheet.       |

## Captures

| File                                     | Screen                               |
| ---------------------------------------- | ------------------------------------ |
| `screens/01-home.png`                    | Home                                 |
| `screens/01a-about.png`                  | About                                |
| `screens/02-team-picker-clubs.png`       | Team picker, Clubs                   |
| `screens/03-team-picker-nations.png`     | Team picker, National Teams          |
| `screens/04-difficulty.png`              | Difficulty ladder                    |
| `screens/05-study.png`                   | Study, cards                         |
| `screens/05-study-list.png`              | Study, list                          |
| `screens/05-study-hidden.png`            | Study, cards with Hide names on      |
| `screens/06-question-l1.png`             | Question, level 1                    |
| `screens/07-question-l2.png`             | Question, level 2                    |
| `screens/08-question-l3.png`             | Question, level 3 — club part        |
| `screens/08-question-l3-nationality.png` | Question, level 3 — nationality part |
| `screens/09-results.png`                 | Results — failed round               |
| `screens/09-results-passed.png`          | Results — passed, 9/10               |
| `screens/09-results-flawless.png`        | Results — a la escuadra, 10/10       |
| `screens/09-results-share.png`           | Results — share sheet, Image         |
| `screens/09-results-share-text.png`      | Results — share sheet, Text          |
| `screens/09-results-share-flawless.png`  | Results — share sheet, a la escuadra |
| `screens/09-results-credits.png`         | Results — photo credits sheet        |

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
from one Spain level-1 round. `09-results.png` is a failed round, 2/10: the
corner is two grey bars, the title reads `THESE ARE THE ONES TO LEARN` over
"Score 8/10 to unlock level 2.", eight red segments, and `MISSED · 8 PLAYERS`
with "Swipe for all" over a row of photo cards ("You picked Gavi"), the third
cut off at the edge. Its main button is `RETRY THIS ROUND`, with
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
