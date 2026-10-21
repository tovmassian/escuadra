---
paths:
  - "components/TeamMarker.tsx"
  - "components/TeamRow.tsx"
  - "components/Flag.tsx"
  - "lib/flags.ts"
  - "lib/stageView.ts"
  - "assets/flags/**"
  - "scripts/gen-flags.ts"
  - "data/squads/**"
---

# Team identity

## Colours and markers

`primaryColor`/`secondaryColor` are the team's **real** identity colours
(hex), carried directly on the squad — content, not a design token. Get the
actual colour right; do not invent or rotate an arbitrary hue.

`marker` (`TeamMarker`, see `types/squad.ts`) is a club's sole visual
identity element, and every squad carries one — a nation's still feeds the
in-round banner, where no image fits. It's declarative band geometry, not an
asset: `bands` (fills, in draw order), `orientation`
(`horizontal` | `vertical`), an optional `weights` array for uneven bands, and
an optional `overlay` (a centred `disc` or `diamond` device, e.g. Japan's
disc or Brazil's diamond). For a club it's the club's own colours laid out as
bands — never an emblem. A nation's is its flag as geometry, kept for the
in-round banner only; everywhere else a nation shows its real flag image (see
`lib/flags.ts` and `components/Flag.tsx`).
Both `data/index.json` (the picker manifest) and each squad file carry
`primaryColor`/`secondaryColor`/`marker`, since the picker never imports full
squad JSON.

It does **not** apply to team identity colour, which
is real-world fact about a specific club or nation, not a design choice. Never invent, rotate, or arbitrarily
assign a team's colour; it must be the team's actual real colour.

## The in-round banner

**In-round team marker is always a vertical banner, regardless of the
squad's real flag orientation.** The team picker (`TeamRow`) renders a
squad's marker at its true `orientation` — Spain's flag is genuinely
horizontal stripes there. But mid-round, on the question screen's header,
the marker always renders as thin, tall, vertical bands, using `bands` (and
`weights`) as the colour sequence and ignoring `marker.orientation`
entirely: Spain reads red/yellow/red left-to-right, not stacked. This is
`TeamMarker`'s `variant="banner"` (`components/TeamMarker.tsx`,
`sizes.teamMarkerBanner` in `theme/tokens.ts`) — always pass it on the
question screen, never the bare `marker` prop. A shape `overlay` (Japan's
disc, Brazil's diamond) doesn't survive the banner's height, so the banner
renders it as a third middle band instead of a centred shape — edge/middle/
edge, in the overlay's colour — derived from the marker's own data, never a
per-team special case.

## Flags (guardrail 2's carve-out)

National flags are the one carve-out, because the rule exists
for trademark exposure and a flag carries none: a nation's identity element
is a committed PNG in `assets/flags/`, shown on the team picker, level-3
nationality options, the `NAT` stat chip and the Study screen's cards and
list rows. Never a Unicode regional-indicator emoji (🇦🇷) — that depends on an
OS flag-emoji font, and Windows ships none, so the Playwright capture behind
`npm run shots` would render "AR".
