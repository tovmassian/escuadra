// Escuadra — design tokens
// Plain exported objects. No styling library, no CSS-in-JS. Spacing is unitless (RN dp).

import type { FontFamily } from './fonts';

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
  /** Text/icon colour to place on top of `accent`. */
  accentOn: string;
  /** Flat fill for the Escuadra mark — the brand ramp's pale end reads on a
   *  dark ground and its bright end on a light one, so this is a role, not a
   *  fixed hex. */
  mark: string;
  success: string;
  /** Small success-coloured text on `background`/`surface`; `success` itself
   *  stays for large text and graphics. */
  successText: string;
  error: string;
  /** Dimmed error text for an "incorrect-picked" option — visually quieter
   *  than `error` so the correct answer stays the loudest thing on screen. */
  errorTextDim: string;
  brandBright: string;
  brandDeep: string;
  brandSoft: string;
  brandLift: string;
  brandPlateTop: string;
  brandPlateBottom: string;
  // ---- The 2.0 spotlight stage (spec §8). Most of these sit on the player
  // photo, which looks the same in either theme, so they are shared.
  /** The streak chip: its flame, wash, outline and count. Brand, never a
   *  verdict colour — it only ever means the streak. */
  heat: string;
  heatBg: string;
  heatLine: string;
  heatText: string;
  /** Translucent glass for controls over the photo (the close button). */
  glass: string;
  glassLine: string;
  /** Opaque ink over the photo, the same in both themes: the top bar's team
   *  name, the close glyph, the score text and the current progress segment.
   *  Opaque so `stageVeil` can measure contrast against it. */
  onPhoto: string;
  /** The same ink, quieter: the top bar's "Level n". Translucent, so never
   *  measure it with `contrastRatio`. */
  onPhotoMuted: string;
  /** The ink of the veil over a no-photo stage's team-colour bands. Its
   *  strength is `stage.veil`, raised by `stageVeil` where a band is light. */
  veilInk: string;
  /** Answer tiles on the stage's ground. */
  tile: string;
  tileLine: string;
  /** Slot-chip labels and tile sub-labels on the stage's ground. Text over
   *  the photo (the top bar's "Level n") is `onPhotoMuted`, not this. */
  onStageMuted: string;
  /** The stage's main button ("Got it — next") and its label. */
  ctaBg: string;
  ctaText: string;
  /** Accent as a line: the active slot's outline. `accent` is too dark to
   *  read as a thin line on the dark ground, so dark uses `brandSoft`. */
  accentLine: string;
  // ---- 2.0 question screen (spec §2), from the design board ----
  /** Progress segments over the photo: future, right, wrong. */
  photoTrack: string;
  photoSuccess: string;
  photoError: string;
  /** The loading shimmer's highlight and its transparent edges. */
  stageShimmer: string;
  stageShimmerEdge: string;
  /** Text on the stage's ground: the shirt number, the prompt, the active
   *  slot's "?". */
  onStage: string;
  /** Slot chips: fill, outline, and a pending slot's dashed outline and text
   *  (also a not-asked slot's value). */
  chipBg: string;
  chipLine: string;
  chipPendingLine: string;
  chipPendingText: string;
  /** The word under a position tile's code. */
  tileSub: string;
  /** Verdicts on the stage: a right slot's text and a right pick's fill; a
   *  wrong pick's outline, fill and text; the right answer's fill after a
   *  miss. */
  stageSuccessText: string;
  stageSuccessBg: string;
  stageErrorLine: string;
  stageErrorBg: string;
  stageErrorText: string;
  stageAnswerBg: string;
  /** The auto-next bar: outline, fill, label and the progress inside it. */
  nextLine: string;
  nextBg: string;
  nextText: string;
  nextFill: string;
  /** A player card's line under the name ("You picked …"). The card is dark in
   *  both themes (photo or bands under `cardGradient`), so this is shared. */
  cardLine: string;
  // ---- 2.0 sharing (spec §4.1) ----
  /** A bottom sheet's backdrop: the share sheet and the photo credits. */
  scrim: string;
  /** A link inside a preview (the share text's URL). */
  link: string;
  // ---- 2.0 Study (spec §5) ----
  /** The position chip's fill over a card photo. Darker than `glass`, which
   *  leaves white text under 4.5:1 over a bright photo's top edge. Translucent,
   *  so never measure it with `contrastRatio`; a composite test holds it. */
  photoChip: string;
  /** The dashed outline of a hidden name's "Tap to reveal" pill on a player
   *  card. The card is dark in both themes, so this is shared. Translucent,
   *  so never measure it with `contrastRatio`. */
  revealLine: string;
  /** That pill's label. Translucent; held to AA by a composite test over the
   *  card gradient's last stop. */
  revealText: string;
  /** The divider under each Study list row. A step quieter than `border`,
   *  which outlines controls. */
  hairline: string;
  // ---- 2.0 Settings (#175) ----
  /** A settings switch's thumb, in either state. */
  switchThumb: string;
  /** The SOON chip's fill on Coming next. Translucent. */
  soonBg: string;
  /** The Escuadra mark on the brand plate (Settings' Rate card). */
  plateMark: string;
  // ---- 2.0 team picker (#176) ----
  /** A quiet count on `ctaBg` (the picker's selected tab). */
  ctaMuted: string;
  /** The ring round a 40 × 27 team marker in the picker. */
  markerRing: string;
  // ---- 2.0 Home (#181) ----
  /** The outline of Home's drifting shirt numbers: about 14% of
   *  `textPrimary` over `background`, as the canvas draws it, made opaque. */
  wallLine: string;
  /** `background` at no opacity: the clear end of Home's fades. A plain
   *  `transparent` would fade through black on iOS. */
  backgroundClear: string;
  /** The ring round a flag or marker on `ctaBg` (Home's Continue), so a
   *  white flag or club colour doesn't bleed into the button. */
  ctaLine: string;
}

