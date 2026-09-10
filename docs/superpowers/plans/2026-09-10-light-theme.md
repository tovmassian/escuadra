# Light Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship light and dark themes in Escuadra's first release, following the device's system setting by default, with a toggle on Home.

**Architecture:** `theme/tokens.ts` gains two palette objects with identical key sets in place of today's single frozen `colors` export. A persisted preference (`'system' | 'dark' | 'light'`) resolves through `useColorScheme()` to a theme name, and a `useThemeColors()` hook hands components the active palette. Every component moves its `StyleSheet.create` from module scope into its render body, because a module-scope stylesheet is evaluated once at import and can never react to a theme change.

**Tech Stack:** React Native 0.86 / Expo SDK 57, expo-router, Zustand + AsyncStorage, react-native-reanimated, TypeScript (strict), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-light-theme-design.md`

## Global Constraints

- **Node 24 is required.** Run `nvm use` once per shell before anything else. On Node 22 every `.ts` entry point dies with `ERR_UNKNOWN_FILE_EXTENSION`.
- **Do not upgrade the Expo SDK.** It is pinned to what the App Store build of Expo Go supports. Read `https://docs.expo.dev/versions/v57.0.0/` for Expo APIs, never the `latest` docs.
- **Never hardcode a colour, spacing value, font size, or duration.** Everything comes from `theme/tokens.ts`. If a token is missing, add it to the token file rather than inlining a value. This plan adds several tokens for exactly this reason.
- **Never import from `@react-navigation/*` in app code.** Import `ThemeProvider` / `DarkTheme` / `DefaultTheme` / `Theme` from `expo-router` itself.
- **Use `StyleSheet.absoluteFill`,** never `StyleSheet.absoluteFillObject` — RN 0.86 removed it.
- **TypeScript is strict, including `noUncheckedIndexedAccess`.** Do not weaken it to make an error go away.
- **Every animation stays under 300ms.**
- **The product is called Escuadra.** "Squad Trainer", "Squad Quiz" and similar are stale; fix them on sight.
- **No component or screen unit tests.** `vitest.config.ts` states it outright: "Screens and components are verified on-device instead: no RN test renderer is configured here on purpose." Do not add a React test renderer.
- **Vitest runs in a `node` environment.** Any module that imports `react-native` cannot be unit-tested. This is why the pure resolver and the hooks live in separate files.
- **Run `npm run check` before reporting any work complete,** and report its actual output.
- Prettier formatting is enforced by `npm run check`. Run `npx prettier --write <files>` before committing.

---

## File Structure

**Create:**

| File                         | Responsibility                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `theme/resolveTheme.ts`      | Pure preference → theme-name resolution. No React, no react-native, so it is unit-testable.                              |
| `theme/resolveTheme.test.ts` | Tests for the above.                                                                                                     |
| `theme/useTheme.ts`          | `useThemeName()` / `useThemeColors()`. Imports react-native and the store, so it is verified on device, not unit-tested. |
| `components/ThemeToggle.tsx` | The sun/moon switch from the design mock.                                                                                |

**Modify:**

| File                              | Change                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `theme/tokens.ts`                 | Two palettes, `ThemeName`/`ThemePreference`/`Palette` types, toggle sizing and duration tokens. `colors` is removed in Task 9. |
| `theme/tokens.test.ts`            | **Already exists** with a `describe('brand tokens')` block. Append to it; do not overwrite it.                                 |
| `stores/progress.ts`              | `themePreference` field + `setThemePreference`.                                                                                |
| `app.json`                        | `userInterfaceStyle: "automatic"`, background hexes, theme-aware splash.                                                       |
| `app/_layout.tsx`                 | Reactive navigation theme + status bar, splash held until hydration.                                                           |
| `app/index.tsx`                   | Hosts `ThemeToggle`; migrated to the hook.                                                                                     |
| 25 further component/screen files | Migrated to the hook, in four batches (Tasks 5–8).                                                                             |
| `CLAUDE.md`                       | v0 scope, hard constraint #5, architecture rules, environment gotcha.                                                          |

**Migration ordering note.** Task 1 keeps `colors` exported as a temporary alias for `palettes.dark`. Every intermediate commit therefore compiles and runs. Task 9 removes the alias, and typecheck becomes the proof that all 27 files were migrated — a missed file fails the build rather than silently rendering dark forever.

---

### Task 1: Two palettes

**Files:**

- Modify: `theme/tokens.ts:1-35` (the `colors` object and `gradients` below it)
- Test: `theme/tokens.test.ts` — **this file already exists.** Append the new `describe` block; do not overwrite its `describe('brand tokens')` block. Its first test reads `colors[key]` for the brand hexes; repoint that at `palettes.dark[key]` now, since Task 9 deletes `colors` and would otherwise break this file.

**Interfaces:**

- Consumes: nothing.
- Produces: `type ThemeName = 'dark' | 'light'`; `type ThemePreference = ThemeName | 'system'`; `interface Palette` (24 string fields); `palettes: Record<ThemeName, Palette>`; `colors` (temporary alias for `palettes.dark`, removed in Task 9).

This task also lands the design source's lifted dark ramp, so the app visibly changes on dark immediately.

- [ ] **Step 1: Write the failing test**

`theme/tokens.test.ts` already exists. Change its import from `import { colors, gradients, typography } from './tokens';` to `import { gradients, palettes, typography } from './tokens';`, change the one `colors[key]` reference in its brand-hex test to `palettes.dark[key]`, and **append** this block below the existing `describe('brand tokens')`:

