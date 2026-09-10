# Light theme

Design source: Claude Design project "Escuadra light theme design"
(`Escuadra Home.dc.html`), which defines both palettes and mocks the Home
screen's toggle. Branch: `worktree-theming`.

## Problem

Escuadra is dark-only, and structurally so. `theme/tokens.ts` exports one flat
`colors` object, and roughly thirty components consume it from module scope
inside `StyleSheet.create({...})` — evaluated once, at import time. Nothing can
change a colour after that. `app/_layout.tsx` states the consequence outright:

> Escuadra is dark-only — the token set has no light variant, so we pin the
> navigation theme rather than following the system scheme.

The design source adds a second palette and a toggle. Taking it means removing
the structural assumption, not just adding hex values.

The design source also lifts the dark ramp. The stated reason is that the brand
mark's trail squares, at 30% and 55% opacity, sank into a near-black background
and stopped reading as a trail. Four dark values move as a result, `background`
farthest.

## Scope

Both themes ship in the first release. This is a v0 feature, not a follow-up,
and CLAUDE.md is updated to say so — see "CLAUDE.md" below.

In scope:

- A second palette, and both palettes carrying the same key set.
- Theme preference, persisted, **following the system setting by default**.
- A toggle control on Home, top-right, per the mock.
- Every screen and component switching with it.
- The dark ramp's lift, including the `app.json` colours that mirror it.
- A theme-aware splash screen.
- CLAUDE.md updates.
- Regenerating `design/screens/`.

Out of scope:

- **A Settings screen.** Home is the only entry point; v0 has no settings
  surface and this does not justify inventing one.
- **A styling library.** CLAUDE.md forbids a second styling approach beside the
  tokens. Plain `StyleSheet` stays.
- **Re-tuning the dark theme beyond the design source's four lifted values.**
- **A new splash asset.** Not needed — see "Native shell".

## The palette

Fifteen roles vary by theme. Everything else — `accent`, the translucent state
washes, the brand palette, gradients, shadows, and every non-colour token —
is identical in both and is not part of either palette's varying set.

| Role                | Dark                        | Light     |
| ------------------- | --------------------------- | --------- |
| `background`        | `#12141a` _(was `#07090b`)_ | `#f7f7f9` |
| `surface`           | `#1a1d22` _(was `#111416`)_ | `#ffffff` |
| `surfaceRaised`     | `#242830` _(was `#1c2022`)_ | `#eef0f3` |
| `border`            | `#3a4046` _(was `#33393d`)_ | `#dcdfe4` |
| `textPrimary`       | `#f3f5f7`                   | `#14161a` |
| `textSecondary`     | `#b4b8bb`                   | `#4b4f56` |
| `textMuted`         | `#767b80` _(was `#707579`)_ | `#8b8f96` |
| `accentOn`          | `#f3f5f7`                   | `#ffffff` |
| `mark` _(new)_      | `#8f97ea`                   | `#5b63d6` |
| `thumbBg` _(new)_   | `#2b2f38`                   | `#ffffff` |
| `thumbIcon` _(new)_ | `#e7e9f5`                   | `#b9840f` |
| `success`           | `#61bd67`                   | `#2f8f3e` |
| `error`             | `#f05653`                   | `#c23934` |
| `errorBorderDim`    | `#5c3230`                   | `#e3b0ad` |
| `errorTextDim`      | `#a15a58`                   | `#b3625d` |

Three of these need their reasoning recorded, because each looks arbitrary
otherwise.

**`mark` is a new role, not a new colour.** `Wordmark` currently passes
`colors.brandSoft` to the mark. That value is right on near-black and wrong on
near-white — it is the pale end of the brand ramp. The role names what the mark
needs (a fill that holds against the current background); dark resolves it to
`brandSoft` and light to `brandBright`, both already in the brand palette. No
brand hex is added, changed, or invented.