// Roles that do not vary by theme. `accent` is dark enough to carry against
// both grounds, which is why the design source reuses it unchanged; the
// brand ramp is the mark's own identity — a design token, not
// team-identity content, unlike a club's real colours — and the plate's
// gradient ends run deeper than the mark's own stops because the plate sits
// behind it.
const sharedRoles = {
  accent: '#3e45a3',
  brandBright: '#5b63d6',
  brandDeep: '#2f3585',
  brandSoft: '#8f97ea',
  brandLift: '#6d76e6',
  brandPlateTop: '#4a52c4',
  brandPlateBottom: '#252a6b',
  // The 2.0 stage's photo-side roles, shared because they sit on the photo
  // or on the team's own colours, and neither changes with the theme.
  heat: '#ffaa3c',
  heatBg: 'rgba(255,170,60,0.2)',
  heatLine: 'rgba(255,170,60,0.5)',
  heatText: '#ffc27a',
  glass: 'rgba(15,17,23,0.42)',
  glassLine: 'rgba(255,255,255,0.18)',
  onPhoto: '#ffffff',
  onPhotoMuted: 'rgba(255,255,255,0.75)',
  veilInk: '#0c0d12',
  photoTrack: 'rgba(255,255,255,0.28)',
  photoSuccess: '#61bd67',
  photoError: '#f05653',
  stageShimmer: 'rgba(255,255,255,0.26)',
  stageShimmerEdge: 'rgba(255,255,255,0)',
  cardLine: '#ffa19e',
  // A bottom sheet's backdrop: the same ink in both themes.
  scrim: 'rgba(0,0,0,0.55)',
  // Study's hidden-name pill on a player card, which is dark in both themes.
  revealLine: 'rgba(255,255,255,0.5)',
  revealText: 'rgba(255,255,255,0.85)',
  photoChip: 'rgba(15,17,23,0.6)',
  switchThumb: '#ffffff',
  plateMark: '#e7e9f5',
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
  // 5.4:1 on the ground (was #767b80, 4.3:1, under AA).
  textMuted: '#868b91',
  accentOn: '#f3f5f7',
  mark: sharedRoles.brandSoft,
  success: '#61bd67',
  successText: '#61bd67',
  error: '#f05653',
  errorTextDim: '#a15a58',
  tile: 'rgba(255,255,255,0.08)',
  tileLine: 'rgba(255,255,255,0.16)',
  onStageMuted: 'rgba(255,255,255,0.62)',
  ctaBg: '#f3f5f7',
  ctaText: '#12141a',
  accentLine: sharedRoles.brandSoft,
  onStage: '#ffffff',
  chipBg: 'rgba(255,255,255,0.1)',
  chipLine: 'rgba(255,255,255,0.16)',
  chipPendingLine: 'rgba(255,255,255,0.3)',
  chipPendingText: 'rgba(255,255,255,0.6)',
  tileSub: 'rgba(255,255,255,0.66)',
  stageSuccessText: '#8fe095',
  stageSuccessBg: 'rgba(97,189,103,0.22)',
  stageErrorLine: 'rgba(240,86,83,0.55)',
  stageErrorBg: 'rgba(240,86,83,0.14)',
  stageErrorText: '#e9827f',
  stageAnswerBg: 'rgba(18,20,26,0.6)',
  nextLine: 'rgba(97,189,103,0.5)',
  nextBg: 'rgba(97,189,103,0.12)',
  nextText: '#9be0a0',
  nextFill: 'rgba(97,189,103,0.2)',
  link: '#8fb4ff',
  hairline: '#23272e',
  soonBg: 'rgba(255,255,255,0.08)',
  ctaMuted: '#4b4f56',
  markerRing: 'rgba(255,255,255,0.12)',
  wallLine: '#33353a',
  backgroundClear: 'rgba(18,20,26,0)',
  ctaLine: 'rgba(20,22,26,0.14)',
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
  // 4.9:1 on the ground (was #8b8f96, 3.0:1).
  textMuted: '#686c73',
  accentOn: '#ffffff',
  mark: sharedRoles.brandBright,
  success: '#2f8f3e',
  successText: '#24702f',
  error: '#c23934',
  errorTextDim: '#b3625d',
  tile: '#ffffff',
  tileLine: '#dcdfe4',
  onStageMuted: '#5f636a', // 5:1 on a chip (the board's #686c73 is 4.35)
  ctaBg: '#14161a',
  ctaText: '#ffffff',
  accentLine: sharedRoles.accent,
  onStage: '#14161a',
  chipBg: 'rgba(20,22,26,0.06)',
  chipLine: 'rgba(20,22,26,0.12)',
  chipPendingLine: 'rgba(20,22,26,0.28)',
  chipPendingText: '#5f636a',
  tileSub: '#686c73',
  // The board's #2f8f3e gives ~3.4:1 on its own green washes; this holds 5:1.
  stageSuccessText: '#24702f',
  stageSuccessBg: 'rgba(47,143,62,0.12)',
  stageErrorLine: 'rgba(194,57,52,0.45)',
  stageErrorBg: 'rgba(194,57,52,0.08)',
  stageErrorText: '#b0413c',
  stageAnswerBg: '#ffffff',
  nextLine: 'rgba(47,143,62,0.45)',
  nextBg: 'rgba(47,143,62,0.08)',
  nextText: '#24702f',
  nextFill: 'rgba(47,143,62,0.14)',
  link: '#2f56c6',
  hairline: '#e3e5e9',
  soonBg: 'rgba(20,22,26,0.06)',
  ctaMuted: '#b4b8bb',
  markerRing: 'rgba(20,22,26,0.12)',
  wallLine: '#d7d8da',
  backgroundClear: 'rgba(247,247,249,0)',
  ctaLine: 'rgba(255,255,255,0.16)',
} as const;

export const palettes: Record<ThemeName, Palette> = {
  dark: { ...sharedRoles, ...darkRoles },
  light: { ...sharedRoles, ...lightRoles },
};