```ts
// Hex or rgba(). Catches a truncated hex like '#12141', which is a valid
// string and a silently wrong colour — neither TypeScript nor the compiler
// can see the difference.
const COLOR = /^(#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,[\d.]+\))$/;

describe('palettes', () => {
  it('expose identical key sets', () => {
    expect(new Set(Object.keys(palettes.light))).toEqual(new Set(Object.keys(palettes.dark)));
  });

  it('hold a well-formed colour in every role, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      Object.entries(palettes[name]).forEach(([role, value]) => {
        expect(value.replace(/\s/g, ''), `${name}.${role}`).toMatch(COLOR);
      });
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run theme/tokens.test.ts`

Expected: FAIL — `palettes` is not exported from `./tokens`.

The whole-suite count is the guard that the append went in cleanly: it must read **2489** once this task is done — the 2487 baseline plus these two. A lower number means the existing block was clobbered.

- [ ] **Step 3: Restructure the token file**

In `theme/tokens.ts`, replace the entire `export const colors = {...} as const;` block with the following. Keep the file's existing header comment.

```ts
export type ThemeName = 'dark' | 'light';
export type ThemePreference = ThemeName | 'system';

/** Every colour role, resolved for one theme. Both palettes must implement
 *  this in full — a missing role is a compile error, not a runtime blank. */
export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentOn: string;
  /** Flat fill for the Escuadra mark — the brand ramp's pale end reads on a
   *  dark ground and its bright end on a light one, so this is a role, not a
   *  fixed hex. */
  mark: string;
  /** The theme toggle's thumb and its sun/moon glyph. */
  thumbBg: string;
  thumbIcon: string;
  success: string;
  successBg: string;
  error: string;
  errorBg: string;
  errorBorderDim: string;
  errorTextDim: string;
  brandBright: string;
  brandDeep: string;
  brandSoft: string;
  brandLift: string;
  brandPlateTop: string;
  brandPlateBottom: string;
}

// Roles that do not vary by theme. `accent` is dark enough to carry against
// both grounds, which is why the design source reuses it unchanged; the two
// state washes are translucent and composite over whatever surface is behind
// them; the brand ramp is the mark's own identity, not a UI surface.
const sharedRoles = {
  accent: '#3e45a3',
  successBg: 'rgba(97,189,103,0.14)',
  errorBg: 'rgba(240,86,83,0.10)',
  brandBright: '#5b63d6',
  brandDeep: '#2f3585',
  brandSoft: '#8f97ea',
  brandLift: '#6d76e6',
  brandPlateTop: '#4a52c4',
  brandPlateBottom: '#252a6b',
} as const;

// The ramp sits higher than it did: the mark's trail squares, at 30% and 55%
// opacity, sank into the old near-black and stopped reading as a trail.
const darkRoles = {
  background: '#12141a',
  surface: '#1a1d22',
  surfaceRaised: '#242830',
  border: '#3a4046',
  textPrimary: '#f3f5f7',
  textSecondary: '#b4b8bb',
  textMuted: '#767b80',
  accentOn: '#f3f5f7',
  mark: sharedRoles.brandSoft,
  thumbBg: '#2b2f38',
  thumbIcon: '#e7e9f5',
  success: '#61bd67',
  error: '#f05653',
  errorBorderDim: '#5c3230',
  errorTextDim: '#a15a58',
} as const;

// `success` and `error` darken here rather than being reused: at #61bd67 and
// #f05653 they carry only ~2.4:1 and ~3.5:1 against white, and both are used
// as small caption and mono text. The two opaque "dim" blends are re-tuned
// toward the light ground for the same reason.
const lightRoles = {
  background: '#f7f7f9',
  surface: '#ffffff',
  surfaceRaised: '#eef0f3',
  border: '#dcdfe4',
  textPrimary: '#14161a',
  textSecondary: '#4b4f56',
  textMuted: '#8b8f96',
  accentOn: '#ffffff',
  mark: sharedRoles.brandBright,
  thumbBg: '#ffffff',
  thumbIcon: '#b9840f',
  success: '#2f8f3e',
  error: '#c23934',
  errorBorderDim: '#e3b0ad',
  errorTextDim: '#b3625d',
} as const;

export const palettes: Record<ThemeName, Palette> = {
  dark: { ...sharedRoles, ...darkRoles },
  light: { ...sharedRoles, ...lightRoles },
};

// Temporary. Every consumer migrates to `useThemeColors()`; this alias only
// keeps the tree compiling until they have, and is deleted once they are.
export const colors = palettes.dark;
```

- [ ] **Step 4: Point `gradients` at the shared roles**

Immediately below, `gradients` still reads `colors.*`. Those are all theme-constant, so repoint them at `sharedRoles` — leaving them on `colors` would break in Task 9. Change the three `colors:` arrays only; leave `start`/`end` and the comment block untouched:

```ts
  mark: {
    colors: [sharedRoles.brandBright, sharedRoles.brandDeep],
```

```ts
  markSoft: {
    colors: [sharedRoles.accent, sharedRoles.brandLift],
```

```ts
  plate: {
    colors: [sharedRoles.brandPlateTop, sharedRoles.brandPlateBottom],
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run theme/tokens.test.ts design/handoff.test.ts`

Expected: PASS, both files. `design/handoff.test.ts` must stay green untouched — it re-exports via `export *`, so the new `palettes` flows through on its own.

- [ ] **Step 6: Verify the whole suite and typecheck**

