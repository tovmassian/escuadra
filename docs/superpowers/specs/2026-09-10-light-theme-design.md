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

In scope:

- A second palette, and both palettes carrying the same key set.
- Theme state, persisted, defaulting to dark.
- A toggle control on Home, top-right, per the mock.
- Every screen and component switching with it.
- The dark ramp's lift, including the four `app.json` colours that mirror it.
- Regenerating `design/screens/`.

Out of scope:

- **A Settings screen.** Home is the only entry point; v0 has no settings
  surface and this does not justify inventing one.
- **Following the OS appearance setting.** First launch is dark for everyone,
  exactly as today. `userInterfaceStyle: "dark"` stays in `app.json` — see
  "Native shell" below.
- **A styling library.** CLAUDE.md forbids a second styling approach beside the
  tokens. Plain `StyleSheet` stays.
- **Re-tuning the dark theme beyond the design source's four lifted values.**
- **A theme-aware splash screen.** See "Cold start" below.

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

`stores/progress.ts` gains `theme: ThemeName` (default `'dark'`) plus
`setTheme`/`toggleTheme`. No new store: CLAUDE.md permits exactly two, and a
durable cross-session preference is what the persisted one is for.

`ThemeName` (`'dark' | 'light'`) is defined and exported by `theme/tokens.ts`
alongside the palettes, so the store depends on the token file rather than the
reverse.

`reset()` does not touch `theme`. It clears game progress; silently reverting
someone's appearance choice alongside their scores would be a surprise, and the
two have nothing to do with each other.

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

A hook resolves it:

```ts
export function useThemeColors(): Palette {
  return palettes[useProgress((s) => s.theme)];
}
```

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
   `const styles = useMemo(() => StyleSheet.create({...}), [colors]);`.

2. **Module-scope lookup records** — `AnswerOption` (`VERDICT_BG`,
   `VERDICT_BORDER`, `VERDICT_TEXT`) and `ChipOption`. These map a verdict to a
   colour. They become functions of the palette, memoised in the component the
   same way.

3. **Module-scope helper functions** — `ProgressDots.dotStyle(outcome)` returns
   a style object built from `colors`. It takes the palette as a parameter.

Styles that carry no colour could stay at module scope, but splitting each
component's styles in two to save a `StyleSheet.create` on a rare, user-driven
toggle is not worth the readability cost. One memoised block per component.

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

The theme is persisted, so on a cold launch it is not known at first paint.
Left alone, a light-theme user gets a dark frame that flips — every launch.

`app/_layout.tsx` already holds the splash screen until fonts load, for exactly
this class of problem ("otherwise the first frame renders in the system font and
visibly reflows"). The same gate extends to hydration: hold the splash until
`useProgressHydrated()` is true as well. `stores/progress.ts` already exports
that hook.

**The splash itself stays dark in both themes.** It is a static asset configured
in `app.json` and cannot read a value that lives in AsyncStorage. Expo's dark
splash variant keys off the OS setting, which is not what drives our theme, so
it would be wrong as often as right. A light-theme user sees a dark splash. This
is an accepted limitation, recorded so it is not later filed as a bug.

## Native shell

`app.json` repeats the dark background as a literal in four places — the Android
adaptive icon, the splash, the splash's dark variant, and the top-level
`backgroundColor`. All four move `#07090b` → `#12141a` with the token. Left
stale, the splash-to-app handoff shows a visible seam for dark users, which is
the majority case.

`userInterfaceStyle` stays `"dark"`. It governs OS-drawn surfaces, and this app
has almost none — hard constraint #3 means there is no keyboard, and there are
no action sheets or system dialogs. Setting it `"automatic"` would let native
surfaces follow the OS while the app follows its own persisted setting, so the
two could disagree. Revisit it alongside the development build, where native
surfaces can actually be tested.

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
  anything is legible.
- `npm run shots` regenerated. The dark captures change (the ramp lifts), so
  this is required regardless. A light pass means seeding the persisted theme
  before a second capture run — worth doing so the design handoff sees the new
  theme, and the first thing to drop if it fights the tooling.

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