// Gradient stops for the Escuadra mark and its icon plate. React Native
// cannot paint a gradient from a plain View, so these are declarative data
// consumed by <BrandGradient>, which wraps expo-linear-gradient.
//
// `start`/`end` are unit-square coordinates. The design source specified the
// plate as CSS `linear-gradient(140deg, ...)`; 140deg points down and to the
// right, which is {x:0,y:0} → {x:0.64,y:1} here.
export const gradients = {
  mark: {
    colors: [sharedRoles.brandBright, sharedRoles.brandDeep],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  markSoft: {
    colors: [sharedRoles.accent, sharedRoles.brandLift],
    start: { x: 0, y: 1 },
    end: { x: 1, y: 0 },
  },
  plate: {
    colors: [sharedRoles.brandPlateTop, sharedRoles.brandPlateBottom],
    start: { x: 0, y: 0 },
    end: { x: 0.64, y: 1 },
  },
} as const;

export type GradientName = keyof typeof gradients;

/** A vertical gradient for `expo-linear-gradient`: `colors[i]` sits at
 *  `locations[i]`, a fraction of the painted view's height from the top. */
export interface StageGradient {
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
}

// The question screen's stage (spec §2.1), painted over the whole window —
// so locations are fractions of the window, not of the photo — above the
// photo and under every control. A near-black scrim under the status and top
// bars, clear through the face, then a fall into the ground the answers sit
// on. The scrim is the same ink in both themes because it always sits on a
// photo; the ground ends in the palette's own background. Per theme, so not
// in `gradients`: read it as `stageGradients[useThemeName()]` at render,
// never captured at module scope.
export const stageGradients: Record<ThemeName, StageGradient> = {
  dark: {
    colors: [
      'rgba(10,11,15,0.6)',
      'rgba(10,11,15,0)',
      'rgba(18,20,26,0)',
      'rgba(18,20,26,0.88)',
      '#12141a',
    ],
    // Solid ground at 0.68, where the stage ends (`sizes.stage.ratio`): the
    // board's 0.62/0.74 left the photo's bottom edge showing as a seam.
    locations: [0, 0.2, 0.34, 0.6, 0.68],
  },
  light: {
    colors: [
      'rgba(10,11,15,0.55)',
      'rgba(10,11,15,0)',
      'rgba(247,247,249,0)',
      'rgba(247,247,249,0.94)',
      '#f7f7f9',
    ],
    locations: [0, 0.2, 0.3, 0.48, 0.56],
  },
};

// A player card's shading (spec §5.2): a light scrim behind the shirt number,
// clear through the face, deep under the name. The same in both themes,
// because the card is always a photo or the team's bands.
export const cardGradient: StageGradient = {
  colors: ['rgba(10,11,15,0.35)', 'rgba(10,11,15,0)', 'rgba(10,11,15,0)', 'rgba(10,11,15,0.92)'],
  locations: [0, 0.28, 0.4, 0.8],
};

// The no-photo stage (spec §2.6): the squad's marker bands under a wash of
// `veilInk` at this opacity, per theme. A floor, not the final value —
// `stageVeil` in lib/stageView.ts raises it until `onPhoto` text holds 3:1 on
// the lightest band (Real Madrid's white still has to carry the top bar).
export const stage = {
  veil: { dark: 0.42, light: 0.12 },
  // Where a filled photo is anchored: faces sit high in a portrait.
  focal: { top: '14%', left: '50%' },
  // A framed photo (original under 720 px wide): whole, at 3:4, in the
  // upper stage, over its own copy filled and darkened by `frameDim`.
  frame: { bottom: '30%', height: '84%', aspect: 3 / 4 },
  frameDim: 0.55,
  // How much the photo dims on a miss (spec §6).
  missDim: 0.1,
  // The loading shimmer: a diagonal band (spec §2.6).
  shimmer: { locations: [0.3, 0.48, 0.66], start: { x: 0, y: 0.35 }, end: { x: 1, y: 0.65 } },
  // The backing behind the shirt number and the slot chips. It moves with
  // the hero, wherever the content puts it:
  // - `rise` pt above the hero it is clear;
  // - at the hero's top edge it is the ground at `top[theme]`;
  // - it reaches solid ground by the slot chips.
  // Dark 0.55 keeps a white number at 3:1 or better even over a white photo;
  // light 0.6 keeps the near-black number at 3:1 or better even over a black one.
  heroBacking: { rise: 96, top: { dark: 0.55, light: 0.6 } },
} as const;

// The Difficulty hero (#178): the squad's bands under a wash of the palette's
// `background`. The floor is the wash behind the top bar; `heroTextAlpha` in
// lib/stageView.ts raises it, behind the name and the mono line, until
// `textSecondary` holds 4.5:1 and `textPrimary` 3:1 on every band.
export const ladderHero = {
  veilFloor: { dark: 0.4, light: 0.5 },
} as const;

// Home's number wall (#181). Archivo ExtraCondensed Black at `fontSize`, rows
// `rowHeight` apart (the canvas's 0.86 line height); `baseline` is where a
// number sits in its row, as CSS centres the font's 878 ascent and 210 descent
// in that line. `advance` is each digit's width per 1,000 em, from the font's
// hmtx table (theme/__tests__/numberWall.test.ts reads the TTF to pin it):
// Archivo's digits are proportional. `tracking` is between a number's digits
// and `gap` between numbers, the canvas's space plus its letter spacing. The
// drift moves `speed` pt a second, ambient and endless: the Motion rule's
// written exception (.claude/rules/design-tokens.md).
export const numberWall = {
  fontSize: 150,
  rowHeight: 129,
  baseline: 115,
  advance: {
    '0': 447,
    '1': 375,
    '2': 430,
    '3': 443,
    '4': 438,
    '5': 440,
    '6': 448,
    '7': 400,
    '8': 435,
    '9': 448,
  },
  tracking: 4,
  gap: 25,
  stroke: 1.5,
  speed: 50,
} as const;

export const typography = {
  screenTitle: { fontFamily: 'Inter-Bold', fontSize: 28 },
  sectionHead: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 20 },
  body: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 17 },
  // The "correct, unpicked" answer option after a wrong pick — same size as
  // `body`, bolder weight, so it visibly outweighs the rest without a new size.
  bodyEmphasis: { fontFamily: 'Inter-Bold', fontSize: 17 },
  secondary: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 15 },
  secondarySmall: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 13 },
  statMono: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 15 },
  statMonoSmall: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 13 },
  statMonoTiny: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 12 },
  // Team-row names — one step down from `body`.
  rowTitle: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 15 },
  // The lockup's lowercase 'escuadra', in Archivo SemiExpanded ExtraBold, as the 2.0 canvas sets it.
  wordmark: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 21,
    letterSpacing: -0.5,
  },
  // The feature graphic's large word (`app/store/feature-graphic.tsx`, used
  // with `sizes.wordmarkMarkHero`). -0.02em tracking at 28px.
  wordmarkHero: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 28,
    letterSpacing: -0.56,
  },
  // The launch intro (#182): the lockup's word at 46 / −1, the "A LA ESCUADRA"
  // tagline under it, and "TAP TO SKIP" at the foot.
  introWordmark: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 46,
    letterSpacing: -1,
  },
  introTagline: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
  },
  introSkip: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  // Filter-pill labels.
  filterLabel: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 12 },
  // The in-round banner's shirt number (Results).
  badgeNumber: { fontFamily: 'IBMPlexMono-Bold', fontSize: 18 },
  // Small descriptions and credit lines — one step down from `secondary`.
  descriptionSmall: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 12.5 },
  eyebrow: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  // Small eyebrow labels: Study's header, Licences, photo credits, answer-tile
  // and slot-chip tags, and Results' labels.
  captionEyebrow: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  // ---- Archivo, the 2.0 display face ----
  // Static cuts of the variable font, one file per width, since React Native
  // cannot set a variable font's width axis: see assets/fonts/archivo/. React
  // Native takes lineHeight in points, so the design's ratios are resolved
  // here: 0.9 of the size for card numbers, 1.05 for titles.
  //
  // The big numbers (shirt number, score, and the share picture's score) get
  // the face's natural line height instead, 1.088 of the size (hhea ascent 878
  // plus descent 210, per 1000 em). iOS clips glyphs to the line box, so a
  // tighter one cut off the tops of the digits on a device; the web renderer
  // does not, so `npm run shots` could not show it (#124). `marginVertical`
  // takes the extra height back out of the layout, so the number sits where
  // the design's tighter box put it: lineHeight + 2 * marginVertical is that
  // box. Spread the style whole to keep the pair together.
  //
  // No fontWeight on any of these: each cut is a single weight, so the family
  // name alone selects it. A fontWeight of 700 or more would make Android look
  // up a bold variant that a runtime-loaded font does not have, and fall back
  // to the system font.
  shirtNumber: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 152,
    lineHeight: 166,
    marginVertical: -23.5,
    letterSpacing: -3,
  },
  shirtNumberCompact: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 112,
    lineHeight: 122,
    marginVertical: -17.5,
    letterSpacing: -3,
  },
  // Results' score; its "/10" is set smaller beside it.
  scoreDisplay: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 150,
    lineHeight: 164,
    marginVertical: -22,
    letterSpacing: -4,
  },
  // The shirt number on a player card (Results, Study).
  cardNumber: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 44,
    lineHeight: 40,
  },
  // "Who wears 7?", "Position?", "Correct" / "Missed".
  prompt: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 26,
    lineHeight: 26,
    textTransform: 'uppercase' as const,
  },
  promptCompact: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 22,
    lineHeight: 22,
    textTransform: 'uppercase' as const,
  },
  // Results' tier title ("Level 2 cleared").
  titleDisplay: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 25,
    lineHeight: 26,
    textTransform: 'uppercase' as const,
  },
  // The stage's footer buttons: the main button and the auto-next bar.
  ctaLabel: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  // The position code on a position tile ("GK").
  tileCode: {
    fontFamily: 'Archivo-Black',
    fontSize: 22,
    lineHeight: 22,
  },
  // ---- 2.0 question screen: Inter faces chosen by family, no weight ----
  // A picked or revealed right answer on a tile.
  bodyStrong: { fontFamily: 'Inter-Bold', fontSize: 17 },
  // A slot chip's value; also Study's Hide names label.
  slotValue: { fontFamily: 'Inter-Bold', fontSize: 13 },
  // The team name in the question's top bar.
  topBarTeam: { fontFamily: 'Inter-Bold', fontSize: 14 },
  // The word under a position tile's code ("Keeper").
  tileSubLabel: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 10.5 },
  // ---- 2.0 Results ----
  // The "/10" beside the score.
  scoreTail: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 60,
    lineHeight: 66,
    marginVertical: -9,
  },
  // A player card's name and its line.
  cardName: { fontFamily: 'Inter-Bold', fontSize: 15 },
  cardLine: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 11.5 },
  // The shirt number under each round-strip segment.
  stripNumber: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 10.5 },
  // A name under a 10/10 circle.
  rosterName: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 11 },
  // ---- 2.0 share picture (spec §4.2), at `sizes.shareCard`'s 360 pt;
  // `ShareCard` scales them to the width it is drawn at ----
  shareWord: { fontFamily: 'Inter-ExtraBold', fontSize: 20, letterSpacing: -0.4 },
  shareEyebrow: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  shareScore: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 200,
    lineHeight: 218,
    marginVertical: -29,
    letterSpacing: -4,
  },
  shareScoreTail: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 78,
    lineHeight: 85,
    marginVertical: -11.5,
  },
  shareTitle: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 30,
    lineHeight: 30,
    textTransform: 'uppercase' as const,
  },
  shareSquare: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 26, lineHeight: 26 },
  shareQuestion: { fontFamily: 'Inter-Bold', fontSize: 16, lineHeight: 19 },
  shareLink: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 11 },
  // ---- 2.0 share sheet (spec §4.1) ----
  // Every bottom sheet's title, not only the share sheet's.
  sheetTitle: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 18,
    textTransform: 'uppercase' as const,
  },
  switchLabel: { fontFamily: 'Inter-Bold', fontSize: 14 },
  // The sheet's hint under the preview: `secondarySmall` with a line height,
  // so the sheet can reserve exactly two lines for it.
  sheetHint: {
    fontFamily: 'Inter-Medium',
    fontWeight: '500' as const,
    fontSize: 13,
    lineHeight: 17.5,
  },
  bubbleText: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 14.5,
    lineHeight: 19.5,
  },
  bubbleScore: { fontFamily: 'Inter-Bold', fontSize: 14.5 },
  bubbleLink: {
    fontFamily: 'Inter-Medium',
    fontWeight: '500' as const,
    fontSize: 14,
    textDecorationLine: 'underline' as const,
  },
  bubbleMeta: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 11 },
  // ---- 2.0 Study (spec §5): no fontWeight on a Bold or Archivo face ----
  // The position chip's code ("GK"), on a card and in a list row.
  positionChip: { fontFamily: 'IBMPlexMono-Bold', fontSize: 11 },
  // "Tap to reveal", on a card and in a list row.
  revealLabel: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 12 },
  // The line under a card's name when it is neutral, not a miss (`cardLine`).
  cardAffiliation: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 12 },
  // A list row's shirt number column, its line under the name, and the
  // number on its avatar when there is no photo.
  rowNumber: { fontFamily: 'IBMPlexMono-Bold', fontSize: 14 },
  rowAffiliation: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 12.5 },
  avatarNumber: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 20 },
  // The count after a filter pill's label ("GK 3").
  filterCount: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 11.5 },
  // ---- 2.0 Settings (#175) ----
  // Settings' and the team picker's screen title.
  displayTitle: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.4,
    textTransform: 'uppercase' as const,
  },
  // Settings' section labels and the picker's mono captions.
  monoCaption: {
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
  // ---- 2.0 team picker (#176) ----
  teamName: { fontFamily: 'Inter-Bold', fontSize: 16 },
  rowLevel: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  // The natural line height (1.088 of the size), as `shirtNumber` explains:
  // iOS clips this face's digits to a tighter line box.
  rowScore: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 24, lineHeight: 26 },
  rowScoreTail: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 15 },
  letterHeading: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 34, lineHeight: 37 },
  railLetter: { fontFamily: 'IBMPlexMono-Bold', fontSize: 10, lineHeight: 14 },
  tabLabel: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  pillLabel: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 14 },
  pillLabelActive: { fontFamily: 'Inter-Bold', fontSize: 14 },
  searchInput: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 16 },
  // ---- 2.0 Difficulty (#178) ----
  // The hero's team name.
  heroName: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -0.6,
    textTransform: 'uppercase' as const,
  },
  // A compact rung's level number, the focused card's (`cardNumber` is a
  // player card's) and a cleared rung's best score. Each takes the face's
  // natural line height and a margin back, as `shirtNumber` explains: the
  // design's boxes are 56, 96 and 32.
  rungNumber: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 54,
    lineHeight: 59,
    marginVertical: -1.5,
  },
  ladderCardNumber: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 96,
    lineHeight: 105,
    marginVertical: -4.5,
  },
  rungTitle: { fontFamily: 'Inter-Bold', fontSize: 16 },
  rungScore: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 30,
    lineHeight: 33,
    marginVertical: -0.5,
  },
  // The "/10" after a rung's score.
  rungScoreTail: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 17 },
  // The focused card's status line, title and description.
  ladderCardStatus: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  ladderCardTitle: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 22,
    lineHeight: 24,
    textTransform: 'uppercase' as const,
  },
  ladderCardDescription: {
    fontFamily: 'Inter-Medium',
    fontWeight: '500' as const,
    fontSize: 14,
    lineHeight: 20,
  },
  // The Play and Study pills' labels.
  ladderPlay: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  ladderStudy: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  // ---- 2.0 Home (#181) ----
  // "KNOW EVERY NUMBER." over the buttons.
  homeHeadline: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: -0.5,
    textTransform: 'uppercase' as const,
  },
  // Continue's "CONTINUE SPAIN" and the START TRAINING pill.
  homeButton: {
    fontFamily: 'Archivo-SemiExpandedExtraBold',
    fontSize: 17,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  // Continue's "LEVEL 2 · BEST 7/10" and its OUTDATED.
  homeMeta: {
    fontFamily: 'IBMPlexMono-SemiBold',
    fontWeight: '600' as const,
    fontSize: 11,
    textTransform: 'uppercase' as const,
  },
  // First run's "Star a team and it waits for you here."
  homeHint: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 14 },
} as const satisfies Record<string, { fontFamily: FontFamily; [property: string]: unknown }>;