Run: `npm run typecheck && npx vitest run`

Expected: PASS. Nothing else changed yet — `colors` still resolves.

- [ ] **Step 7: Commit**

```bash
npx prettier --write theme/tokens.ts theme/tokens.test.ts
git add theme/tokens.ts theme/tokens.test.ts
git commit -m "feat: add light and dark palettes to the token set"
```

---

### Task 2: Theme resolution

**Files:**

- Create: `theme/resolveTheme.ts`, `theme/resolveTheme.test.ts`, `theme/useTheme.ts`
- Modify: `stores/progress.ts:14-52`

**Interfaces:**

- Consumes: `ThemeName`, `ThemePreference`, `Palette`, `palettes` from Task 1.
- Produces: `resolveThemeName(preference: ThemePreference, systemScheme: 'light' | 'dark' | null | undefined): ThemeName`; `useThemeName(): ThemeName`; `useThemeColors(): Palette`; `useProgress` state gains `themePreference: ThemePreference` and `setThemePreference: (preference: ThemePreference) => void`.

**Why two files.** `resolveThemeName` is pure and unit-tested. The hooks import `react-native`, which Vitest's node environment cannot load. Putting them together would make the resolver untestable, so the split is a requirement rather than a preference.

**No `toggleTheme` on the store.** The spec named one, but the store cannot resolve `'system'` — that needs `useColorScheme()`, a React hook. The toggle component computes the next preference from the resolved name and calls `setThemePreference`. This is a deliberate correction to the spec.

- [ ] **Step 1: Write the failing test**

Create `theme/resolveTheme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveThemeName } from './resolveTheme';

describe('resolveThemeName', () => {
  it('honours an explicit preference over the system scheme', () => {
    expect(resolveThemeName('dark', 'light')).toBe('dark');
    expect(resolveThemeName('light', 'dark')).toBe('light');
  });

  it('follows the system scheme when the preference is "system"', () => {
    expect(resolveThemeName('system', 'light')).toBe('light');
    expect(resolveThemeName('system', 'dark')).toBe('dark');
  });

  it('falls back to dark when the system scheme is unknown', () => {
    // useColorScheme() reports null on platforms that cannot answer. Dark is
    // the app's original and only identity to date.
    expect(resolveThemeName('system', null)).toBe('dark');
    expect(resolveThemeName('system', undefined)).toBe('dark');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run theme/resolveTheme.test.ts`

Expected: FAIL — cannot resolve `./resolveTheme`.

- [ ] **Step 3: Write the resolver**

Create `theme/resolveTheme.ts`:

```ts
import type { ThemeName, ThemePreference } from './tokens';

// Deliberately free of React and react-native so it stays unit-testable —
// Vitest runs in a node environment and cannot load react-native. The hooks
// that wrap this live in ./useTheme.ts.
export function resolveThemeName(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): ThemeName {
  if (preference !== 'system') return preference;
  return systemScheme ?? 'dark';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run theme/resolveTheme.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Add the preference to the persisted store**

In `stores/progress.ts`, add the import, two interface members, the default, and the setter. The `ProgressState` interface gains:

```ts
  /** Appearance preference. `'system'` follows the device setting; an
   *  explicit value pins one theme. Survives `reset()`, which clears game
   *  progress only. */
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
```

Import the type alongside the existing imports:

```ts
import type { ThemePreference } from '@/theme/tokens';
```

Inside `persist((set) => ({ ... }))`, add the default beside `lastPlayed: null,`:

```ts
      themePreference: 'system',
```

and the setter beside `setLastPlayed`:

```ts
      setThemePreference: (themePreference) => set({ themePreference }),
```

Leave `reset()` exactly as it is. It must not clear `themePreference`.

No migration is needed for existing installs: Zustand's persist merges persisted state over the initial state, so a stored blob without `themePreference` leaves the `'system'` default in place.

- [ ] **Step 6: Write the hooks**

Create `theme/useTheme.ts`:

```ts
import { useColorScheme } from 'react-native';
import { useProgress } from '@/stores/progress';
import { resolveThemeName } from './resolveTheme';
import { palettes, type Palette, type ThemeName } from './tokens';

/** The resolved theme. Needed directly only where the *name* matters — the
 *  navigation theme, the status bar, the toggle's glyph. */
export function useThemeName(): ThemeName {
  const preference = useProgress((s) => s.themePreference);
  const systemScheme = useColorScheme();
  return resolveThemeName(preference, systemScheme);
}

/** The active palette. The hook every styled component uses. */
export function useThemeColors(): Palette {
  return palettes[useThemeName()];
}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npx vitest run`

Expected: PASS. Nothing consumes the hooks yet.

- [ ] **Step 8: Commit**

```bash
npx prettier --write theme/resolveTheme.ts theme/resolveTheme.test.ts theme/useTheme.ts stores/progress.ts
git add theme/resolveTheme.ts theme/resolveTheme.test.ts theme/useTheme.ts stores/progress.ts
git commit -m "feat: resolve a theme from a persisted preference and the system scheme"
```

---

### Task 3: Native shell and root layout

**Files:**

- Modify: `app.json:9`, `app.json:15`, `app.json:29-38`, `app.json:49`
- Modify: `app/_layout.tsx` (whole file)

**Interfaces:**

- Consumes: `useThemeName`, `useThemeColors` from Task 2; `useProgressHydrated` from `stores/progress.ts` (already exported).
- Produces: nothing consumed by later tasks.

**This task contains the feature's only silent failure mode.** `userInterfaceStyle: "dark"` locks the app to dark and pins `useColorScheme()` to `'dark'` on every device, so the system-following default would never fire and nothing would report an error. It must become `"automatic"`.

- [ ] **Step 1: Update `app.json`**

Four edits. Change `"userInterfaceStyle": "dark"` to:

```json
    "userInterfaceStyle": "automatic",
