# Escuadra — screens, as they are today

This folder is the handoff surface between the Escuadra app and its Claude
Design project. **The repo is the source of truth.** This file is regenerated
from the app, not edited to describe an intention.

`tokens.ts` and `brand.ts` re-export the app's real definitions — they are not
copies. `screens/*.png` are captured from the running app by `npm run shots`.

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

## Invariants

**Anything not on this list is open for redesign. Everything on it must
survive.** Each entry says what the behaviour is and why it exists, so a
deliberate constraint is distinguishable from an accident.

1. **No player photographs in v0** — but photos become the primary element in
   v1, so the question screen keeps a hero slot that a square portrait can drop
   into without a redesign. It currently holds a large shirt number.
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
6. **Question parts must stay scrollable.** Without it, later parts on levels 2
   and 3 became physically unreachable on a phone.
7. **On levels 2 and 3, asking stops once a part is answered wrong.** The
   question is already lost; continuing to ask wastes the player's time.
8. **Per-part verdicts show the real result.** A part must never show a green
   check it did not earn — an earlier version did, and it made the feedback
   untrustworthy, which is fatal for a study tool.
9. **No partial credit.** A level-2 or level-3 question is one scored unit,
   correct only when every part is right. The progress bar counts questions,
   not parts, so all three levels read 1..10.
10. **Results screen CTAs differ** by pass/fail and by whether the level
    ceiling has been reached.

## Screens

Six routes (the results route renders two distinct states, ordinary and
flawless — see below). Route, file, and what it does.

| #   | Route                             | File                                     | Purpose                                                                                                                                                                                                                                                 |
| --- | --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`                               | `app/index.tsx`                          | Home. Centred, stacked wordmark lockup as the headline, continue-card for the last played team, Start Training.                                                                                                                                         |
| 2   | `/team-picker`                    | `app/team-picker.tsx`                    | Team picker, segmented into Clubs and National Teams. Each row shows a mono sub-line — `LEVEL n · BEST n/10` or `NOT PLAYED`, green once cleared.                                                                                                       |
| 3   | `/team/[squadId]/difficulty`      | `app/team/[squadId]/difficulty.tsx`      | The three-level difficulty ladder, accent border on the playable rung, locked rows stating their unlock condition, plus the Study entry point.                                                                                                          |
| 4   | `/team/[squadId]/study`           | `app/team/[squadId]/study.tsx`           | Browsable squad list — number, name, position, club or nationality. With a `players` param it narrows to only those players, hides the position filters, and titles itself "Missed Players".                                                            |
| 5   | `/play/[squadId]/[level]`         | `app/play/[squadId]/[level]/index.tsx`   | A question. Hero slot, stat chips, answer options; on L2/L3 a part rail beside the hero shows each part's earned verdict, with the position/club/nationality parts below.                                                                               |
| 6   | `/play/[squadId]/[level]/results` | `app/play/[squadId]/[level]/results.tsx` | Score, the players missed, and pass/fail-aware CTAs — `Study These N` is primary on a failed round, filtering Study to the misses, and suppresses `Study This Squad`. A 10/10 round instead renders the flawless "a la escuadra" state, no missed list. |

## Captures

| File                                 | Screen                      |
| ------------------------------------ | --------------------------- |
| `screens/01-home.png`                | Home                        |
| `screens/02-team-picker-clubs.png`   | Team picker, Clubs          |
| `screens/03-team-picker-nations.png` | Team picker, National Teams |
| `screens/04-difficulty.png`          | Difficulty ladder           |
| `screens/05-study.png`               | Study                       |
| `screens/06-question-l1.png`         | Question, level 1           |
| `screens/07-question-l3.png`         | Question, level 3           |
| `screens/08-results.png`             | Results                     |

`08-results.png` captures the ordinary (non-flawless) state. The flawless "a
la escuadra" state and the missed-players-filtered Study view have no capture
yet.

## Vocabulary

_Escuadra_ means the squad, and _a la escuadra_ means a shot into the top
corner of the goal — the perfect strike. A flawless round is **a la escuadra**;
use that term rather than "perfect score". The product is called **Escuadra**;
"Squad Trainer", "Squad Game" and "Squad Quiz" are stale names that predate it.