// How far the OS text-size setting may scale a style (`maxFontSizeMultiplier`).
// The question screen's display type (the shirt number and the prompt) is
// already large, and at the largest accessibility sizes it would push the
// answers off the screen. It keeps growing with the setting, up to this cap;
// everything else on the screen scales freely and the screen scrolls.
// The picker's letter rail (`LetterRail`) sets each letter in a fixed 14 pt
// slot (`sizes.rail.letter`), which its touch mapping relies on, so its 10 pt
// letters may grow only a little before they outgrow the slot. The launch
// intro's text (`LaunchIntro`) sits under a fixed 200 dp mark on one screen
// that never scrolls, so it takes the display cap too.
export const fontScaleCap = { display: 1.2, rail: 1.1 } as const;

// 1.5px is the option-card default; 2px marks the emphasised "correct,
// unpicked" card in the incorrect-reveal state.
export const borderWidths = {
  hairline: 1,
  thick: 1.5,
  emphasis: 2,
} as const;

// Named opacity stops from the interaction-state spec — never an inline
// 0.4/0.65/etc in a component.
export const opacity = {
  disabled: 0.55, // ShareSheet's busy button
  faded: 0.4, // the photo-loading shimmer under Reduce Motion (SpotlightStage)
  settled: 0.7, // press feedback: Button, LadderRung, GlassCloseButton, QuestionFooter
  tileAfterCorrect: 0.5, // other tiles once the pick was right (spec §6)
  tileAfterMiss: 0.35, // other tiles after a miss
} as const;