```

Change the Android adaptive icon background (`app.json:15`) and the top-level `backgroundColor` (`app.json:49`) from `"#07090b"` to `"#12141a"`.

Replace the `expo-splash-screen` plugin options so the base is light and the `dark` variant is dark. `splash-icon.png` is the mark on a fully transparent ground, its gradient running `#5961d2` to `#393f97` — deep enough to hold against near-white, bright enough against near-black — so no new asset is needed:

```json
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#f7f7f9",
          "dark": {
            "backgroundColor": "#12141a"
          }
        }
      ],
```

- [ ] **Step 2: Rewrite the root layout**

Replace the whole of `app/_layout.tsx`. Note the module-scope `navTheme` and the dark-only comment both go, and every hook is called before the early return:

```tsx
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useProgressHydrated } from '@/stores/progress';
import { fontAssets } from '@/theme/fonts';
import { useThemeColors, useThemeName } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const hydrated = useProgressHydrated();
  const themeName = useThemeName();
  const colors = useThemeColors();

  // Hold the splash until the type is ready, otherwise the first frame renders
  // in the system font and visibly reflows — and until the persisted
  // preference is back, otherwise someone pinned to light gets a dark frame
  // that flips on every launch.
  const ready = (fontsLoaded || fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const isDark = themeName === 'dark';
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.error,
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 4: Verify on device**

Run `npx expo start -c` and open in Expo Go. Set the phone to **light** appearance. The root background and status bar must follow it; screen content stays dark for now, since no component is migrated yet. Set the phone back to dark and confirm it follows.

If the app stays dark on a light phone, `userInterfaceStyle` did not take — confirm the value in `app.json` and restart with `-c`.

- [ ] **Step 5: Commit**

```bash
npx prettier --write app/_layout.tsx app.json
git add app/_layout.tsx app.json
git commit -m "feat: follow the system appearance in the native shell and root layout"
```

---

### Task 4: The toggle, and Home

**Files:**

- Create: `components/ThemeToggle.tsx`
- Modify: `theme/tokens.ts` (add to `durations` and `sizes`)
- Modify: `app/index.tsx` (whole file's styles, plus the toggle row)

**Interfaces:**

- Consumes: `useThemeName`, `useThemeColors`, `useProgress`.
- Produces: `<ThemeToggle />`, taking no props. `sizes.themeToggle`, `sizes.themeToggleGlyph`, `durations.toggle`.

Doing this now rather than last means every later migration batch can be verified by tapping the toggle and looking at the screen.

- [ ] **Step 1: Add the toggle's tokens**

In `theme/tokens.ts`, add to `durations` (the mock's 160ms, inside the 300ms budget):

```ts
  toggle: 160,
```

Add to `sizes`:

```ts
  // The theme toggle. `inset` is the gap between track edge and thumb, so the
  // thumb's travel is track.width - thumb - inset * 2.
  themeToggle: { trackWidth: 52, trackHeight: 30, thumb: 24, inset: 2 },
  // The toggle's glyphs. The moon is a disc with an offset disc punched out
  // of it in the thumb's own colour — `moonCutoutTop`/`moonCutoutLeft` place
  // that punch-out, and are what give the crescent its lean. The sun is a
  // core disc with four rays at `sunRayOffset` from centre.
  themeToggleGlyph: {
    moon: 13,
    moonCutout: 11,
    moonCutoutTop: -3,
    moonCutoutLeft: 3,
    sunCore: 10,
    sunRay: 3,
    sunRayOffset: 6,
  },
```

- [ ] **Step 2: Write the toggle**

Create `components/ThemeToggle.tsx`:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useProgress } from '@/stores/progress';
import { borderWidths, durations, radii, sizes } from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';

const { trackWidth, trackHeight, thumb, inset } = sizes.themeToggle;
const TRAVEL = trackWidth - thumb - inset * 2;

// Tapping writes an explicit preference — there is deliberately no way back to
// 'system' from a two-state switch, and no Settings screen to put a third
// control on.
export function ThemeToggle() {
  const colors = useThemeColors();
  const isDark = useThemeName() === 'dark';
  const setThemePreference = useProgress((s) => s.setThemePreference);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withTiming(isDark ? TRAVEL : 0, {
          duration: durations.toggle,
          easing: Easing.out(Easing.quad),
        }),
      },
    ],
  }));

  const g = sizes.themeToggleGlyph;

  return (
    <Pressable
      testID="theme-toggle"
      onPress={() => setThemePreference(isDark ? 'light' : 'dark')}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel="Dark theme"
      style={[styles.track, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
    >
      <Animated.View style={[styles.thumb, { backgroundColor: colors.thumbBg }, thumbStyle]}>
        {isDark ? (
          <View
            style={[
              styles.moon,
              { width: g.moon, height: g.moon, borderRadius: g.moon / 2 },
              { backgroundColor: colors.thumbIcon },
            ]}
          >
            <View
              style={[
                styles.moonCutout,
                { width: g.moonCutout, height: g.moonCutout, borderRadius: g.moonCutout / 2 },
                { backgroundColor: colors.thumbBg },
              ]}
            />
          </View>
        ) : (
          <View
            style={[
              styles.sunCore,
              { width: g.sunCore, height: g.sunCore, borderRadius: g.sunCore / 2 },
              { backgroundColor: colors.thumbIcon },
            ]}
          >
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <View
                key={side}
                style={[
                  styles.sunRay,
                  {
                    width: g.sunRay,
                    height: g.sunRay,
                    borderRadius: g.sunRay / 2,
                    backgroundColor: colors.thumbIcon,
                  },
                  side === 'top' && { top: -g.sunRayOffset, left: (g.sunCore - g.sunRay) / 2 },
                  side === 'bottom' && {
                    bottom: -g.sunRayOffset,
                    left: (g.sunCore - g.sunRay) / 2,
                  },
                  side === 'left' && { left: -g.sunRayOffset, top: (g.sunCore - g.sunRay) / 2 },
                  side === 'right' && { right: -g.sunRayOffset, top: (g.sunCore - g.sunRay) / 2 },
                ]}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// Geometry only — every colour is applied inline from the active palette.
const styles = StyleSheet.create({
  track: {
    width: trackWidth,
    height: trackHeight,
    borderRadius: radii.pill,
    borderWidth: borderWidths.hairline,
    padding: inset,
    justifyContent: 'center',
  },
  thumb: {
    width: thumb,
    height: thumb,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moon: { overflow: 'hidden' },
  moonCutout: {
    position: 'absolute',
    top: sizes.themeToggleGlyph.moonCutoutTop,
    left: sizes.themeToggleGlyph.moonCutoutLeft,
  },
  sunCore: { position: 'relative' },
  sunRay: { position: 'absolute' },
});
```

