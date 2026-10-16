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
  /** The theme toggle's thumb and its sun/moon glyph. */
  thumbBg: string;
  thumbIcon: string;
  success: string;
  successBg: string;
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
}

// Roles that do not vary by theme. `accent` is dark enough to carry against
// both grounds, which is why the design source reuses it unchanged; the
// success wash is translucent and composites over whatever surface is behind
// it; the brand ramp is the mark's own identity — a design token, not
// team-identity content, unlike a club's real colours — and the plate's
// gradient ends run deeper than the mark's own stops because the plate sits
// behind it.
const sharedRoles = {
  accent: '#3e45a3',
  successBg: 'rgba(97,189,103,0.14)',
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
  thumbBg: '#2b2f38',
  thumbIcon: '#e7e9f5',
  success: '#61bd67',
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
  thumbBg: '#ffffff',
  thumbIcon: '#b9840f',
  success: '#2f8f3e',
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

export const typography = {
  screenTitle: { fontFamily: 'Inter-Bold', fontWeight: '700' as const, fontSize: 28 },
  sectionHead: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 20 },
  body: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 17 },
  // The "correct, unpicked" answer option after a wrong pick — same size as
  // `body`, bolder weight, so it visibly outweighs the rest without a new size.
  bodyEmphasis: { fontFamily: 'Inter-Bold', fontWeight: '800' as const, fontSize: 17 },
  secondary: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 15 },
  secondarySmall: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 13 },
  statMono: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 15 },
  statMonoSmall: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 13 },
  statMonoTiny: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 12 },
  // Team-row names — one step down from `body`.
  rowTitle: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 15 },
  // The wordmark's "escuadra" lockup. ExtraBold at -0.02em, per the 2a
  // design source. The only place Inter 800 is used.
  wordmark: {
    fontFamily: 'Inter-ExtraBold',
    fontWeight: '800' as const,
    fontSize: 23,
    letterSpacing: -0.46,
  },
  // The wordmark's stacked hero size (used with `sizes.wordmarkMarkHero`).
  // Same -0.02em tracking ratio as `wordmark`, scaled to the larger 28px
  // (`screenTitle`'s size) rather than reusing `wordmark`'s -0.46, which was
  // tuned for 23px and reads too tight at hero scale.
  wordmarkHero: {
    fontFamily: 'Inter-ExtraBold',
    fontWeight: '800' as const,
    fontSize: 28,
    letterSpacing: -0.56,
  },
  // Segmented-control / filter-pill labels.
  segmentLabel: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 13 },
  filterLabel: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 12 },
  // Difficulty-ladder badge number.
  badgeNumber: { fontFamily: 'IBMPlexMono-Bold', fontWeight: '700' as const, fontSize: 18 },
  // Difficulty-row / card descriptions — one step down from `secondary`.
  descriptionSmall: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 12.5 },
  // Study screen table cells.
  tableName: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 14 },
  tableCell: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 11 },
  tableHeader: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  eyebrow: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  // Shared by difficulty-row status pills and the Study screen's column headers.
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
  // here: 0.78 of the size for the shirt number, 0.8 for the score, 0.9 for
  // card numbers, 1.05 for titles.
  //
  // No fontWeight on any of these: each cut is a single weight, so the family
  // name alone selects it. A fontWeight of 700 or more would make Android look
  // up a bold variant that a runtime-loaded font does not have, and fall back
  // to the system font.
  shirtNumber: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 152,
    lineHeight: 119,
    letterSpacing: -3,
  },
  shirtNumberCompact: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 112,
    lineHeight: 87,
    letterSpacing: -3,
  },
  // Results' score; its "/10" is set smaller beside it.
  scoreDisplay: {
    fontFamily: 'Archivo-ExtraCondensedBlack',
    fontSize: 150,
    lineHeight: 120,
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
  // The stage's main button label.
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
  // A slot chip's value.
  slotValue: { fontFamily: 'Inter-Bold', fontSize: 13 },
  // The team name in the question's top bar.
  topBarTeam: { fontFamily: 'Inter-Bold', fontSize: 14 },
  // The word under a position tile's code ("Keeper").
  tileSubLabel: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 10.5 },
  // ---- 2.0 Results ----
  // The "/10" beside the score.
  scoreTail: { fontFamily: 'Archivo-ExtraCondensedBlack', fontSize: 60, lineHeight: 48 },
  // A player card's name and its line.
  cardName: { fontFamily: 'Inter-Bold', fontSize: 15 },
  cardLine: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, fontSize: 11.5 },
  // The shirt number under each round-strip segment.
  stripNumber: { fontFamily: 'IBMPlexMono-SemiBold', fontWeight: '600' as const, fontSize: 10.5 },
  // A name under a 10/10 circle.
  rosterName: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 11 },
} as const satisfies Record<string, { fontFamily: FontFamily; [property: string]: unknown }>;

