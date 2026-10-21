---
paths:
  - "lib/questionEngine.ts"
  - "lib/scoring.ts"
  - "lib/roundView.ts"
  - "lib/prng.ts"
  - "app/play/**"
  - "components/Answer*.tsx"
  - "components/SlotChip.tsx"
  - "components/Round*.tsx"
---

# The quiz

## Difficulty levels

| Level | Prompt               | Answer                                                                |
| ----- | -------------------- | --------------------------------------------------------------------- |
| 1     | Shirt number + stats | Player name, 4 options                                                |
| 2     | Shirt number + stats | Name (4 options), then position (GK / DF / MF / FW chips)             |
| 3     | Shirt number only    | Name (6 options), then position, then club or nationality — see below |

On level 3 the third part depends on `squad.kind`: a **club** squad asks the
player's **nationality**, a **nation** squad asks their **club**. Asking a nation
squad for nationality is a non-question, since every member shares it.

**One question, up to three parts.** A round is 10 questions at every level. A
level-2 or level-3 question is a single scored unit: it counts as correct only
when _every_ part is answered correctly. There is no partial credit. The progress
bar counts questions, not parts, so all three levels show 1..10.

Distractor quality is what makes or breaks this. Random wrong answers make the
game trivial; same-position and same-squad distractors make it a real test. On
level 3 the name distractors are drawn from the **same squad**, so they are
genuinely confusable.

## The question engine

**`lib/questionEngine.ts` stays pure.** No React, no store imports, no I/O.
Given a squad and a level, return questions. It's the piece most likely to
need iteration and it must be trivially unit-testable.

## Answering is a tap (guardrail 3)

**No text input in the quiz. No keyboard for answering.** Every quiz answer
is a tap — option cards and chip selectors are the entire input vocabulary
there. This is deliberate: typing player names on a phone is the worst
possible version of this app. Do not add free-text answering or fuzzy name
matching to questions.

The one exception is the **team picker's search field** (filtering the
club/nation list as you type): narrowing a list is not answering a
question, and typing a few letters is the normal way to find one team
among many. Keep the exception scoped to that field — do not add free-text
input anywhere else in the app.
