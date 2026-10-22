# Settings Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Settings screen reached from a gear on Home, holding language, appearance,
vibration, usage statistics, Rate, Coming next, the About links and the version line; Home
and About lose the controls it takes over.

**Architecture:** One new route (`app/settings.tsx`) built from small components
(`SettingsSection`, `SettingsRow`, `AppearanceControl`, `SettingsGlyphs`), reading the
existing `useProgress` preferences. Pure logic (the store URL, the version line) lives in
`lib/` with Vitest tests. Text lives in a new `settings` namespace of every catalog.

**Tech Stack:** Expo SDK 57, expo-router, React Native 0.86, Zustand, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-10-22-settings-screen-design.md` (issue #175). Read
it before any task.

## Global Constraints

- Run `nvm use` first in every shell (Node 24). Open project files with the Read tool, not
  `cat`, so `.claude/rules/` load.
- Guardrail 5: no hard-coded colour, spacing or font size. Colour comes from
  `useThemeColors()`; any missing value becomes a token in `theme/tokens.ts`, a colour in
  **both** palettes.
- Never build a `StyleSheet.create` that uses colours at module scope.
- User-visible text only through `useT()`; `npm run lint` fails a hard-coded string in
  `app/` or `components/`.
- Every new `≤ N chars` comment in `i18n/en.ts` has an entry in `i18n/budgets.ts`, in file
  order.
- No new telemetry event or property, no new network call by the app, no new dependency,
  no change to `app.json`.
- Animations: nothing new animates.
- Commit after each task with a conventional message ending in
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; reference `(#175)`.
- Tests live in `__tests__/` folders mirroring the code (`lib/__tests__/…`).
- TypeScript strict with `noUncheckedIndexedAccess`; never weaken it.

---

### Task 1: Tokens for Settings

**Files:**

- Modify: `theme/tokens.ts`

**Interfaces:**

- Produces: palette roles `switchThumb`, `soonBg`, `plateMark`; `typography.settingsTitle`,
  `typography.settingsSection`, `typography.settingsLabel`, `typography.settingsAction`,
  `typography.soonChip`; `sizes.settings` (below); `radii.settingsCard`.

- [ ] **Step 1: Add the roles.** In `interface Palette`, after `hairline`, add:

```ts
// ---- 2.0 Settings (#175) ----
/** A settings switch's thumb, in either state. */
switchThumb: string;
/** The SOON chip's fill on Coming next. Translucent. */
soonBg: string;
/** The Escuadra mark on the brand plate (Settings' Rate card). */
plateMark: string;
```

In `sharedRoles` add `switchThumb: '#ffffff',` and `plateMark: '#e7e9f5',`. In `darkRoles`
add `soonBg: 'rgba(255,255,255,0.08)',`; in `lightRoles` add `soonBg: 'rgba(20,22,26,0.06)',`.

- [ ] **Step 2: Add typography**, after `filterCount`:

```ts
  // ---- 2.0 Settings (#175) ----
  settingsTitle: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.4,
    textTransform: 'uppercase' as const,
  },
  settingsSection: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  settingsLabel: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 16 },
  settingsAction: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  soonChip: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
```

- [ ] **Step 3: Add sizes.** In `sizes`, after `shareSheet`, add:

```ts
  // Settings (#175): its rows, the round buttons (Settings' back, Home's gear),
  // the row glyphs, the Rate card's plate and button, the Appearance segments.
  settings: {
    row: 60,
    linkRow: 56,
    roundButton: 44,
    glyph: 20,
    chevron: 16,
    plate: 48,
    plateMark: 30,
    footerMark: 18,
    rateButton: 40,
    segment: 40,
  },
```

In `radii`, after `card`, add `settingsCard: 22, // Settings' cards`.

- [ ] **Step 4: Verify.** Run `npm run typecheck && npx vitest run theme`. Expected: PASS
      (the theme tests iterate palettes; both have the new roles).

- [ ] **Step 5: Commit.** `git commit -am "feat(theme): tokens for the Settings screen (#175)"`

---

### Task 2: Store page URL and the version line's new home

**Files:**

- Modify: `lib/reviewPrompt.ts`, `lib/storeReview.ts`
- Test: `lib/__tests__/reviewPrompt.test.ts`
- Rename: `lib/aboutView.ts` → `lib/settingsView.ts`, `lib/__tests__/aboutView.test.ts` →
  `lib/__tests__/settingsView.test.ts` (`git mv`)

**Interfaces:**

- Produces: `storePageUrl(os: string): string | null` (from `@/lib/reviewPrompt`);
  `openStorePage(): void` (from `@/lib/storeReview`); `versionLabel` and `UpdateState`
  from `@/lib/settingsView` (same signatures as today). Task 3 moves the strings it
  reads to `messages.settings.version` / `messages.settings.builtIn`.

- [ ] **Step 1: Write the failing test.** Append to `lib/__tests__/reviewPrompt.test.ts`
      (add `storePageUrl` to its import from `../reviewPrompt`):

```ts
describe('storePageUrl', () => {
  it("opens the App Store's write-a-review page on iOS", () => {
    expect(storePageUrl('ios')).toBe('https://apps.apple.com/app/id6810705505?action=write-review');
  });

  it('opens the Play listing on Android', () => {
    expect(storePageUrl('android')).toBe(
      'https://play.google.com/store/apps/details?id=com.tovmassian.escuadra',
    );
  });

  it('has no store on web', () => {
    expect(storePageUrl('web')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it.** `npx vitest run lib/__tests__/reviewPrompt.test.ts`. Expected:
      FAIL, `storePageUrl` is not exported.

- [ ] **Step 3: Implement.** Append to `lib/reviewPrompt.ts`:

```ts
// Settings' Rate button (#175) opens the store's own page rather than asking the OS for
// its rationed dialog, so it always does something. The App Store id is the listing's
// (README.md); the Play id is the app's package in app.json.
const APP_STORE_REVIEW = 'https://apps.apple.com/app/id6810705505?action=write-review';
const PLAY_LISTING = 'https://play.google.com/store/apps/details?id=com.tovmassian.escuadra';

/** The store page Rate opens on this OS (`Platform.OS`), or null where there is none. */
export function storePageUrl(os: string): string | null {
  if (os === 'ios') return APP_STORE_REVIEW;
  if (os === 'android') return PLAY_LISTING;
  return null;
}
```

Append to `lib/storeReview.ts` (add `Linking` to the `react-native` import, and
`storePageUrl` to the `./reviewPrompt` import), and add one sentence to its header
comment: "Settings' Rate button opens the store page through `openStorePage`."

```ts
/** Settings' Rate button: the store's page for Escuadra. Fire and forget. */
export function openStorePage(): void {
  const url = storePageUrl(Platform.OS);
  if (url === null) return;
  Linking.openURL(url).catch(() => {});
}
```

- [ ] **Step 4: Run it.** Same command. Expected: PASS.

- [ ] **Step 5: Move the version line's model.** `git mv lib/aboutView.ts lib/settingsView.ts`
      and `git mv lib/__tests__/aboutView.test.ts lib/__tests__/settingsView.test.ts`. In the
      test, import from `../settingsView`. In `lib/settingsView.ts`, the header comment says
      "Pure model for the Settings screen's version line", and the doc comment says "Settings'
      version line". In `app/about.tsx`, import `versionLabel` from `@/lib/settingsView` (Task
      6 removes it from About). Run `npm run typecheck && npx vitest run lib`. Expected: PASS.

- [ ] **Step 6: Commit.** `git add -A lib app/about.tsx && git commit -m "feat(settings): the store page Rate opens; the version line's model moves to settingsView (#175)"`

---

### Task 3: English text, budgets and the four translations

**Files:**

- Modify: `i18n/en.ts`, `i18n/de.ts`, `i18n/es.ts`, `i18n/fr.ts`, `i18n/it.ts`,
  `i18n/budgets.ts`, `i18n/__tests__/catalogs.test.ts`, `lib/settingsView.ts`,
  `lib/__tests__/settingsView.test.ts`, `app/about.tsx`, `components/LanguageChip.tsx`

**Interfaces:**

- Produces: `t.home.settings`, and `t.settings.*` exactly as below. Later tasks read these
  names.

- [ ] **Step 1: English.** In `i18n/en.ts`:
  - Change `const USAGE_STATISTICS = 'Share anonymous usage statistics';` to
    `const USAGE_STATISTICS = 'Usage statistics';`.
  - In `home`, replace `aboutLink`, `darkTheme` and `languageLabel` with:

```ts
    /** The gear button's spoken name. */
    settings: 'Settings',
```

- Between `languageSheet` and `formats`, add:

```ts
  settings: {
    /** ≤ 16 chars: the screen's title, in Archivo capitals. */
    title: 'Settings',
    /** ≤ 16 chars: a section's label, in IBM Plex Mono capitals. */
    sections: {
      play: 'Play',
      privacy: 'Privacy',
      support: 'Support',
      comingNext: 'Coming next',
      about: 'About',
    },
    /** ≤ 20 chars: the Language row. */
    language: 'Language',
    /** The Language row, spoken, with the current language in its own name: "Language: English". */
    languageSpoken: (name: string) => `Language: ${name}`,
    /** ≤ 20 chars: the Appearance row, and the control's spoken name. */
    appearance: 'Appearance',
    /** ≤ 12 chars: an Appearance option. */
    appearanceOptions: { system: 'Match phone', dark: 'Dark', light: 'Light' },
    /** ≤ 20 chars: the row's label and the switch's spoken name. */
    vibration: 'Vibration',
    /** ≤ 24 chars: the row's label and the switch's spoken name. */
    usageStatistics: USAGE_STATISTICS,
    /** ≤ 56 chars: the line under Usage statistics. */
    usageNote: 'Anonymous. About says exactly what is sent.',
    rate: {
      /** ≤ 24 chars: the Rate card's title. */
      title: `Rate ${ESCUADRA}`,
      /** ≤ 48 chars: the line under it. */
      line: 'A rating helps other fans find it.',
      /** ≤ 10 chars: the button, in Archivo capitals. */
      button: 'Rate',
    },
    examMode: {
      /** ≤ 20 chars: Coming next's title. */
      title: 'Exam mode',
      /** ≤ 56 chars: the line under it. */
      line: 'The whole squad, on shirt numbers alone.',
      /** ≤ 8 chars: the chip, in IBM Plex Mono capitals. */
      soon: 'Soon',
    },
    /** ≤ 24 chars: a row of the About card. */
    aboutEscuadra: `About ${ESCUADRA}`,
    privacy: 'Privacy',
    licences: 'Licences',
    version: (version: string) => `Version ${version}`,
    /** In brackets after the version on a build's own bundle. */
    builtIn: 'built-in',
  },
```

- In `about`, delete `version`, `builtIn`, `vibration` and `usageStatistics` (and their
  comments).
- In `about.privacy` → "Anonymous usage statistics", change
  `off on the app's About screen.` to `off in the app's Settings.`

- [ ] **Step 2: Budgets.** In `i18n/budgets.ts`, delete the `home.aboutLink` entry and add,
      after the `languageSheet.matchPhone` entry and in this order:

```ts
  { budget: 16, texts: { 'settings.title': (m) => m.settings.title } },
  {
    budget: 16,
    texts: {
      'settings.sections.play': (m) => m.settings.sections.play,
      'settings.sections.privacy': (m) => m.settings.sections.privacy,
      'settings.sections.support': (m) => m.settings.sections.support,
      'settings.sections.comingNext': (m) => m.settings.sections.comingNext,
      'settings.sections.about': (m) => m.settings.sections.about,
    },
  },
  { budget: 20, texts: { 'settings.language': (m) => m.settings.language } },
  { budget: 20, texts: { 'settings.appearance': (m) => m.settings.appearance } },
  {
    budget: 12,
    texts: {
      'settings.appearanceOptions.system': (m) => m.settings.appearanceOptions.system,
      'settings.appearanceOptions.dark': (m) => m.settings.appearanceOptions.dark,
      'settings.appearanceOptions.light': (m) => m.settings.appearanceOptions.light,
    },
  },
  { budget: 20, texts: { 'settings.vibration': (m) => m.settings.vibration } },
  { budget: 24, texts: { 'settings.usageStatistics': (m) => m.settings.usageStatistics } },
  { budget: 56, texts: { 'settings.usageNote': (m) => m.settings.usageNote } },
  { budget: 24, texts: { 'settings.rate.title': (m) => m.settings.rate.title } },
  { budget: 48, texts: { 'settings.rate.line': (m) => m.settings.rate.line } },
  { budget: 10, texts: { 'settings.rate.button': (m) => m.settings.rate.button } },
  { budget: 20, texts: { 'settings.examMode.title': (m) => m.settings.examMode.title } },
  { budget: 56, texts: { 'settings.examMode.line': (m) => m.settings.examMode.line } },
  { budget: 8, texts: { 'settings.examMode.soon': (m) => m.settings.examMode.soon } },
  {
    budget: 24,
    texts: {
      'settings.aboutEscuadra': (m) => m.settings.aboutEscuadra,
      'settings.privacy': (m) => m.settings.privacy,
      'settings.licences': (m) => m.settings.licences,
    },
  },
```

Read `i18n/__tests__/budgets.test.ts` first: if it checks the groups against the
comments in a way this shape breaks (one comment covering several keys), follow the
file's existing pattern for grouped keys (see `positionCodes`).

- [ ] **Step 3: Callers.** `lib/settingsView.ts`: `messages.settings.version` and
      `messages.settings.builtIn`. `app/about.tsx`: `t.settings.vibration`,
      `t.settings.usageStatistics`. `components/LanguageChip.tsx`:
      `t.settings.languageSpoken` (Task 6 deletes it).

- [ ] **Step 4: Translate.** In `de`, `es`, `fr` (France usage) and `it`, make the same
      changes in the same key order: the `USAGE_STATISTICS`-equivalent constant becomes the
      language's plain word for "Usage statistics"; `home.settings`; the whole `settings`
      namespace; the four keys removed from `about`; and the privacy sentence's "on the app's
      About screen" becomes the language's "in the app's Settings", naming Settings by the
      same word as `settings.title`. Reuse each catalog's existing words where the meaning is
      the same: `about.version`/`builtIn` move as they are; `languageSheet.title` for
      Language; each catalog's own `languageSheet.matchPhone` wording for Match phone where it
      fits 12 chars; `about.licences.label` for Licences; `about.privacy.heading` for Privacy;
      `about.title` for the About section label. Keep every budget. _Escuadra_ comes from
      `ESCUADRA`, never written out.

- [ ] **Step 5: SAME_AS_ENGLISH.** In `i18n/__tests__/catalogs.test.ts`, rename
      `about.version` → `settings.version` (de, fr) and `about.vibration` →
      `settings.vibration` (de). Add a path, with a one-line reason as the file does, only for
      a text that is genuinely the same word in that language (for example Italian
      `settings.privacy` and `settings.sections.privacy`, "Privacy", as `about.privacy.heading`
      already is).

- [ ] **Step 6: Run the i18n tests.** `npm run typecheck && npx vitest run i18n lib`.
      Expected: everything passes except the About hash test, which fails with the new hash.

- [ ] **Step 7: Update the hash.** Put the new 16-hex hash from the failure in
      `i18n/__tests__/catalogs.test.ts`. Re-run. Expected: PASS.

- [ ] **Step 8: Commit.** `git add -A i18n lib app components && git commit -m "feat(i18n): Settings text in five languages; the usage-statistics switch moves to Settings (#175)"`

---

### Task 4: Native-speaker review of the four translations

Not code. The controller dispatches one **fresh** reviewer subagent per language (de, es,
fr with France usage, it), in parallel, each a native-speaker reviewer of that language
with no knowledge of who wrote the text.

- [ ] **Step 1: Review.** Each reviewer reads `i18n/en.ts` and its catalog, and checks only
      what Task 3 changed: `home.settings`, the whole `settings` namespace, the usage-statistics
      constant, and the changed privacy sentence. It checks meaning against English,
      naturalness, platform conventions (what iOS and Android call Settings, Appearance,
      Vibration in that language), consistency with the catalog's existing words, the `≤ N
chars` budgets, and the register of the rest of the catalog. It returns a list of
      findings, each with the key, the problem and the proposed text, or "clean".
- [ ] **Step 2: Fix.** Apply every finding that keeps the English meaning. A finding that
      would change the meaning goes to the owner, not into the catalog.
- [ ] **Step 3: Re-review.** A new fresh reviewer for each language that had findings, until
      each returns clean.
- [ ] **Step 4: Verify and commit.** `npx vitest run i18n` (update the hash only if
      `en.about` changed, which it should not). `git commit -am "fix(i18n): Settings text after native review (#175)"`

---

### Task 5: Settings glyphs and building blocks

**Files:**

- Create: `components/SettingsGlyphs.tsx`, `components/SettingsSection.tsx`,
  `components/AppearanceControl.tsx`

**Interfaces:**

- Consumes: Task 1 tokens; `t.settings.appearance`, `t.settings.appearanceOptions`.
- Produces:
  - `SettingsGlyphs.tsx`: `GlobeGlyph`, `VibrationGlyph`, `ChartGlyph`, `InfoGlyph`,
    `DocumentGlyph`, `BookGlyph`, `ClockGlyph`, `ChevronGlyph`, each
    `({ color }: { color: string })`; `GearGlyph` and `MoonGlyph` take
    `({ color, ground })`, `ground` being the colour behind them.
  - `SettingsSection.tsx`: `SettingsSection({ label, dashed?, children })` (a label over
    a card) and `SettingsRow({ icon, label, note?, accessory?, onPress?, testID?, accessibilityLabel?, last?, minHeight?, muted? })`.
  - `AppearanceControl.tsx`: `AppearanceControl()` with no props; reads and writes
    `themePreference`.

There is no React Native renderer in the tests (`.claude/rules/testing.md`): these are
checked by `npm run typecheck`, `npm run lint` and, after Task 7, `npm run shots`.

- [ ] **Step 1: Glyphs.** Create `components/SettingsGlyphs.tsx`. Every glyph is drawn from
      Views on the canvas's 24-unit grid at a 2-unit stroke, scaled to
      `sizes.settings.glyph` (the chevron to `sizes.settings.chevron`), as `ActionGlyphs.tsx`
      does. No icon library: a new icon set would be a new asset licence (spec, decision 1).

```tsx
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { sizes } from '@/theme/tokens';

// Settings' row marks and Home's gear (#175), drawn from Views on the design
// board's 24-unit grid at its 2-unit stroke, as ActionGlyphs.tsx draws Study's.
// No icon library: an icon set is a new asset licence (docs/license.md).
const GRID = 24;
const S = sizes.settings.glyph;
const k = S / GRID;
const w = 2 * k;

/** A box in grid units, for the absolutely placed parts of a glyph. */
function at(x: number, y: number, width: number, height: number): ViewStyle {
  return { position: 'absolute', left: x * k, top: y * k, width: width * k, height: height * k };
}

function Box({ children }: { children: React.ReactNode }) {
  return <View style={styles.box}>{children}</View>;
}

/** A circle of diameter `d` centred on (cx, cy), stroked or filled. */
function circle(cx: number, cy: number, d: number, color: string, fill = false): ViewStyle {
  return {
    ...at(cx - d / 2, cy - d / 2, d, d),
    borderRadius: (d * k) / 2,
    ...(fill ? { backgroundColor: color } : { borderWidth: w, borderColor: color }),
  };
}

export function GearGlyph({ color, ground }: { color: string; ground: string }) {
  // Eight teeth (four bars through the centre), a disc over them, and the hub's
  // hole punched out in the ground's colour.
  return (
    <Box>
      {[0, 45, 90, 135].map((deg) => (
        <View
          key={deg}
          style={[
            at(10, 2, 4, 20),
            { backgroundColor: color, borderRadius: k, transform: [{ rotate: `${deg}deg` }] },
          ]}
        />
      ))}
      <View style={circle(12, 12, 16, color, true)} />
      <View style={circle(12, 12, 7, ground, true)} />
    </Box>
  );
}
```

The others, each inside `<Box>`:

```tsx
export function GlobeGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View style={circle(12, 12, 20, color)} />
      <View
        style={[at(7.5, 2, 9, 20), { borderRadius: 10 * k, borderWidth: w, borderColor: color }]}
      />
      <View style={[at(2, 11, 20, 2), { backgroundColor: color }]} />
    </Box>
  );
}