**`success` and `error` darken in light; `accent` does not.** `accent`
(`#3e45a3`) is dark enough to carry roughly 8.5:1 against white, which is why
the design source reuses it unchanged in both themes. `success` (`#61bd67`) and
`error` (`#f05653`) are not — about 2.4:1 and 3.5:1 on white — and both are used
as small caption and mono text (`statusLabelBest`, `metaCleared`,
`missedPickedValue`). They get darker light-theme values rather than being
reused blind.

**The `*Bg` washes are unchanged and shared.** `successBg` and `errorBg` are
translucent rgba, so they composite over whatever surface is behind them and
adapt on their own. `errorBorderDim` and `errorTextDim` are opaque and do not,
which is why those two — and only those two — need light-theme values.

## Architecture

### Where the state lives

`stores/progress.ts` gains `themePreference: ThemePreference` (default
`'system'`) plus `setThemePreference`/`toggleTheme`. No new store: CLAUDE.md
permits exactly two, and a durable cross-session preference is what the
persisted one is for.

`theme/tokens.ts` defines and exports both types alongside the palettes, so the
store depends on the token file rather than the reverse:

```ts
type ThemeName = 'dark' | 'light'; // a resolved theme — indexes `palettes`
type ThemePreference = ThemeName | 'system'; // what the user chose
```

The distinction carries real weight and the two must not be collapsed. The
preference is what persists; the name is what the UI resolves to on each render.

`reset()` does not touch the preference. It clears game progress; silently
reverting someone's appearance choice alongside their scores would be a
surprise, and the two have nothing to do with each other.

### Resolving the preference to a theme

`'system'` resolves through React Native's `useColorScheme()`, which reports the
device setting and re-renders on change — so a phone that switches itself at
dusk carries the app with it, without the app storing anything.

```ts
const preference = useProgress((s) => s.themePreference);
const system = useColorScheme(); // 'light' | 'dark' | null
const name: ThemeName = preference === 'system' ? (system ?? 'dark') : preference;
```

`useColorScheme()` returns `null` when the scheme is unknown. Dark is the
fallback — it is the app's original and only identity to date.

**This requires `userInterfaceStyle: "automatic"` in `app.json`.** The current
value is `"dark"`, which per the SDK 57 docs locks the app to dark outright:
`useColorScheme()` would return `'dark'` on every device regardless of its
setting, and the default preference would silently never work. This is the one
change in the whole feature that fails silently rather than loudly, which is
why it is called out twice — here and under "Native shell".

### The toggle's semantics

The mock's control is a two-state sun/moon switch, but the preference has three
states. Tapping it writes an **explicit** preference — the opposite of whatever
is currently resolved. So a user on a light phone sees light, taps once, and is
pinned to dark.

There is deliberately no way back to `'system'` from the toggle. A binary
switch cannot express three states legibly, and there is no Settings screen to
put a third control on. The cost is that the first tap is one-way until
reinstall; that is the normal bargain for a binary theme switch and is accepted
here rather than worked around with a hidden gesture.

### Resolving colours

`theme/tokens.ts` exports `palettes: Record<ThemeName, Palette>`. Both palettes
carry the **full** key set — the shared constants are spread into each rather
than duplicated as literals:

```ts
const shared = { accent: '#3e45a3', successBg: '...' /* brand palette, etc. */ } as const;
const palettes = {
  dark: { ...shared, ...darkRoles },
  light: { ...shared, ...lightRoles },
} as const;
```

So a consumer sees one flat object with exactly the shape `colors` has today.
Every `colors.foo` reference across the app keeps working verbatim; only where
the object comes _from_ changes.

Two hooks resolve it, wrapping the preference resolution above:

```ts
export function useThemeName(): ThemeName; // preference + useColorScheme()
export function useThemeColors(): Palette; // palettes[useThemeName()]
```

Both are needed. `useThemeColors` covers almost every consumer; the root layout
and the toggle need the resolved _name_ itself, to pick a navigation theme, a
status-bar style, and which glyph to show.

Palettes are module constants, so the returned identity is stable per theme and
only changes when the theme actually does.

**`colors` is removed as an export.** This is deliberate and is the migration's
safety net: with `noUncheckedIndexedAccess` and strict mode, every file still
importing it fails to compile. A missed file cannot silently keep a frozen dark
palette — it breaks the build instead. That is worth more here than a smaller
diff, across twenty-seven files.