- [ ] **Step 3: Put the toggle on Home and migrate the screen**

In `app/index.tsx`: add the imports, drop `colors` from the token import, call the hook, move `StyleSheet.create` into the component, and add a toggle row above the brand block.

Add to the imports:

```tsx
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThemeColors } from '@/theme/useTheme';
```

Remove `colors,` from the `@/theme/tokens` import list. At the top of `export default function Home()`, after the existing hook calls, add:

```tsx
const colors = useThemeColors();
```

Move the entire `const styles = StyleSheet.create({...})` block from the bottom of the file to inside `Home`, directly above `return (`, unchanged apart from its position. Then add the toggle row as the first child of the root `<View>`, above `<View style={styles.brandBlock}>`:

```tsx
<View style={styles.toggleRow}>
  <ThemeToggle />
</View>
```

and add its style to the moved stylesheet:

```tsx
    toggleRow: { alignItems: 'flex-end' },
```

The mock's `paddingTop: 70` is the design tool clearing a simulated status bar. Do not copy it — `app/index.tsx` already applies `insets.top + spacing.xl`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 5: Verify on device**

Run `npx expo start -c`, open Home in Expo Go, and tap the toggle. The background, the continue card, the wordmark and both buttons must switch; other screens stay dark until Tasks 5–8. Confirm the thumb slides rather than jumping, and that force-quitting and relaunching keeps the chosen theme.

- [ ] **Step 6: Commit**

```bash
npx prettier --write components/ThemeToggle.tsx app/index.tsx theme/tokens.ts
git add components/ThemeToggle.tsx app/index.tsx theme/tokens.ts
git commit -m "feat: add the theme toggle to Home"
```

---

### Task 5: Migrate the shared primitives

**Files:**

- Modify: `components/Button.tsx`, `components/Flag.tsx`, `components/LockGlyph.tsx`, `components/Skeleton.tsx`, `components/VerdictGlyph.tsx`, `components/FilterPill.tsx`, `components/SegmentedControl.tsx`

**Interfaces:**

- Consumes: `useThemeColors` from Task 2.
- Produces: no signature changes. Every component keeps its existing props.

**The recipe.** Drop `colors` from the `@/theme/tokens` import (keep the other tokens — `spacing`, `typography`, `radii` and friends are theme-constant and stay at module scope). Import `useThemeColors` from `@/theme/useTheme`. Call it at the **top of the component body, above any early return**. Move the component's `StyleSheet.create` block from module scope into the body, directly above the `return`.

**No manual `useMemo`.** `app.json` sets `experiments.reactCompiler: true`, so the compiler memoises this automatically. Hand-written memoisation would duplicate what the build already does.

- [ ] **Step 1: Migrate `components/Button.tsx` as the worked example**

Change the import line from:

```tsx
import { colors, opacity, radii, sizes, typography } from '@/theme/tokens';
```

to:

```tsx
import { opacity, radii, sizes, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
```

`Button` has an early return for `variant === 'text'`, so the hook and the stylesheet must both come before it:

```tsx
export function Button({ label, variant, onPress, disabled, large }: ButtonProps) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    pressed: { opacity: opacity.settled },
    control: {
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filled: { backgroundColor: colors.accent },
    outline: { borderWidth: 1, borderColor: colors.border },
    inert: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    label: { ...typography.body },
    filledLabel: { color: colors.accentOn },
    outlineLabel: { color: colors.textSecondary },
    inertLabel: { color: colors.textMuted },
    textLabel: { ...typography.secondary, color: colors.textSecondary, textAlign: 'center' },
  });

  if (variant === 'text') {
    // ...unchanged
```

Delete the module-scope `const styles = StyleSheet.create({...});` at the bottom of the file. The JSX is untouched.

- [ ] **Step 2: Apply the same recipe to the remaining six**