// All within 300ms, per the motion rule (.claude/rules/design-tokens.md) —
// this is the mid-round budget. Two entries are not animations and sit
// outside it: `skeleton` is a shimmer's loop period, and `autoAdvance` is the
// pause after a correct answer before the round moves on by itself (spec
// §2.4; a tap skips it, and it never runs with a screen reader on). A goal
// chains its beats (the shot, then the corner's kick and ring) to about
// 640 ms after the tap; each stays within the budget, and the chain ends well
// inside `autoAdvance`. The round-over celebration is a carve-out from the
// rule; see `strikeTiming`/`resultsTimeline` below.
// `numberWall.speed`, the wall's drift, is not timed and is not in `durations` (#181).
// The launch intro (#182) is a carve-out too: see `launchIntro`.
export const durations = {
  press: 100,
  reveal: 180,
  pop: 100,
  popSettle: 120,
  transition: 150,
  collapse: 200,
  toggle: 160,
  skeleton: 900,
  // ---- 2.0 spotlight (spec §6) ----
  shake: 240, // a missed tile, three swings
  // The shot after a question is decided (lib/shot.ts, #129). Each shot flies
  // `shotFlight` × its own pace: a goal 213–291 ms, a miss 299.
  shotFlight: 260,
  shotSettle: 140, // the ball settling in the corner after a goal
  cornerShake: 240, // the corner's kick as a goal lands
  ring: 300, // the flash out from the ball as a goal lands
  pulse: 200, // the next slot's outline
  segmentFill: 120, // one results-strip segment
  segmentStagger: 40, // between results-strip segments
  sheet: 240, // a bottom sheet sliding up
  scrim: 200, // a bottom sheet's backdrop fading in
  partOut: 120, // the old part's tiles fading out
  partStagger: 20, // between tiles rising in for the next part
  tileStagger: 25, // between tiles rising in for the next question
  autoAdvance: 1200,
} as const;

