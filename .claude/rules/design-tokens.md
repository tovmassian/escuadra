---
paths:
  - "theme/**"
  - "components/**"
  - "app/**"
---

# Design tokens and theming

## Tokens (guardrail 5)

**Never hardcode a colour, spacing value, or font size.** Everything comes
from the design tokens. If a token is missing, add it to the token file
rather than inlining a value. This governs the app's own design system —
backgrounds, text, spacing, semantic accent/success/error — never invented
or arbitrary colour.

Team identity colour is content, not a token: `team-identity.md`.

Colour specifically comes from the **active palette**, via
`useThemeColors()` — never a module-scope capture. `StyleSheet.create` at
module scope is evaluated once at import, so a component built that way
looks correct and silently ignores the theme. The one exception is
`ShareCard`, the share picture, which draws in `palettes.dark` on purpose: the
picture looks the same whichever theme it is shared from. Both palettes in
`theme/tokens.ts` implement the same `Palette` interface: add a role to
both or to neither.

## Theming

**Theming is two palettes and a hook.** `theme/tokens.ts` holds
`palettes.dark` and `palettes.light`; `theme/resolveTheme.ts` is the pure
preference-to-name resolver, kept React-free so Vitest (which runs in a node
environment and cannot load `react-native`) can test it; `theme/useTheme.ts`
exposes `useThemeName()` and `useThemeColors()`. The persisted preference
lives in `stores/progress.ts` — it is not a third store (`stores.md`).

## Motion

Every animation stays under 300ms by default; a design that needs longer changes
this rule and the tokens (`CLAUDE.md`, Guardrails). The app is played in fast repetitive bursts
and slow transitions become infuriating by question six. `durations.autoAdvance`
(1,200 ms) is a pause, not an animation: the wait after a correct answer before
the round moves on, which a tap skips and which never runs with a screen reader
on. It sits outside the rule, as does `skeleton`, a shimmer's loop period
rather than an animation.

Home's number wall (#181) drifts, slow and endless, at `numberWall.speed`. It is ambient, not a
transition, so it is the rule's written exception (owner approved, 2026-10-22). It stands still
under Reduce Motion, and stops while the app is in the background or Home is not the focused
screen. It is the only ambient loop; `skeleton` loops only while a photo loads.

The round-over celebration is the other carve-out: its timelines (`strikeTiming`, `resultsTimeline` in `theme/tokens.ts`) may run past 300 ms.

## The system theme

⚠️ **`userInterfaceStyle` in `app.json` must stay `"automatic"`.** Pinning it
to `"dark"` or `"light"` locks the app to that theme and makes
`useColorScheme()` return the same value on every device, so the
system-following default silently never fires — with no error to trace it by.
`theme/__tests__/userInterfaceStyle.test.ts` pins it, because a pinned theme compiles and looks right on a phone set to the same theme. Verify it on a light device, not by reading the
diff.