// How far the OS text-size setting may scale a style (`maxFontSizeMultiplier`).
// The question screen's display type (the shirt number and the prompt) is
// already large, and at the largest accessibility sizes it would push the
// answers off the screen. It keeps growing with the setting, up to this cap;
// everything else on the screen scales freely and the screen scrolls.
export const fontScaleCap = { display: 1.2 } as const;

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
  disabled: 0.55, // locked difficulty row
  dimmed: 0.65, // VerdictGlyph's incorrect variant (no screen renders one today)
  faded: 0.4, // the photo-loading shimmer under Reduce Motion (SpotlightStage)
  settled: 0.7, // press feedback: Button, DifficultyRow, GlassCloseButton, QuestionFooter
  tileAfterCorrect: 0.5, // other tiles once the pick was right (spec §6)
  tileAfterMiss: 0.35, // other tiles after a miss
} as const;

// All within 300ms, per CLAUDE.md's motion rule — this is the mid-round
// budget. Two entries are not animations and sit outside it: `skeleton` is a
// shimmer's loop period, and `autoAdvance` is the pause after a correct
// answer before the round moves on by itself (spec §2.4; a tap skips it, and
// it never runs with a screen reader on). The round-over celebration and the
// home lockup are the one carve-out from the rule; see
// `strikeTiming`/`resultsTimeline` below.
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
  ballDrop: 220, // the ball into the corner on a correct answer
  ballBounce: 260, // the ball off the post on a miss
  pulse: 200, // the next slot's outline
  segmentFill: 120, // one results-strip segment
  segmentStagger: 40, // between results-strip segments
  sheet: 240, // the share sheet sliding up
  partOut: 120, // the old part's tiles fading out
  partStagger: 20, // between tiles rising in for the next part
  tileStagger: 25, // between tiles rising in for the next question
  autoAdvance: 1200,
} as const;

// Distances (pt) and scales of the question screen's motion (spec §6).
export const spotlightMotion = {
  pressScale: 0.97,
  popScale: 1.04,
  answerPopScale: 1.03,
  pulseScale: 1.06,
  streakPopScale: 1.15,
  streakOutScale: 0.8,
  ballStartScale: 0.6,
  // A 10/10's player circles on Results grow from this as they pop in.
  rosterInScale: 0.8,
  shake: 6,
  rise: 8,
  numberRise: 12,
  slide: 16,
  ballDrop: 10,
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
// tiers) and the once-per-launch home lockup only — never mid-round. Plain
// bezier control-point tuples rather than `Easing.bezier(...)` instances, so
// this file stays free of the animation library per its own header comment;
// construct the curve at the call site (`Easing.bezier(...curve)`).
export const celebrationEasingCurves = {
  strike: [0.16, 0.72, 0.2, 1],
  recoil: [0.3, 0.6, 0.2, 1],
  rise: [0.2, 0.8, 0.2, 1],
} as const;

// Preview knobs for a longer, more exaggerated take on the celebration
// motion below, without hand-editing every value. 1 = the shipped, reviewed
// timing/distances (spec §6). `MOTION_TIME_SCALE` stretches every duration and
// delay in `strikeTiming`, `celebrationRiseDuration`, `resultsTimeline` (bar
// its strip fields, which are the mid-round `durations`) and `homeCascade`
// uniformly (so the whole cascade's rhythm holds, just slower);
// `MOTION_DISTANCE_SCALE` is read directly by `EscuadraStrike` to exaggerate
// the ball's travel/overshoot, the frame's recoil and the trail's catch-up
// distance — set both back to 1 to restore exactly what shipped, nothing else
// needs to change.
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
// clear that isn't flawless. `home` sits between the two: full trail, no
// flash, since the launch lockup isn't a celebration.
export const strikeTiming: Record<'excellent' | 'passed' | 'home', StrikeTiming> = {
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
  home: {
    frameDuration: t(180),
    frameStagger: t(40),
    recoilDuration: t(240),
    recoilDelay: t(300),
    ballDuration: t(560),
    ballDelay: t(60),
    flash: null,
    trail: { duration: t(280), delay: t(320), stagger: t(60) },
  },
};

// Home's continue card and buttons rise in over this (app/index.tsx).
export const celebrationRiseDuration = t(220);

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
} as const;

// Home's lockup: the mark strike (`strikeTiming.home`) plus the wordmark's
// letter-by-letter rise and the continue-card/buttons beneath it. Runs once,
// on the home screen's initial mount only — see app/index.tsx.
export const homeCascade = {
  letterDuration: t(300),
  letterBase: t(400),
  letterStep: t(28),
  continueCardDelay: t(600),
  actionsBase: t(660),
  actionsStep: t(40),
};