// Dragging a bottom sheet down by its handle or title (`Sheet`). The drag takes
// over once the finger has moved `slop` pt down; let go past `closeFraction` of
// the sheet's height, or faster than `flingVelocity` (pt per ms), and the sheet
// closes; otherwise it settles back.
export const sheetDrag = { slop: 10, closeFraction: 0.25, flingVelocity: 0.8 } as const;

// Distances (pt) and scales of the question screen's motion (spec §6).
export const spotlightMotion = {
  pressScale: 0.97,
  popScale: 1.04,
  answerPopScale: 1.03,
  pulseScale: 1.06,
  streakPopScale: 1.15,
  streakOutScale: 0.8,
  // A 10/10's player circles on Results grow from this as they pop in.
  rosterInScale: 0.8,
  shake: 6,
  rise: 8,
  numberRise: 12,
  slide: 16,
  // The shot (lib/shot.ts, #129). Its size reads as height: it leaves the
  // tile at `startScale` × the corner's ball, is biggest at the top of its
  // arc, and a goal lands at 1. Each ball is drawn at `drawScale` × and scaled
  // down, so it stays sharp at its biggest. A miss keeps `clearance` dp
  // between its edge and the corner's box. Three fainter, smaller balls
  // follow it, each `delay` ms behind.
  shot: {
    startScale: 1.7,
    drawScale: 4,
    settleScale: 0.86,
    clearance: 28,
    trail: [
      { delay: 18, opacity: 0.4, scale: 0.94 },
      { delay: 36, opacity: 0.22, scale: 0.86 },
      { delay: 54, opacity: 0.1, scale: 0.78 },
    ],
  },
  // The corner's kick as a goal lands, from its top right, over
  // `durations.cornerShake`: pt right (and as much up) and scale, at a share
  // of the way through, back to rest after the last.
  cornerKick: [
    { at: 0.2, x: 3, scale: 1.14 },
    { at: 0.45, x: -2, scale: 0.96 },
    { at: 0.7, x: 1, scale: 1.03 },
  ],
  // The ring that flashes out from the ball as a goal lands, over
  // `durations.ring`: its scale (× the corner's arm) and its starting opacity.
  ring: { from: 0.4, to: 2.6, opacity: 0.75 },
} as const;

// When each beat starts after a verdict (ms, spec §6), so the screen reads as
// one gesture: tile, then slot, then ball, then streak.
export const spotlightCues = {
  slot: 60,
  ball: 80,
  streak: 120,
  missAnswer: 60,
  missDim: 100,
  missStreak: 120,
  missCta: 140,
} as const;

// ---- Celebration motion ---------------------------------------------------
// Budget for the results screen's round-over celebration (passed/excellent
// tiers) — and, mid-round, the ring a goal flashes as it lands in the corner
// (`rise`, #129). Plain bezier
// control-point tuples rather than `Easing.bezier(...)` instances, so
// this file stays free of the animation library per its own header comment;
// construct the curve at the call site (`Easing.bezier(...curve)`).
export const celebrationEasingCurves = {
  strike: [0.16, 0.72, 0.2, 1],
  recoil: [0.3, 0.6, 0.2, 1],
  rise: [0.2, 0.8, 0.2, 1],
} as const;

// Preview knobs for a longer, more exaggerated take on the celebration
// motion below, without hand-editing every value. `MOTION_TIME_SCALE` ships at
// 1 (the spec's timing) and stretches every duration and delay in
// `strikeTiming` and `resultsTimeline` (bar its strip fields, which are the
// mid-round `durations`) uniformly (so the whole cascade's rhythm holds, just
// slower); `MOTION_DISTANCE_SCALE` ships
// at 1.5 and is read directly by `EscuadraStrike` to exaggerate the ball's
// travel/overshoot, the frame's recoil and the trail's catch-up distance —
// set it to 1 to restore the base distances, nothing else needs to change.
export const MOTION_TIME_SCALE = 1;
export const MOTION_DISTANCE_SCALE = 1.5;

function t(ms: number): number {
  return Math.round(ms * MOTION_TIME_SCALE);
}

export interface StrikeTiming {
  frameDuration: number;
  frameStagger: number;
  recoilDuration: number;
  recoilDelay: number;
  ballDuration: number;
  ballDelay: number;
  flash: { duration: number; delay: number } | null;
  trail: { duration: number; delay: number; stagger: number } | null;
}

// The mark's crossbar/post/ball choreography, keyed by where it appears.
// `passed` is deliberately quieter than `excellent` — no flash ring, no
// trail — matching the design's "two-tone, quieter strike" for a level
// clear that isn't flawless.
export const strikeTiming: Record<'excellent' | 'passed', StrikeTiming> = {
  excellent: {
    frameDuration: t(180),
    frameStagger: t(40),
    recoilDuration: t(260),
    recoilDelay: t(330),
    ballDuration: t(640),
    ballDelay: t(60),
    flash: { duration: t(420), delay: t(300) },
    trail: { duration: t(300), delay: t(340), stagger: t(60) },
  },
  passed: {
    frameDuration: t(160),
    frameStagger: t(30),
    recoilDuration: t(220),
    recoilDelay: t(240),
    ballDuration: t(440),
    ballDelay: t(40),
    flash: null,
    trail: null,
  },
};