export function MoonGlyph({ color, ground }: { color: string; ground: string }) {
  // A disc with an offset disc in the ground's colour punched out of it.
  return (
    <Box>
      <View style={[circle(12, 12, 18, color, true), { overflow: 'hidden' }]}>
        <View style={[at(7, -4, 16, 16), { borderRadius: 8 * k, backgroundColor: ground }]} />
      </View>
    </Box>
  );
}

export function VibrationGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View
        style={[at(8, 4, 8, 16), { borderRadius: 2 * k, borderWidth: w, borderColor: color }]}
      />
      <View style={[at(3, 9, 2, 6), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(19, 9, 2, 6), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

export function ChartGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View style={[at(3, 19, 18, 2), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(5, 11, 2, 6), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(10, 5, 2, 12), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(15, 8, 2, 9), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

export function InfoGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View style={circle(12, 12, 20, color)} />
      <View style={[at(11, 7, 2, 2), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(11, 11, 2, 6), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

export function DocumentGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View
        style={[at(5, 3, 14, 18), { borderRadius: 2 * k, borderWidth: w, borderColor: color }]}
      />
      <View style={[at(9, 9, 6, 2), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(9, 13, 6, 2), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

export function BookGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View
        style={[at(4, 3, 16, 18), { borderRadius: 2 * k, borderWidth: w, borderColor: color }]}
      />
      <View style={[at(8, 3, 2, 18), { backgroundColor: color }]} />
    </Box>
  );
}

export function ClockGlyph({ color }: { color: string }) {
  return (
    <Box>
      <View style={[at(9, 1, 6, 2), { borderRadius: k, backgroundColor: color }]} />
      <View style={circle(12, 13, 17, color)} />
      <View style={[at(11, 8.5, 2, 5.5), { borderRadius: k, backgroundColor: color }]} />
      <View style={[at(11, 12, 4.5, 2), { borderRadius: k, backgroundColor: color }]} />
    </Box>
  );
}

/** A chevron pointing right (›), at `sizes.settings.chevron`. */
export function ChevronGlyph({ color }: { color: string }) {
  const c = sizes.settings.chevron;
  const arm = c * 0.42;
  const stroke = (2.5 * c) / GRID;
  return (
    <View style={{ width: c, height: c, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: arm,
          height: arm,
          marginLeft: -arm / 3,
          borderTopWidth: stroke,
          borderRightWidth: stroke,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ box: { width: S, height: S } });
```

The bare numbers here are grid units of the glyph's own drawing, scaled by `k`, as in
`ActionGlyphs.tsx`; they are geometry, not spacing (guardrail 5 governs the screen's
spacing, colours and type). Import `type ReactNode` from `react` for `Box`'s children.

- [ ] **Step 2: Sections and rows.** Create `components/SettingsSection.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderWidths, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Settings' blocks (#175): a label in IBM Plex Mono capitals over a card, and the rows
// inside one. A row is a button when it has `onPress`; otherwise it only lays out.
export function SettingsSection({
  label,
  dashed = false,
  children,
}: {
  label: string;
  dashed?: boolean;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    section: { gap: spacing.xs },
    label: { ...typography.settingsSection, color: colors.textMuted },
    card: dashed
      ? {
          borderRadius: radii.settingsCard,
          borderWidth: borderWidths.thick,
          borderStyle: 'dashed',
          borderColor: colors.border,
        }
      : {
          borderRadius: radii.settingsCard,
          backgroundColor: colors.surface,
          borderWidth: borderWidths.hairline,
          borderColor: colors.hairline,
          overflow: 'hidden',
        },
  });
  return (
    <View style={styles.section}>
      <Text style={styles.label} accessibilityRole="header">
        {label}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SettingsRow({
  icon,
  label,
  note,
  accessory,
  onPress,
  testID,
  accessibilityLabel,
  last = false,
  minHeight = sizes.settings.row,
  muted = false,
}: {
  icon: ReactNode;
  label: string;
  note?: string;
  accessory?: ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  last?: boolean;
  minHeight?: number;
  /** Coming next's quieter text. */
  muted?: boolean;
}) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      minHeight,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: last ? 0 : borderWidths.hairline,
      borderBottomColor: colors.hairline,
    },
    text: { flex: 1, minWidth: 0, gap: spacing.xxs - 1 },
    label: {
      ...typography.settingsLabel,
      color: muted ? colors.textSecondary : colors.textPrimary,
    },
    note: { ...typography.secondarySmall, color: colors.textMuted },
  });
  const body = (
    <>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {icon}
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {note !== undefined && <Text style={styles.note}>{note}</Text>}
      </View>
      {accessory}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.settled }]}
    >
      {body}
    </Pressable>
  );
}
```

`spacing.sm + 2` (14) and `spacing.xxs - 1` (3) follow Home's existing `spacing.md - 2`
idiom for the canvas's 14 and 3; if `npm run lint` or review objects, add tokens instead.

- [ ] **Step 3: Appearance.** Create `components/AppearanceControl.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '@/i18n/useT';
import { useProgress } from '@/stores/progress';
import {
  borderWidths,
  radii,
  sizes,
  spacing,
  typography,
  type ThemePreference,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

const OPTIONS: readonly ThemePreference[] = ['system', 'dark', 'light'];

// Settings' Appearance (#175): Match phone, Dark or Light, written straight to
// `themePreference`. A radio group, so a screen reader says which is chosen.
// aria-checked is for react-native-web, which does not read accessibilityState.
export function AppearanceControl() {
  const colors = useThemeColors();
  const t = useT();
  const preference = useProgress((s) => s.themePreference);
  const setThemePreference = useProgress((s) => s.setThemePreference);
  const styles = StyleSheet.create({
    track: {
      flexDirection: 'row',
      gap: spacing.xxs,
      padding: spacing.xxs,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
      borderWidth: borderWidths.hairline,
      borderColor: colors.hairline,
    },
    option: {
      flex: 1,
      minHeight: sizes.settings.segment,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxs,
    },
    label: { ...typography.switchLabel },
  });
  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={t.settings.appearance}
    >
      {OPTIONS.map((option) => {
        const checked = option === preference;
        return (
          <Pressable
            key={option}
            testID={`appearance-${option}`}
            onPress={() => setThemePreference(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            aria-checked={checked}
            style={[styles.option, checked && { backgroundColor: colors.ctaBg }]}
          >
            <Text
              style={[styles.label, { color: checked ? colors.ctaText : colors.textSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {t.settings.appearanceOptions[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

Check `ThemePreference` is exported from `theme/tokens.ts` and is exactly
`'system' | 'dark' | 'light'`; if its members differ, map them here.

- [ ] **Step 4: Verify.** `npm run typecheck && npm run lint`. Expected: clean. If lint
      flags `aria-checked` or a prop as a hard-coded string, follow how
      `app/team/[squadId]/study.tsx` handles the same prop.

- [ ] **Step 5: Commit.** `git add components && git commit -m "feat(settings): row glyphs, sections and the Appearance control (#175)"`

---

### Task 6: The Settings screen, Home's gear, About's changes, dead code

**Files:**

- Create: `app/settings.tsx`
- Modify: `app/index.tsx`, `app/about.tsx`, `theme/tokens.ts`, `i18n/languageOptions.ts`,
  `i18n/__tests__/languageOptions.test.ts`
- Delete: `components/ThemeToggle.tsx`, `components/LanguageChip.tsx`

**Interfaces:**

- Consumes: Tasks 1–5.
- Produces: route `/settings`; testIDs `home-settings`, `settings-back`,
  `settings-language`, `settings-language-value`, `appearance-system|dark|light`,
  `haptics-toggle`, `telemetry-toggle`, `settings-rate`, `settings-about`,
  `settings-privacy`, `settings-licences`; About reads `section=privacy`.

- [ ] **Step 1: The screen.** Create `app/settings.tsx`:

```tsx
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackGlyph } from '@/components/ActionGlyphs';
import { AppearanceControl } from '@/components/AppearanceControl';
import { BrandGradient } from '@/components/BrandGradient';
import { EscuadraMark } from '@/components/EscuadraMark';
import { LanguageSheet } from '@/components/LanguageSheet';
import { LicencesSheet } from '@/components/LicencesSheet';
import {
  BookGlyph,
  ChartGlyph,
  ChevronGlyph,
  ClockGlyph,
  DocumentGlyph,
  GlobeGlyph,
  InfoGlyph,
  MoonGlyph,
  VibrationGlyph,
} from '@/components/SettingsGlyphs';
import { SettingsRow, SettingsSection } from '@/components/SettingsSection';
import { LANGUAGE_NAMES } from '@/i18n/names';
import { useLanguage, useT } from '@/i18n/useT';
import { versionLabel } from '@/lib/settingsView';
import { openStorePage } from '@/lib/storeReview';
import { useProgress } from '@/stores/progress';
import { borderWidths, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

// Settings (#175; spec docs/superpowers/specs/2026-10-22-settings-screen-design.md):
// the preferences that were on Home and About, Rate, Coming next, the About links and
// the version line.
export default function Settings() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const language = useLanguage();
  const haptics = useProgress((s) => s.haptics);
  const setHaptics = useProgress((s) => s.setHaptics);
  const telemetryEnabled = useProgress((s) => s.telemetryEnabled);
  const setTelemetryEnabled = useProgress((s) => s.setTelemetryEnabled);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [licencesOpen, setLicencesOpen] = useState(false);
  const version = Constants.expoConfig?.version ?? '—';
  const glyph = colors.textSecondary;
  const g = sizes.settings;

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.lg, gap: spacing.lg + 2 },
    header: { gap: spacing.md + 2 },
    round: {
      width: g.roundButton,
      height: g.roundButton,
      borderRadius: g.roundButton / 2,
      backgroundColor: colors.surface,
      borderWidth: borderWidths.hairline,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...typography.settingsTitle, color: colors.textPrimary },
    value: { ...typography.secondary, color: colors.textSecondary },
    appearance: {
      gap: spacing.sm,
      padding: spacing.md,
      borderBottomWidth: borderWidths.hairline,
      borderBottomColor: colors.hairline,
    },
    appearanceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
    appearanceLabel: { ...typography.settingsLabel, color: colors.textPrimary },
    plate: {
      width: g.plate,
      height: g.plate,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rate: {
      height: g.rateButton,
      paddingHorizontal: spacing.md + 2,
      borderRadius: radii.pill,
      backgroundColor: colors.ctaBg,
      justifyContent: 'center',
    },
    rateLabel: { ...typography.settingsAction, color: colors.ctaText },
    soon: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs - 1,
      borderRadius: radii.pill,
      backgroundColor: colors.soonBg,
    },
    soonLabel: { ...typography.soonChip, color: colors.textSecondary },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingTop: spacing.xxs,
    },
    version: { ...typography.statMonoTiny, color: colors.textMuted },
  });

  const switchProps = {
    trackColor: { false: colors.surfaceRaised, true: colors.brandBright },
    thumbColor: colors.switchThumb,
    ios_backgroundColor: colors.surfaceRaised,
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            testID="settings-back"
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            style={({ pressed }) => [styles.round, pressed && { opacity: opacity.settled }]}
          >
            <BackGlyph color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {t.settings.title}
          </Text>
        </View>

        <SettingsSection label={t.settings.sections.play}>
          <SettingsRow
            testID="settings-language"
            icon={<GlobeGlyph color={glyph} />}
            label={t.settings.language}
            accessibilityLabel={t.settings.languageSpoken(LANGUAGE_NAMES[language])}
            onPress={() => setLanguageOpen(true)}
            accessory={
              <>
                <Text testID="settings-language-value" style={styles.value}>
                  {LANGUAGE_NAMES[language]}
                </Text>
                <ChevronGlyph color={colors.textMuted} />
              </>
            }
          />
          <View style={styles.appearance}>
            <View style={styles.appearanceHead}>
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <MoonGlyph color={glyph} ground={colors.surface} />
              </View>
              <Text style={styles.appearanceLabel}>{t.settings.appearance}</Text>
            </View>
            <AppearanceControl />
          </View>
          <SettingsRow
            last
            icon={<VibrationGlyph color={glyph} />}
            label={t.settings.vibration}
            accessory={
              <Switch
                testID="haptics-toggle"
                accessibilityLabel={t.settings.vibration}
                value={haptics}
                onValueChange={setHaptics}
                {...switchProps}
              />
            }
          />
        </SettingsSection>

        <SettingsSection label={t.settings.sections.privacy}>
          <SettingsRow
            last
            icon={<ChartGlyph color={glyph} />}
            label={t.settings.usageStatistics}
            note={t.settings.usageNote}
            accessory={
              <Switch
                testID="telemetry-toggle"
                accessibilityLabel={t.settings.usageStatistics}
                value={telemetryEnabled}
                onValueChange={setTelemetryEnabled}
                {...switchProps}
              />
            }
          />
        </SettingsSection>

        <SettingsSection label={t.settings.sections.support}>
          <SettingsRow
            last
            icon={
              <BrandGradient gradient="plate" style={styles.plate}>
                <EscuadraMark size={g.plateMark} color={colors.plateMark} />
              </BrandGradient>
            }
            label={t.settings.rate.title}
            note={t.settings.rate.line}
            accessory={
              <Pressable
                testID="settings-rate"
                onPress={openStorePage}
                accessibilityRole="button"
                accessibilityLabel={t.settings.rate.title}
                style={({ pressed }) => [styles.rate, pressed && { opacity: opacity.settled }]}
              >
                <Text style={styles.rateLabel}>{t.settings.rate.button}</Text>
              </Pressable>
            }
          />
        </SettingsSection>

        <SettingsSection label={t.settings.sections.comingNext} dashed>
          <View accessible>
            <SettingsRow
              last
              muted
              icon={<ClockGlyph color={colors.textMuted} />}
              label={t.settings.examMode.title}
              note={t.settings.examMode.line}
              accessory={
                <View style={styles.soon}>
                  <Text style={styles.soonLabel}>{t.settings.examMode.soon}</Text>
                </View>
              }
            />
          </View>
        </SettingsSection>

        <SettingsSection label={t.settings.sections.about}>
          <SettingsRow
            testID="settings-about"
            minHeight={g.linkRow}
            icon={<InfoGlyph color={glyph} />}
            label={t.settings.aboutEscuadra}
            onPress={() => router.push('/about')}
            accessory={<ChevronGlyph color={colors.textMuted} />}
          />
          <SettingsRow
            testID="settings-privacy"
            minHeight={g.linkRow}
            icon={<DocumentGlyph color={glyph} />}
            label={t.settings.privacy}
            onPress={() => router.push({ pathname: '/about', params: { section: 'privacy' } })}
            accessory={<ChevronGlyph color={colors.textMuted} />}
          />
          <SettingsRow
            last
            testID="settings-licences"
            minHeight={g.linkRow}
            icon={<BookGlyph color={glyph} />}
            label={t.settings.licences}
            onPress={() => setLicencesOpen(true)}
            accessory={<ChevronGlyph color={colors.textMuted} />}
          />
        </SettingsSection>

        <View style={styles.footer}>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <EscuadraMark size={g.footerMark} color={colors.mark} />
          </View>
          <Text style={styles.version}>
            {versionLabel(
              version,
              {
                isEnabled: Updates.isEnabled,
                isEmbeddedLaunch: Updates.isEmbeddedLaunch,
                updateId: Updates.updateId,
                channel: Updates.channel,
                manifest: Updates.manifest,
              },
              t,
            )}
          </Text>
        </View>
      </ScrollView>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
      <LicencesSheet visible={licencesOpen} onClose={() => setLicencesOpen(false)} />
    </View>
  );
}
```

- [ ] **Step 2: Home.** In `app/index.tsx`, remove the `LanguageChip`/`ThemeToggle` imports,
      the About `Pressable`, the `aboutLink` and `controls` styles. The top row becomes
      `toggleRow` with `justifyContent: 'flex-end'`, holding one gear button:

```tsx
<Pressable
  testID="home-settings"
  onPress={() => router.push('/settings')}
  accessibilityRole="button"
  accessibilityLabel={t.home.settings}
  style={({ pressed }) => [styles.gear, pressed && { opacity: opacity.settled }]}
>
  <GearGlyph color={colors.textPrimary} ground={colors.surface} />
</Pressable>
```

with `gear` styled as Settings' `round` (44 pt circle, `surface`, hairline `border`), and
`GearGlyph` from `@/components/SettingsGlyphs`, `opacity` from the tokens. Nothing else on
Home changes.

- [ ] **Step 3: About.** In `app/about.tsx`: delete the two switch sections, the version line,
      their state, styles (`settingRow`, `settingLabel`, `versionLine`) and imports
      (`Constants`, `Updates`, `Switch`, `versionLabel`, `useProgress`). Then scroll to Privacy
      when asked:

```tsx
const { section } = useLocalSearchParams<{ section?: string }>();
const scrollRef = useRef<ScrollView>(null);
const scrolledTo = useRef(false);
// Settings' Privacy row opens About at its Privacy card (#175).
const onPrivacyLayout = (e: LayoutChangeEvent) => {
  if (section !== 'privacy' || scrolledTo.current) return;
  scrolledTo.current = true;
  scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: false });
};
```

`ref={scrollRef}` on the `ScrollView`, `onLayout={onPrivacyLayout}` on the Privacy card's
`View`. Imports: `useLocalSearchParams` from `expo-router`, `useRef` from `react`,
`type LayoutChangeEvent` from `react-native`.

- [ ] **Step 4: Dead code.** Delete `components/ThemeToggle.tsx` and
      `components/LanguageChip.tsx`. Delete `languageChipCode` from `i18n/languageOptions.ts`
      and its `describe` block from `i18n/__tests__/languageOptions.test.ts`. In
      `theme/tokens.ts` delete the roles `thumbBg` and `thumbIcon` (interface and both
      palettes), `sizes.themeToggle`, `sizes.themeToggleGlyph`, and `minHeight` from
      `sizes.languageChip` (its comment now describes only the sheet's radio). Run
      `grep -rn "thumbBg\|thumbIcon\|themeToggle\|languageChipCode\|LanguageChip\|ThemeToggle" app components lib theme i18n`;
      expected: no hits.

- [ ] **Step 5: Verify.** `npm run typecheck && npm run lint && npm test`. Expected: PASS.
      Then `npx expo start --web`, open `/`, tap the gear, and check every row works: each
      Appearance option changes the theme; the switches flip; Language opens the sheet;
      About/Privacy/Licences open their targets (Privacy lands on the Privacy card).

- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(settings): the Settings screen, Home's gear, and About without its switches (#175)"`

---

### Task 7: Docs, rules, shots

**Files:**

- Modify: `stores/progress.ts` (comments), `.claude/rules/stores.md`,
  `.claude/rules/privacy-telemetry.md`, `docs/superpowers/specs/2026-10-15-play-redesign-2-0-design.md`
  (§7, the Vibration paragraph), `scripts/capture-screens.mjs`, `design/SCREENS.md`,
  `design/screens/*.png`

- [ ] **Step 1: Comments and rules.** `stores/progress.ts`: `languagePreference` "Set by
      Settings' language sheet (#175)"; `telemetryEnabled` "Settings' opt-out"; `haptics`
      "Settings' Vibration switch (spec §7, #175)"; `themePreference` unchanged.
      `.claude/rules/stores.md`: "next to the Settings opt-out". `.claude/rules/privacy-telemetry.md`
      line 46: "next to the Settings-screen opt-out". 2.0 spec §7: "A **Vibration** switch on
      the Settings screen (#175), on by default, …" and drop "It lives on the About screen
      because there is no Settings screen."
- [ ] **Step 2: Shots.** In `scripts/capture-screens.mjs`'s `captureTheme`: keep `01-home`;
      the `--lang` check opens `/settings` and compares `settings-language-value`'s text with a
      map `{ en: 'English', es: 'Español', fr: 'Français', it: 'Italiano', de: 'Deutsch' }`
      (mirroring `LANGUAGE_NAMES` in `i18n/names.ts`, which an `.mjs` cannot import; say so in
      a comment); then `capture.open('/settings')`, `shoot('01c-settings')`, scroll the page to
      its end (the ScrollView's DOM node, `scrollTo(0, scrollHeight)` through
      `page.evaluate`) and `shoot('01c-settings-end')`, `tapId('settings-language', { wait: SHEET_MS })`
      and `shoot('01c-settings-language')`. Remove `01b-home-language`. Keep `01a-about` and
      `01a-about-licences`.
- [ ] **Step 3: Regenerate.** `npm run shots` (both themes). Delete
      `design/screens/01b-home-language*.png`. Look at every new or changed PNG with the Read
      tool against the canvas's Settings artboard, in dark and light; fix what differs.
- [ ] **Step 4: SCREENS.md.** Update `design/SCREENS.md` for Home (the gear; no About link,
      chip or toggle), About (no switches, no version line), and a new Settings entry for
      `01c-settings*`.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "docs(settings): rules, specs and design/screens for the Settings screen (#175)"`

---

### Task 8: Privacy pages and the full check

- [ ] **Step 1: Generate the 2.0 pages outside the repo.** In the scratchpad:
      `PRIVACY_PAGES=<scratch>/site PRIVACY_UPDATED=2026-10-22 npx vitest run scripts/__tests__/privacy-pages.test.ts`.
      Then diff against the live folder:
      `git show origin/gh-pages:privacy/2/index.html > <scratch>/old-index.html` (and the other
      four), and `diff` each. Expected: only the usage-statistics sentence, the switch's name
      and the date differ. Keep the diff for the PR body. Do **not** commit to or push
      `gh-pages` (owner, 22 Oct 2026: after merge, on their OK).
- [ ] **Step 2: Full check.** `npm run check`. Expected: every step passes; keep the output
      for the PR.
