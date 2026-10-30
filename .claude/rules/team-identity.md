---
paths:
  - "components/TeamMarker.tsx"
  - "components/TeamRow.tsx"
  - "components/LadderHero.tsx"
  - "components/SpotlightStage.tsx"
  - "components/PlayerCard.tsx"
  - "components/StudyListRow.tsx"
  - "components/ShareCard.tsx"
  - "app/team/*/study.tsx"
  - "app/play/*/*/*.tsx"
  - "components/HomeContinue.tsx"
  - "components/HomeSquads.tsx"
  - "components/AnswerTile.tsx"
  - "components/AnswerGrid.tsx"
  - "components/SlotChip.tsx"
  - "app/team-picker.tsx"
  - "components/Flag.tsx"
  - "lib/flags.ts"
  - "lib/stageView.ts"
  - "assets/flags/**"
  - "scripts/gen-flags.ts"
  - "data/squads/**"
  - "types/squad.ts"
---

# Team identity

## Colours and markers

`primaryColor`/`secondaryColor` are the team's **real** identity colours
(hex), carried directly on the squad — content, not a design token. Get the
actual colour right; do not invent or rotate an arbitrary hue.

`marker` (`TeamMarker`, see `types/squad.ts`) is a club's sole visual
identity element, and every squad carries one, a nation's included (where each
is drawn: The in-round banner, below). It's
declarative band geometry, not an asset: `bands` (fills, in draw order),
`orientation` (`horizontal` | `vertical`) and an optional `weights` array for
uneven bands.
Colour bands only, never a disc, diamond or other device.
`squadctl registry check` and `lib/__tests__/squads.test.ts` fail any other
marker field.
For a club it's the club's own colours laid out as bands — never an emblem. A
nation's is its flag as bands: a device on a single-colour field becomes a band of
its colour (Japan is white/red/white); on a striped flag, arms, seals and emblems
are dropped (Spain without its arms is its civil flag; Canada without its leaf).
Its real flag image shows on the surfaces listed under Flags, below
(`lib/flags.ts`, `components/Flag.tsx`).
Both `data/index.json` (the picker manifest) and each squad file carry
`primaryColor`/`secondaryColor`/`marker`, since the picker never imports full
squad JSON.

Guardrail 5 (never hardcode a colour) does **not** apply to team identity colour, which
is real-world fact about a specific club or nation, not a design choice. Never invent, rotate, or arbitrarily
assign a team's colour; it must be the team's actual real colour.

## The in-round banner

**The in-round team marker is always drawn as vertical bands, whatever the squad's
`orientation`.** On the question screen's header it is a thin strip
(`sizes.teamMarkerBanner` in `theme/tokens.ts`) of bands side by side, using `bands`
(and `weights`) as the colour sequence and ignoring `marker.orientation` entirely:
Spain reads red/yellow/red left-to-right, not stacked. This is `TeamMarker`'s
`variant="banner"` (`components/TeamMarker.tsx`); `variant` is required, so the
question screen must name it.

The other variants draw a marker at its true `orientation`: `picker` in the team
picker (`TeamRow`) and the Difficulty hero's name row, and Home's two sizes (#181),
`continue` (34 × 23, ringed with `ctaLine` on Continue's `ctaBg`) and `squad`
(24 × 16, in a starred team's round button). These four places draw a club's
marker; a nation shows its flag image there, and its marker only when `lib/flags.ts`
has no flag for it.

`bannerBands` (`lib/stageView.ts`) turns a marker into vertical bands whatever its
`orientation`. `variant="banner"` uses it, and so do these surfaces, for clubs and
nations alike:

- the Difficulty hero (`LadderHero`), full bleed under a veil;
- the small banner beside the squad name at the top of Study;
- the backdrop under a player's photo, which shows wherever the photo is missing or
  still loading: the question stage, the Results and Study cards, the circles on
  Results after a round a la escuadra, and Study's list rows;
- the strip across the top of the share picture (`ShareCard`).

## Flags (guardrail 2's carve-out)

National flags are the one carve-out, because the rule exists
for trademark exposure and a flag carries none. A flag is a committed PNG in
`assets/flags/`, shown as:

- a nation squad's own flag, in place of its marker: the team picker, the Difficulty
  hero's name row, Home's Continue button and starred-team buttons;
- a player's nationality, in a club squad: level-3 nationality options, the `NAT`
  stat chip, and Study's cards and list rows.

Never a Unicode regional-indicator emoji
(🇦🇷) — that depends on an OS flag-emoji font, and Windows ships none, so the
Playwright capture behind `npm run shots` would render "AR".