// The Results screen's timeline (spec §6), at MOTION_TIME_SCALE 1. It is the
// celebration carve-out, so it may run past the mid-round 300 ms budget.
// - The strip fills first, segment by segment.
// - Then comes the tier's beat. A fail: the title rises and the missed cards
//   slide in. A pass: the corner draws and the ball strikes (`strikeTiming`).
// - The actions rise last.
export const resultsTimeline = {
  segmentFill: durations.segmentFill,
  segmentStagger: durations.segmentStagger,
  failBeat: t(300),
  passBeat: t(480),
  rise: t(220),
  cardStagger: t(60),
  circleStagger: t(40),
  actionsAfter: t(220),
  actionsStagger: t(40),
  // After an a la escuadra round, the store-rating request (#57,
  // lib/storeReview.ts) waits this long. The wait starts each time Results
  // gains focus, so first as it opens, and again when the share or
  // photo-credits sheet closes. The celebration is over by 1,200 ms (the
  // strike's flash fading), and a beat more lets the score be seen before the
  // OS may show its dialog. A pause, not an animation.
  reviewPrompt: t(2000),
} as const;

// The launch intro, "the strike" (#182; the 2.0 canvas's OpenStrike artboard). ms
// from the first frame, read off the canvas's 4 s CSS loop at 40 ms per percent.
// Distances are in mark units (`MARK_VIEWBOX`), so the strike scales with the mark:
// the canvas draws the mark at 200 dp, 3.125 dp a unit. A written exception
// to the 300 ms rule (owner approved, 2026-10-22). One change from
// the canvas: the colour comes back at 1000–1200, not 1120–1360, so the end
// frame is whole as the tagline settles (spec, Timeline).
export const launchIntro = {
  // The ball pops in off-screen, bottom left, then flies to the corner: x
  // straight, y on `curve`, so it arcs; it shrinks from `scale` to 1.
  ballIn: { at: 280, duration: 20 },
  flight: {
    at: 300,
    duration: 400,
    curve: [0.15, 0.6, 0.35, 1],
    from: { x: -78, y: 151 },
    scale: 1.6,
  },
  // As the ball passes, each trail square shows. Indexed as `markGeometry.trail`:
  // [0] the near one, [1] the far one, which the ball passes first.
  trail: [
    { at: 600, duration: 40 },
    { at: 540, duration: 40 },
  ],
  // The goal: frame and ball turn `success`, a ring flashes out from the ball
  // (scale × the ball, starting opacity, `stroke` in units: the canvas's 3 px),
  // and the frame kicks by (+offset, −offset) mark units: right and up; `rise`
  // and `settle` in ms.
  flash: { at: 680, duration: 40 },
  ring: { at: 700, duration: 300, from: 0.6, to: 2.8, opacity: 0.9, stroke: 0.96 },
  kick: { at: 700, rise: 80, settle: 140, offset: 1.92 },
  // The end frame: the wordmark rises `rise` dp in, the tagline fades in, the
  // skip hint fades out, the colour comes back to `mark`.
  wordmark: { at: 800, duration: 260, rise: 16 },
  tagline: { at: 1000, duration: 200 },
  skipHint: { at: 1040, duration: 160 },
  colourBack: { at: 1000, duration: 200 },
  // Then the whole intro fades over `fadeOut`, the screen beneath showing
  // through. Under Reduce Motion the end frame holds until `end` and fades the
  // same way.
  end: 1200,
  fadeOut: 200,
} as const;