`Flag.tsx`, `LockGlyph.tsx`, `Skeleton.tsx`, `VerdictGlyph.tsx`, `FilterPill.tsx`, `SegmentedControl.tsx`. Two carry colour outside the stylesheet and need the hook's `colors` in scope there too, which it will be:

- `VerdictGlyph.tsx:24` — `color ?? (correct ? colors.success : colors.errorTextDim)`
- `SegmentedControl.tsx:28` — `active ? colors.accentOn : colors.textMuted`

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`

Expected: PASS. A file that still imports `colors` also typechecks for now, because the Task 1 alias is still exported — so grep to confirm the batch is actually complete. The pattern covers both single-line and multi-line import blocks:

Run: `grep -rlE "^[[:space:]]*colors,[[:space:]]*$|import \{.*\bcolors\b.*\} from '@/theme/tokens'" components/ app/`

Expected: 20 files remain, none of them from this batch's seven. It reads 27 before this task and drops to zero by Task 9, which is where typecheck becomes the authoritative check.

- [ ] **Step 4: Verify on device**

Reload Expo Go, toggle the theme on Home, then navigate to the team picker. The "Browse All Teams" and "Start Training" buttons, the filter pills and the segmented control must all follow the theme.

- [ ] **Step 5: Commit**

```bash
npx prettier --write components/Button.tsx components/Flag.tsx components/LockGlyph.tsx components/Skeleton.tsx components/VerdictGlyph.tsx components/FilterPill.tsx components/SegmentedControl.tsx
git add components/Button.tsx components/Flag.tsx components/LockGlyph.tsx components/Skeleton.tsx components/VerdictGlyph.tsx components/FilterPill.tsx components/SegmentedControl.tsx
git commit -m "refactor: migrate shared primitives to the active palette"
```

---

### Task 6: Migrate the round UI

**Files:**

- Modify: `components/AnswerOption.tsx`, `components/ChipOption.tsx`, `components/ProgressDots.tsx`, `components/PartRail.tsx`, `components/CompletedPartPill.tsx`, `components/StatChip.tsx`, `components/HeroCard.tsx`

**Interfaces:**

- Consumes: `useThemeColors`, and `Palette` as a parameter type.
- Produces: no signature changes to any exported component.

This batch holds the two shapes that are not a plain stylesheet.

- [ ] **Step 1: Migrate the verdict lookup records**

`AnswerOption.tsx` has four module-scope `Record<OptionVerdict, ...>` maps built from `colors`. Three carry colour and must become functions of the palette; `VERDICT_OPACITY` holds numbers only and stays exactly where it is at module scope.

Replace the three colour maps with:

```tsx
const verdictBg = (colors: Palette): Record<OptionVerdict, string> => ({
  idle: colors.surface,
  'correct-picked': colors.successBg,
  'correct-unpicked': colors.successBg,
  'incorrect-picked': colors.surface, // background fades to transparent via opacity below
  'incorrect-other': colors.surface,
});
const verdictBorder = (colors: Palette): Record<OptionVerdict, string> => ({
  idle: colors.border,
  'correct-picked': colors.success,
  'correct-unpicked': colors.success,
  'incorrect-picked': colors.errorBorderDim,
  'incorrect-other': colors.border,
});
const verdictText = (colors: Palette): Record<OptionVerdict, string> => ({
  idle: colors.textPrimary,
  'correct-picked': colors.success,
  'correct-unpicked': colors.success,
  'incorrect-picked': colors.errorTextDim,
  'incorrect-other': colors.textMuted,
});
```

Import the type: `import { ..., type Palette } from '@/theme/tokens';`

In the component body, after `const colors = useThemeColors();`, build them once:

```tsx
const VERDICT_BG = verdictBg(colors);
const VERDICT_BORDER = verdictBorder(colors);
const VERDICT_TEXT = verdictText(colors);
```

Keeping the existing local names means the JSX below is untouched.

Apply the identical treatment to `ChipOption.tsx`, whose maps are keyed the same way.

- [ ] **Step 2: Migrate the style helper function**

`ProgressDots.tsx` has `function dotStyle(outcome: DotOutcome)` reading `colors` from module scope. Give it the palette as a parameter:

```tsx
function dotStyle(outcome: DotOutcome, colors: Palette) {
  switch (outcome) {
    case 'correct':
      return { backgroundColor: colors.success, opacity: opacity.dotPast };
    case 'wrong':
      return { backgroundColor: colors.error, opacity: opacity.dotPast };
    case 'current':
      return { backgroundColor: colors.accent, opacity: 1 };
    case 'future':
      return { backgroundColor: colors.border, opacity: opacity.dotFuture };
  }
}
```

Update its call site in the component to pass `colors`. `ProgressDots`'s own `styles` block carries no colour — leave it at module scope.

- [ ] **Step 3: Apply the plain recipe to the remaining four**

`PartRail.tsx`, `CompletedPartPill.tsx`, `StatChip.tsx`, `HeroCard.tsx`: drop `colors` from the tokens import, add `useThemeColors`, move `StyleSheet.create` into the body above the `return`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 5: Verify on device**

Reload Expo Go. Set light, start a **level 3** round, and answer one question **wrong** to trigger the full incorrect reveal. Check that the picked-wrong option, the correct-unpicked option, the faded other options, the part rail and the progress dots are all legible. Per the spec's watch item, `opacity.faded` (0.4) and `opacity.dimmed` (0.65) were tuned against near-black and fade toward white here. If something is unreadable, report it rather than re-tuning the opacity tokens — they are shared with dark.

- [ ] **Step 6: Commit**

```bash
npx prettier --write components/AnswerOption.tsx components/ChipOption.tsx components/ProgressDots.tsx components/PartRail.tsx components/CompletedPartPill.tsx components/StatChip.tsx components/HeroCard.tsx
git add components/AnswerOption.tsx components/ChipOption.tsx components/ProgressDots.tsx components/PartRail.tsx components/CompletedPartPill.tsx components/StatChip.tsx components/HeroCard.tsx
git commit -m "refactor: migrate the round UI to the active palette"
```

---

### Task 7: Migrate rows, the ladder and the lockup

**Files:**

- Modify: `components/TeamRow.tsx`, `components/StudyRow.tsx`, `components/DifficultyRow.tsx`, `components/LadderConnector.tsx`, `components/ScorePill.tsx`, `components/Wordmark.tsx`

**Interfaces:**

- Consumes: `useThemeColors`.
- Produces: no signature changes.

- [ ] **Step 1: Switch the wordmark to the `mark` role**

`components/Wordmark.tsx` passes `colors.brandSoft` to the mark in two places (lines 48 and 50). That value is the brand ramp's pale end — right on near-black, weak on near-white. Both become `colors.mark`, which resolves per theme:

```tsx
<EscuadraStrike size={size} color={colors.mark} timing={strikeTiming.home} />
```

```tsx
<EscuadraMark size={size} color={colors.mark} showTrail={showTrail} />
```

Then apply the standard recipe: drop `colors` from the tokens import, add `useThemeColors`, move the `styles` block into the body.

- [ ] **Step 2: Apply the recipe to the remaining five**

`TeamRow.tsx`, `StudyRow.tsx`, `DifficultyRow.tsx`, `LadderConnector.tsx`, `ScorePill.tsx`. Three use colour outside their stylesheet and need `colors` in body scope:

- `DifficultyRow.tsx:69` and `:71` — `colors.accentOn`
- `LadderConnector.tsx:21` — `active ? colors.accent : colors.border`

`TeamMarker.tsx` is **not** in this batch and must not be touched: it renders a squad's real identity colours, which are content, not design tokens.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 4: Verify on device**

Reload Expo Go in light. On the team picker, confirm rows, their progress sub-lines and the score pills read correctly, and that each team's colour marker is unchanged — team identity colour must not shift with the theme. On the difficulty ladder, confirm the connector between rungs and the locked-row treatment. On Home, confirm the wordmark now uses the deeper mark colour and holds against the light ground.

- [ ] **Step 5: Commit**

```bash
npx prettier --write components/TeamRow.tsx components/StudyRow.tsx components/DifficultyRow.tsx components/LadderConnector.tsx components/ScorePill.tsx components/Wordmark.tsx
git add components/TeamRow.tsx components/StudyRow.tsx components/DifficultyRow.tsx components/LadderConnector.tsx components/ScorePill.tsx components/Wordmark.tsx
git commit -m "refactor: migrate rows, ladder and lockup to the active palette"
```

---

### Task 8: Migrate the remaining screens

**Files:**

- Modify: `app/team-picker.tsx`, `app/team/[squadId]/difficulty.tsx`, `app/team/[squadId]/study.tsx`, `app/play/[squadId]/[level]/index.tsx`, `app/play/[squadId]/[level]/results.tsx`

**Interfaces:**

- Consumes: `useThemeColors`.
- Produces: no route or prop changes.

- [ ] **Step 1: Apply the recipe to all five**

For each screen: drop `colors` from the `@/theme/tokens` import list, keeping every other token there (`spacing`, `typography`, `radii` and friends are theme-constant and stay at module scope). Add:

```tsx
import { useThemeColors } from '@/theme/useTheme';
```

Call the hook at the top of the default-exported component, above any early return:

```tsx
const colors = useThemeColors();
```

Move the file's `const styles = StyleSheet.create({...})` block from module scope into the component body, directly above `return (`, otherwise unchanged. Delete the module-scope copy. The JSX itself does not change.

Do not add `useMemo` — `experiments.reactCompiler` is enabled and memoises this already.

`results.tsx` is the heaviest, with 17 references. Two are outside its stylesheet and need `colors` in body scope:

- `results.tsx:196` — `color={tier === 'excellent' ? colors.success : colors.accent}`
- `results.tsx:197` — `ballColor={colors.success}`

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 3: Verify on device**

Reload Expo Go in light and walk a full round end to end: picker → difficulty → play → results. On results, check all three tiers if you can reach them — the celebration mark is drawn from the palette and the missed-players list uses `error`.

- [ ] **Step 4: Commit**

```bash
npx prettier --write app/team-picker.tsx "app/team/[squadId]/difficulty.tsx" "app/team/[squadId]/study.tsx" "app/play/[squadId]/[level]/index.tsx" "app/play/[squadId]/[level]/results.tsx"
git add app/team-picker.tsx "app/team/[squadId]/difficulty.tsx" "app/team/[squadId]/study.tsx" "app/play/[squadId]/[level]/index.tsx" "app/play/[squadId]/[level]/results.tsx"
git commit -m "refactor: migrate remaining screens to the active palette"
```

---

### Task 9: Remove the `colors` alias

**Files:**

- Modify: `theme/tokens.ts` (delete the temporary alias)

**Interfaces:**

- Consumes: nothing.
- Produces: `colors` no longer exists. `palettes` is the only colour export.

This is the migration's proof. With the alias gone, any file still reading a module-scope palette fails to compile rather than silently rendering dark forever.

- [ ] **Step 1: Delete the alias**

Remove these three lines from `theme/tokens.ts`:

```ts
// Temporary. Every consumer migrates to `useThemeColors()`; this alias only
// keeps the tree compiling until they have, and is deleted once they are.
export const colors = palettes.dark;
```

- [ ] **Step 2: Run typecheck as the completeness check**

Run: `npm run typecheck`

Expected: PASS. Any error of the form `Module '"@/theme/tokens"' has no exported member 'colors'` names a file Tasks 4–8 missed. Migrate it with the Task 5 recipe and re-run until clean.

- [ ] **Step 3: Confirm no module-scope palette import remains**

Run: `grep -rlE "^[[:space:]]*colors,[[:space:]]*$|import \{.*\bcolors\b.*\} from '@/theme/tokens'" components/ app/`

Expected: no output. This read 27 files before Task 5.

- [ ] **Step 4: Run the full gate**

Run: `npm run check`

Expected: PASS throughout — typecheck, lint, format, tests, registry check, and the generated-file diff.

- [ ] **Step 5: Commit**

```bash
npx prettier --write theme/tokens.ts
git add theme/tokens.ts
git commit -m "refactor: drop the static colors export"
```

---

### Task 10: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md` — the v0 checklist, hard constraint #5, Architecture rules, Environment, Current state

**Interfaces:**

- Consumes: nothing.
- Produces: nothing.

Both themes ship in the first release, so the project's own instructions change with the code rather than after it.

- [ ] **Step 1: Add the v0 definition-of-done item**

In the `## v0 — definition of done` list, after the "Best score per team-and-level persisted locally" line:

```markdown
- [ ] Light and dark themes, following the device setting by default, with a toggle on Home
```

- [ ] **Step 2: Extend hard constraint #5**

Append to constraint 5, after the existing sentence about adding a missing token:

```markdown
Colour specifically comes from the **active palette** via `useThemeColors()`
— never a module-scope capture. `StyleSheet.create` at module scope is
evaluated once at import, so a component built that way looks correct and
silently ignores the theme. Both palettes in `theme/tokens.ts` implement the
same `Palette` interface; add a role to both or to neither.
```

- [ ] **Step 3: Add the theming rule to Architecture rules**

Add a bullet to `## Architecture rules`:

```markdown
- **Theming is two palettes and a hook.** `theme/tokens.ts` holds `palettes.dark`
  and `palettes.light`; `theme/resolveTheme.ts` is the pure preference-to-name
  resolver (kept React-free so Vitest, which runs in a node environment, can
  test it); `theme/useTheme.ts` exposes `useThemeName()` and `useThemeColors()`.
  The persisted preference lives in `stores/progress.ts` — it is not a third
  store.
```

- [ ] **Step 4: Record the Environment gotcha**

Add to the `## Environment` section, after the SDK-pinning warning:

```markdown
⚠️ **`userInterfaceStyle` in `app.json` must stay `"automatic"`.** Pinning it to
`"dark"` or `"light"` locks the app to that theme and makes `useColorScheme()`
return the same value on every device, so the system-following default silently
never fires — with no error to trace it by. This is the one theming failure that
compiles, passes tests, and looks correct on a matching phone.
```

- [ ] **Step 5: Drop the stale dark-only claim**

In `## Current state`, the line "Design tokens from the design pass are in the repo" now understates it. Replace with:

```markdown
Design tokens from the design pass are in the repo, in both a light and a dark
palette.
```

- [ ] **Step 6: Verify**

Run: `npm run format:check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npx prettier --write CLAUDE.md
git add CLAUDE.md
git commit -m "docs: record light/dark theming in the project instructions"
```

---

### Task 11: Regenerate the design handoff and verify

**Files:**

- Modify: `design/screens/*.png`

**Interfaces:**

- Consumes: the finished feature.
- Produces: the handoff surface the design side reads.

- [ ] **Step 1: Regenerate the captures**

Run: `npm run shots`

Expected: the six screens captured into `design/screens/`. Every one changes — the dark ramp lifted in Task 1, so this is required regardless of the light theme.

- [ ] **Step 2: Eyeball the output**

Open the regenerated PNGs. They should show the lifted dark ramp, with the mark's two trail squares now visibly separated from the background rather than sunk into it. That separation is the design source's stated reason for the lift.

- [ ] **Step 3: Full device verification**

Run `npx expo start -c` and check all three cases on a physical iPhone via Expo Go:

1. **Fresh install, light phone.** Delete the app from Expo Go first so no preference is stored. It must launch light — this is the path `userInterfaceStyle: "automatic"` enables, and the one that fails silently if it was missed.
2. **Live system change.** With no explicit preference set, change the phone's appearance while the app is open. The app must follow without a restart.
3. **Explicit override survives a restart.** Tap the toggle to pin the theme opposite the phone's setting, force-quit, relaunch. The app must come back on the pinned theme with no flash of the other one.

- [ ] **Step 4: Run the full gate**

Run: `npm run check`

Expected: PASS. Report the actual output.

- [ ] **Step 5: Commit**

```bash
git add design/screens
git commit -m "chore: regenerate design screens for the lifted dark ramp and light theme"
```

---

## Done when

- `npm run check` passes.
- A fresh install on a light phone launches light; on a dark phone, dark.
- The toggle on Home switches every screen, and the choice survives a restart.
- No file imports a colour from module scope — `colors` no longer exists.
- CLAUDE.md lists both themes as a v0 release item.