// Difficulty-ladder badge diameters. Size follows the rung's state, not its
// level: the focused rung, expanded into a Play card, carries the large badge;
// every other rung the compact one.
export const ladderBadgeSize = { compact: 32, expanded: 48 } as const;

export const sizes = {
  // Width of the difficulty ladder's badge column. Both badge sizes centre
  // inside this fixed-width slot, so the badges — and the connector segments
  // between them — share one vertical axis. Matches the larger badge so
  // nothing overflows it.
  difficultyBadgeColumn: ladderBadgeSize.expanded,
  // Height of one connector segment between two ladder rungs. Drawn only in
  // the gap, never behind a badge — see `LadderConnector`.
  difficultyConnectorHeight: 16,
  // `affiliation` carries a flag image plus its gap on club squads
  // (sizes.flagRow.width + spacing.xs = 28 of its 120), so the text keeps the
  // same 92 it had before flags. The name column is flex, so it absorbs the
  // difference.
  studyColumn: { no: 26, position: 34, affiliation: 120 },
  // Home's "Start Training" is the one 56px control; every other button
  // (Continue, Results actions) is 52px.
  controlHeight: 52,
  controlHeightLarge: 56,
  // Plain colour dot for Home's "continue" card — a different, simpler
  // element than the team identity marker below.
  teamDot: 10,
  // The team identity marker — a banded rectangle, shared shape for both
  // clubs and nations. Needs more area than a small swatch to read the bands
  // at all, so it's larger than teamDot and rectangular rather than round.
  teamMarker: { width: 22, height: 15 },
  teamMarkerRadius: 2,
  // Japan's disc and Brazil's diamond, as a fraction of the marker's height.
  teamMarkerOverlayScale: 0.6,
  // The "banner" marker variant used mid-round (see TeamMarker's `variant`
  // prop): thinner and longer than the picker's marker, and always rendered
  // with vertical bands regardless of the squad's real flag orientation.
  teamMarkerBanner: { width: 100, height: 3 },
  // Nation flag images (assets/flags/*.png). Three sizes, one per surface.
  // `flagMarker` deliberately matches `teamMarker` above so a nation row and
  // a club row in the picker keep identical metrics. Source images are 160 px
  // wide (160x107 for a 3:2 flag), so `flagMarker` at @3x (66 px) leaves about
  // 2.4x headroom — see assets/flags/README.md.
  flagMarker: { width: 22, height: 15 },
  flagInline: { width: 18, height: 12 },
  flagRow: { width: 20, height: 13 },
  // Escuadra wordmark's mark, matching the 30px mark beside 23px type in the
  // design source's lockup.
  wordmarkMark: 30,
  // Home's centred lockup. The mark only reads its right angle at this size,
  // which is why the trail is shown here and nowhere else.
  wordmarkMarkHero: 86,
  // A 10/10's player circles.
  rosterAvatar: 54,
  // Team-picker rows carry a progress sub-line, so they need a second line of
  // height.
  rowHeightTall: 64,
  // The theme toggle. `inset` is the gap between track edge and thumb, so the
  // thumb's travel is trackWidth - thumb - inset * 2.
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
  // The results screen's expanded photo-credit list scrolls past this.
  photoCreditsMaxHeight: 200,
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
  corner: { question: { arm: 24, bar: 6, ball: 10 }, results: { arm: 40, bar: 10 } },
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
  // Apple's minimum tap target; smaller drawn controls take hitSlop to reach it.
  minTapTarget: 44,
  // The question's top bar, and the glass pills in it (score).
  topBar: { height: 52, pill: 32, pillMinWidth: 52 },
  slotChipHeight: 30,
} as const;

export const iconSize = {
  markLarge: 18, // VerdictGlyph default size; AnswerTile's correct mark
  markSmall: 13, // VerdictGlyph's smaller size; AnswerTile's incorrect-picked mark
  chevron: 16, // TeamRow disclosure chevron
  chevronLarge: 18, // Home's continue-card chevron
  searchGlyph: 15, // SearchField's magnifying-glass icon
  clearGlyph: 10, // SearchField's clear (×) button, drawn from two crossed bars
  closeGlyph: 14, // the question's close ×, two crossed bars
  flameGlyph: 12, // the streak chip's flame
  shareGlyph: 18, // the Results screen's share button
  retryGlyph: 18, // the Results screen's retry icon beside Study
  // The locked-badge padlock scales with its badge rather than sitting at one
  // fixed size — 32 * 0.46 ≈ 15.
  lockGlyphRatio: 0.46,
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
  xl: 24,
  sheet: 28, // the share sheet's top corners
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