export const sizes = {
  // The shirt-number column of a Study list row.
  studyColumn: { no: 26 },
  // The least a `Button` is tall.
  controlHeight: 52,
  // The small corner radius of a team's bands and flags outside the picker
  // (Study's banner strip, the in-round banner, and the inline flags on an
  // answer tile, a chip, a player card and a Study row).
  teamMarkerRadius: 2,
  // The "banner" marker variant used mid-round (see TeamMarker's `variant`
  // prop): thinner and longer than the picker's marker, and always rendered
  // with vertical bands regardless of the squad's real flag orientation.
  teamMarkerBanner: { width: 100, height: 3 },
  // Nation flag images (assets/flags/*.png), one size per surface; the
  // picker's is `pickerMarker` below. `flagMarker` is the flag on a level-3
  // nationality answer tile. Source images are 160 px wide (160x107 for a 3:2
  // flag): see assets/flags/README.md for the headroom.
  flagMarker: { width: 22, height: 15 },
  flagInline: { width: 18, height: 12 },
  flagRow: { width: 20, height: 13 },
  // The top bar's lockup on Home (#181): a 28 pt mark beside the 21 pt word.
  wordmarkMark: 28,
  // The feature graphic's large mark (`app/store/feature-graphic.tsx`).
  wordmarkMarkHero: 86,
  // The launch intro's mark (#182).
  introMark: 200,
  // A 10/10's player circles.
  rosterAvatar: 54,
  // ---- 2.0 spotlight screens (spec §2, §3, §5, §8) ----
  // The question screen goes compact below this usable height (window minus
  // safe-area insets).
  compactBelow: 700,
  // The share of the window the photo stage fills, normal and compact.
  stage: { ratio: 0.68, ratioCompact: 0.72 },
  // The height of one segment: the question's Stories-style progress bar
  // (3) and Results' round strip (6).
  segment: { question: 3, results: 6 },
  // The escuadra corner beside a number: arm length, bar thickness and, on the
  // question, the ball's diameter.
  // The ladder's is the focused Difficulty card's, static.
  corner: {
    question: { arm: 24, bar: 6, ball: 10 },
    results: { arm: 40, bar: 10 },
    ladder: { arm: 20, bar: 5 },
  },
  // Answer tile heights per grid (spec §2.3).
  answerTile: {
    names4: { normal: 58, compact: 52 }, // 2 x 2
    names6: { normal: 54, compact: 48 }, // 2 x 3, level 3
    positions: { normal: 64, compact: 56 }, // 1 x 4
  },
  // The stage's main button.
  cta: { normal: 52, compact: 48 },
  // Round glass controls over the photo. Below the 44pt tap minimum on
  // purpose: give it hitSlop where it is used.
  glassButton: 36,
  // Study's grid card (its width comes from the column) and Results' missed
  // player card.
  playerCard: { studyHeight: 218, results: { width: 140, height: 184 } },
  // Study's list-view avatar.
  avatar: 46,
  // Study's top-bar controls: the Hide names pill's height and the view
  // toggle's diameter. Each takes hitSlop to reach `minTapTarget`.
  studyControl: 36,
  // The team's bands as a small strip beside Study's header eyebrow. The
  // question's `teamMarkerBanner` is 100 wide, too long for a line of text.
  studyBanner: { width: 28, height: 3 },
  // Study's position chip, on a card and in a list row.
  studyChip: 24,
  // The "Tap to reveal" pill's height: on a card, and in a list row.
  revealPill: { card: 24, row: 22 },
  // A Study list row, and the gap between a grid's cards.
  studyRow: 64,
  studyGridGap: 10,
  // Apple's minimum tap target; smaller drawn controls take hitSlop to reach it.
  minTapTarget: 44,
  // The question's top bar, and the glass pills in it (score).
  topBar: { height: 52, pill: 32, pillMinWidth: 52 },
  slotChipHeight: 30,
  // The share picture (spec §4.2), laid out at 360×640 pt; `ShareCard`
  // scales every metric here to the width it is drawn at.
  shareCard: {
    width: 360,
    height: 640,
    band: 10,
    pad: 28,
    mark: 26,
    cornerArm: 56,
    cornerBar: 14,
    columns: 5,
    squareRadius: 10,
    titleGap: 14, // score to title
    gridGap: 26, // title to the squares
  },
  // Every bottom sheet (`Sheet`): its grab handle and its close button.
  sheet: { handleWidth: 36, handleHeight: 5, close: 36 },
  // The language sheet's radio: the ring and its selected dot (#143).
  languageSheet: { radio: 20, radioDot: 10 },
  // The share sheet's own parts (spec §4.1).
  shareSheet: {
    switchHeight: 40,
    previewHeight: 304,
    previewWidth: 168,
    bubbleMaxWidth: 300,
    square: 12, // a result square in the text preview's bubble
    squareGap: 3,
  },
  // Settings (#175): its rows, the row glyphs, the Rate card's plate and button, the Appearance segments.
  settings: {
    row: 60,
    linkRow: 56,
    glyph: 20,
    chevron: 16,
    plate: 48,
    plateMark: 30,
    footerMark: 18,
    rateButton: 40,
    segment: 40,
  },
  // The 44 pt round back button (Settings, the picker).
  roundButton: 44,
  // The team picker (#176): a row's marker or flag, the row, a league pill, a
  // tab, the search field, and the letter rail (its touch column and the
  // height of one letter).
  pickerMarker: { width: 40, height: 27, radius: 5 },
  pickerRow: 60,
  // A row in the picker's Your squads card (#179): a little taller than the list's.
  pickerCardRow: 66,
  pickerPill: 40,
  pickerTab: 44,
  searchField: 52,
  rail: { width: 44, letter: 14 },
  // Difficulty's Play and Study pills (#178).
  ladderPill: 56,
  // A compact rung's level-number column, so every title starts on one line.
  rungNumberColumn: 34,
  // Home (#181): Continue's least height, its flag or marker and its play
  // circle; START TRAINING's height; a starred team's flag or marker in its
  // round button; how far the top fade reaches past the wall's top edge, and
  // the height of the skirt that fades the wall out above the buttons; and the
  // width of the fade at an edge of the starred row that has more to scroll to.
  home: {
    continue: 68,
    continueMarker: { width: 34, height: 23, radius: 4 },
    play: 46,
    start: 60,
    squadMarker: { width: 24, height: 16, radius: 3 },
    topFade: 54,
    skirt: 180,
    squadsFade: 32,
  },
} as const;

// The share picture's captured size in pixels: a 9:16 story (spec §4.2).
export const shareCapture = { width: 1080, height: 1920 } as const;

export const iconSize = {
  markLarge: 18, // AnswerTile's correct mark
  markSmall: 13, // AnswerTile's incorrect-picked mark
  searchGlyph: 20, // SearchField's magnifying-glass icon (spec #176 §3)
  clearGlyph: 10, // SearchField's clear (×) button, drawn from two crossed bars
  closeGlyph: 14, // the question's close ×, two crossed bars
  flameGlyph: 12, // the streak chip's flame
  shareGlyph: 18, // the Results screen's share button
  retryGlyph: 18, // the Results screen's retry icon beside Study
  back: 22, // Study's back chevron
  viewToggle: 17, // Study's list/grid toggle
  play: 14, // the triangle on Difficulty's Play pill
  ladderLock: 14, // a locked rung's padlock on Difficulty
  star: 20, // Difficulty's star toggle (#179)
  starCaption: 12, // the star beside the picker's "Your squads" caption
  outdated: 10, // the clock beside OUTDATED on a picker row or a rung (#180)
  outdatedCard: 11, // the same, on Difficulty's focused card
  outdatedNote: 13, // the same, before Difficulty's "Squad updated" line
  starHint: 16, // the star before Home's first-run hint (#181)
} as const;

// Base unit 4. Use spacing[n], not raw numbers, in component styles.
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const;

export const radii = {
  xs: 2, // progress segments
  md: 12,
  lg: 16,
  card: 18, // player cards
  settingsCard: 22, // Settings' cards
  squadsCard: 22, // the picker's Your squads card (#179)
  rung: 22, // Difficulty's compact rungs and Exam mode
  ladderCard: 26, // Difficulty's focused rung
  xl: 24,
  sheet: 28, // a bottom sheet's top corners
  bubbleTail: 6, // the text preview bubble's tail corner
  pill: 999,
} as const;

// Single-layer shadows only — keep each usage to one shadow* set (+ elevation for Android).
export const elevation = {
  e2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
