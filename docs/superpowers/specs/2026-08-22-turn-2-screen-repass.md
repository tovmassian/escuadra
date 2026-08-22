# Turn 2 — screen re-pass

Status: approved design, not yet planned
Date: 2026-08-22
Source: `Escuadra Screen Repass.dc.html`, Claude Design project 5f2357de

## Where this came from

Turn 1 of the design↔app loop returned three deliverables: the PNG asset set,
the wordmark lockups, and a six-screen re-pass. The assets and the two defects
the re-pass found have already landed (`6f412e2`, `a096074`). This spec covers
the remaining screen changes.

The re-pass reasoned from `design/screens/*.png` and from `design/SCREENS.md`'s
invariants. Every value it proposes resolves to an existing token; it introduces
no new numbers.

## Decisions already taken

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Level-3 nationality and club options stay **text only** | `marker` exists on squads; only 6 nations are squads. Barcelona's members span 8 nationalities, so banding the 3 that have markers and leaving 5 bare reads as a rendering failure. |
| 2 | `Study These 3` gets a **real player-id filter** | The missed list is the result in a study tool; a primary CTA that silently ignores its own label is worse than no change. |
| 3 | The `✓`/`✕` dingbats are replaced by the **mark** as part of the question screen | They take colour from tokens so they are not a constraint violation, but they depend on a glyph Inter may not carry. The re-pass already makes the mark the verdict glyph. |
| 4 | `sizes.teamUnderline` is **removed** | Its only consumers are the three lines the question screen change replaces. |

## Per-screen deltas

### 1. Home

The capture is ~70% empty: the wordmark sits in a top-left eyebrow slot and
everything else is bottom-pinned. Promote the full lockup — **with the trail,
its only legitimate home** — to the optical centre. This is the one screen with
room for the mark at 86px, where the geometry actually reads.

Continue card and CTAs keep their current tokens (`radii.lg`, TeamMarker 22×15,
`controlHeightLarge` 56, `radii.xl`).

### 2. Team picker

Every row carries one em-dash pill, so eleven rows say nothing eleven times.
The row is the only place progress can live, so it earns its height:

- level reached and best score as a mono sub-line
- the sub-line turns `colors.success` once a team has been cleared
- row height 56 → 64 to hold two lines

Markers are unchanged — they render `marker.bands` verbatim.

### 3. Difficulty ladder

Two hierarchy inversions in the capture:

- the **locked** Full Profile row wears an accent border while the **unlocked**
  row wears none, so the ladder points at the rung you cannot reach
- ~300px of empty connector between rungs reads as three unrelated cards

Fixes: accent moves to the playable row; rungs close to `spacing.md`; each locked
row states its unlock condition ("Clear L1", "Clear L2") instead of leaving the
padlock to imply it.

Badge sizes (40/48/56), the type ramp, and `opacity.disabled` 0.55 are unchanged.

### 4. Question screen (levels 1–3)

- **Part rail.** A bare `1 · NAME` label is the only sign the question has parts,
  so you cannot see how many remain. The hero card shrinks to 108, and the rail
  moves into the freed column: one row per part, answered parts showing the mark
  as a real verdict with the chosen answer, the current part accented, the rest
  at `opacity.faded`.
- **Progress bar** colours by outcome rather than showing ten identical dashes.
- **Team identity** stops being a 2px rule in `primaryColor` and becomes the
  `TeamMarker` itself at `sizes.teamMarker` 22×15. It must be the real marker,
  not a banded line: `orientation` is horizontal for five of six nations, and
  Japan and Brazil carry overlays — at 2px tall Armenia's bands are 0.67px each
  and Japan's disc is 1.2px, collapsing Japan into a white line indistinguishable
  from Real Madrid.
- Level 1 takes **no changes beyond the progress bar**. The 220 hero with the 104
  number is the strongest thing in the app; leave it alone.

Invariants this must respect: 6 (options scroll, rail and CTA pinned), 7 (rail
collapses on a wrong part), 8 (rail shows earned verdicts only), 9 (rail is
position, not score — the bar counts questions and does not move mid-question).

### 5. Results — missed

"Time to get back in the study screen" names a route, not an action, and the
primary CTA then sends you to retry the round you just failed. The missed list
is the result, so the primary action follows it:

- primary: `Study These N` → Study, filtered to exactly those players
- secondary: Retry This Round
- tertiary: Choose Different Team

The picked (wrong) name uses `errorTextDim`, not `error`.

Invariant 10 still governs: the CTA set varies by pass/fail and by whether the
level ceiling is reached.

### 6. Results — a la escuadra

`design/SCREENS.md`'s vocabulary section names the flawless round and nothing in
the app ever says it. On a 10/10 round the mark becomes the content: the ball
lands in the angle in `colors.success`, trail behind it, one 220ms travel — the
only place the trail animates. No missed list means no payload, so the whole
screen is the reward. CTA is the unlock, not a retry of a perfect round; when the
level ceiling is reached there is no unlock CTA and Retry stands alone.

Motion budget: `durations.pop` + `durations.popSettle` = 220ms, under the 300ms
cap.

### 7. Study — filter

Study accepts an optional list of player ids and shows only those, so
`Study These N` has somewhere to land. Unfiltered Study is unchanged.

## Not in scope

- `05-study` layout and `03-team-picker-nations` were not re-passed — those two
  screenshots were never uploaded to the design project, so the design side never
  saw them. No deltas are proposed beyond the Study filter above.
- Nationality/club markers (decision 1).
- Everything CLAUDE.md defers for v0.

## Known risk

The re-pass reasoned from web captures at `deviceScaleFactor: 2`, which
`design/SCREENS.md` explicitly flags as untrustworthy for spacing. Its
"mark fuses below 40px" defect was real arithmetically but likely overstated for
a 3× device. Treat spacing claims as proposals to verify on device, not as
measurements.