### The three shapes to migrate

Twenty-seven files consume a varying role. `BrandGradient`, `EscuadraStrike`,
and `TeamMarker` do not, and are untouched. The work is mechanical but comes in
three shapes, and only the first is the obvious one:

1. **Module-scope `StyleSheet.create`** — most files. Moves inside the
   component: `const colors = useThemeColors();` then
   `const styles = StyleSheet.create({...})` in the render body.

2. **Module-scope lookup records** — `AnswerOption` (`VERDICT_BG`,
   `VERDICT_BORDER`, `VERDICT_TEXT`) and `ChipOption`. These map a verdict to a
   colour. They become functions taking the palette as a parameter.

3. **Module-scope helper functions** — `ProgressDots.dotStyle(outcome)` returns
   a style object built from `colors`. Same treatment: take the palette as a
   parameter.

**No manual `useMemo`.** `app.json` sets `experiments.reactCompiler: true`, so
the compiler memoises these automatically on `colors`, whose identity is stable
per theme. Hand-written `useMemo` across twenty-seven files would be noise that
duplicates what the build already does. If profiling later shows a real cost,
add it then — a theme change is a single user-driven tap, not a hot path.

Styles that carry no colour could stay at module scope, but splitting each
component's styles in two is not worth the readability cost. One block per
component.

### Root layout

`app/_layout.tsx` builds `navTheme` at module scope from `DarkTheme`. It moves
inside the component, picking `DarkTheme` or `DefaultTheme` (both exported from
`expo-router` — verified against the installed SDK 57; CLAUDE.md forbids
importing from `@react-navigation/*` directly). `dark:` and the `Stack`'s
`contentStyle.backgroundColor` follow the palette, and `<StatusBar>` flips
between `style="light"` and `style="dark"`.

## The toggle

A new `components/ThemeToggle.tsx`: a pill track with a sliding thumb carrying a
moon in dark and a sun in light, per the mock. Built from `View`s and the
existing token vocabulary — `thumbBg`/`thumbIcon` are its colours, and it needs
no new geometry file.

The mock animates the thumb over 160ms, comfortably inside CLAUDE.md's 300ms
budget. It uses a CSS transition, which React Native has no equivalent for; the
thumb slides via Reanimated, as the app's other motion already does.

Placement on Home is top-right, above the brand block, respecting
`useSafeAreaInsets().top` — the mock's `paddingTop: 70` is the design tool's way
of clearing a simulated status bar and must not be copied as a literal.

## Cold start

The preference is persisted, so on a cold launch it is not known at first paint.
Left alone, someone pinned to light gets a dark frame that flips — every launch.

`app/_layout.tsx` already holds the splash screen until fonts load, for exactly
this class of problem ("otherwise the first frame renders in the system font and
visibly reflows"). The same gate extends to hydration: hold the splash until
`useProgressHydrated()` is true as well. `stores/progress.ts` already exports
that hook.

Note that the default case needs no such help — `useColorScheme()` is
synchronous and correct on the first frame. The gate exists for the explicit
override, which is the only part that lives in AsyncStorage. It is applied
unconditionally because which case applies is itself unknown until hydration.

## Native shell

`app.json` needs three changes.

**`userInterfaceStyle: "dark"` → `"automatic"`.** Per the SDK 57 docs, `"dark"`
locks the app to dark and pins `useColorScheme()` to `'dark'` on every device.
Without this change the default preference resolves to dark for everyone, on a
light phone as readily as a dark one, and nothing anywhere reports an error.

**The background hexes move `#07090b` → `#12141a`.** They appear in the Android
adaptive icon, the splash, the splash's `dark` variant, and the top-level
`backgroundColor`. Left stale, the splash-to-app handoff shows a visible seam.

The top-level `backgroundColor` is a single static value that cannot follow a
theme; it sits behind screen transitions. Dark is the right choice for it — the
app's original identity, and the value it already holds — but it means a
light-theme user may catch a dark edge mid-transition. A device-verification
item, not a blocker.

**The splash becomes theme-aware**, and needs no new asset. `splash-icon.png` is
the mark on a fully transparent background, its gradient running `#5961d2` to
`#393f97`: deep enough to hold against near-white, bright enough to hold against
near-black. Only the two background colours differ — base `#f7f7f9`, `dark`
variant `#12141a`. `userInterfaceStyle: "automatic"` is what activates the
variant, so this falls out of the change above rather than costing anything
extra.

One seam remains and is accepted: the native splash follows the **OS**, while an
explicit in-app override follows the user. Someone who pins light on a dark
phone gets a dark splash and a light app. It cannot be fixed from `app.json` —
the splash paints before any JavaScript runs, so nothing can read AsyncStorage in
time. For the default `'system'` preference the two always agree.

## CLAUDE.md

Two themes ship in the first release, so CLAUDE.md changes with the code rather
than after it:

- **v0 definition of done** gains a line for light/dark, following the system
  setting by default, with a toggle on Home. It is a release item, not a
  follow-up.
- **Hard constraint #5** ("Never hardcode a colour…") is extended: colours come
  from the _active palette_, via `useThemeColors()`. A module-scope colour
  capture is the specific failure the constraint now names, because it produces
  a component that looks correct and silently ignores the theme.
- **Architecture rules** gains the theming mechanism in brief — two palettes
  with identical key sets, the hooks, and the fact that the preference lives in
  `stores/progress.ts` rather than a third store.
- **Environment** records the `userInterfaceStyle` gotcha: pinning it to a fixed
  theme makes `useColorScheme()` constant, with no error to trace it by.
- The `app/_layout.tsx` comment asserting the app is dark-only goes, along with
  the sentence in **Current state** that treats one palette as given.

## Testing

The repo unit-tests pure `lib/` modules and has no component test
infrastructure; this follows that convention rather than introducing one.

- **New:** a palette test asserting `Object.keys(palettes.dark)` and
  `Object.keys(palettes.light)` are the same set. Both palettes are built by
  spreading `shared`, so a key present in one and missing from the other is the
  realistic failure — and it would surface as an `undefined` colour on one theme
  only, which typecheck alone will not catch.
- **Unchanged and must stay green:** `design/handoff.test.ts`. It pins object
  identity across `design/tokens.ts`'s `export *`, so the new exports flow
  through and the removed `colors` disappears from both sides together. No edit
  to that test should be needed; if one seems necessary, something is wrong.
- `npm run check` in full.
- **Device verification via Expo Go**, both themes, every screen. This is the
  step that matters. Typecheck proves every file was migrated; it does not prove
  anything is legible. Three cases specifically: a light phone launching to
  light with no stored preference, flipping the phone's setting mid-session and
  watching the app follow, and an explicit override surviving a cold restart
  while the phone disagrees.
- `npm run shots` regenerated. The dark captures change (the ramp lifts), so
  this is required regardless. A light pass means seeding the preference before
  a second capture run — worth doing so the design handoff sees the new theme,
  and the first thing to drop if it fights the tooling.

## Watch items

**Alpha-based dimming inverts.** `opacity.faded` (0.4), `dimmed` (0.65) and
`dotFuture` (0.35) were tuned against near-black, where fading pushes an element
_toward_ the background. On near-white they fade toward white and can wash out
past the point of reading. These are used on answer options during an incorrect
reveal and on progress dots — mid-round, where clarity matters most. Device
verification should look at a level-3 incorrect reveal specifically. Do not
pre-tune these blind; measure first.

**A missed file is a build failure, not a visual bug.** Removing the `colors`
export is what buys that, and is the main reason a twenty-seven-file mechanical
migration is a reasonable thing to attempt in one pass.

**`userInterfaceStyle` is the one silent failure mode.** Everything else in this
feature fails loudly — a missed migration breaks the build, a mismatched palette
key fails a test. Leaving `userInterfaceStyle` at `"dark"` produces an app that
compiles, passes, and looks right on a dark phone, while the entire
system-following default quietly never fires. Verify it on a light phone, not by
reading the diff.
