// Escuadra — design tokens
// Plain exported objects. No styling library, no CSS-in-JS. Spacing is unitless (RN dp).

export const colors = {
  background: '#07090b',
  surface: '#111416',
  surfaceRaised: '#1c2022',
  border: '#33393d',
  textPrimary: '#f3f5f7',
  textSecondary: '#b4b8bb',
  textMuted: '#707579',
  accent: '#3e45a3',
  accentOn: '#f3f5f7', // text/icon colour to place on top of `accent`
  success: '#61bd67',
  successBg: 'rgba(97,189,103,0.14)',
  error: '#f05653',
  errorBg: 'rgba(240,86,83,0.10)',
  errorBorderDim: '#5c3230',
  // Dimmed error text for an "incorrect-picked" option — visually quieter
  // than `error` so the correct answer stays the loudest thing on screen.
  errorTextDim: '#a15a58',
  // Brand palette — the Escuadra mark's own colours, from the 2a design
  // direction. These are design tokens, not team-identity content: the mark
  // belongs to the app's design system, unlike a club's real colours.
  brandBright: '#5b63d6',
  brandDeep: '#2f3585',
  brandSoft: '#8f97ea',
  brandLift: '#6d76e6',
  // The icon plate's gradient ends. Distinct from the mark's own stops —
  // the plate sits behind the mark, so it runs deeper.
  brandPlateTop: '#4a52c4',
  brandPlateBottom: '#252a6b',
} as const;

// Gradient stops for the Escuadra mark and its icon plate. React Native
// cannot paint a gradient from a plain View, so these are declarative data
// consumed by <BrandGradient>, which wraps expo-linear-gradient.
//
// `start`/`end` are unit-square coordinates. The design source specified the
// plate as CSS `linear-gradient(140deg, ...)`; 140deg points down and to the
// right, which is {x:0,y:0} → {x:0.64,y:1} here.
export const gradients = {
  mark: {
    colors: [colors.brandBright, colors.brandDeep],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  markSoft: {
    colors: [colors.accent, colors.brandLift],
    start: { x: 0, y: 1 },
    end: { x: 1, y: 0 },
  },
  plate: {
    colors: [colors.brandPlateTop, colors.brandPlateBottom],
    start: { x: 0, y: 0 },
    end: { x: 0.64, y: 1 },
  },
} as const;

export type GradientName = keyof typeof gradients;

export const typography = {
  heroNumber: { fontFamily: 'IBMPlexMono-Bold', fontWeight: '700' as const, fontSize: 96 },
  // Results screen's giant score readout.
  scoreHero: { fontFamily: 'IBMPlexMono-Bold', fontWeight: '700' as const, fontSize: 56 },
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
  // Team-row names, chip labels — one step down from `body`.
  rowTitle: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, fontSize: 15 },
  chipLabel: { fontFamily: 'Inter-Bold', fontWeight: '700' as const, fontSize: 14 },
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
  // Shared by AnswerOption's "CORRECT ANSWER" caption, stat-chip labels,
  // difficulty-row status pills, and the Study screen's column headers.
  captionEyebrow: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600' as const,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;

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
  dimmed: 0.65, // incorrect-picked text/border
  faded: 0.4, // unrelated options during an incorrect reveal
  settled: 0.7, // other options once one is picked correct
  loadingBlank: 0.25, // option cards mid question-transition
  dotPast: 0.9, // progress dots for answered questions
  dotFuture: 0.35, // progress dots not yet reached
} as const;

// All under 300ms, per CLAUDE.md's motion rule — this is the mid-round
// budget. The round-over celebration and the home lockup are the one
// carve-out from that rule; see `strikeTiming`/`celebrationCascade` below.
export const durations = {
  press: 100,
  reveal: 180,
  pop: 100,
  popSettle: 120,
  transition: 150,
  collapse: 200,
  skeleton: 900,
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
// timing/distances. `MOTION_TIME_SCALE` stretches every duration and delay
// in `strikeTiming`/`celebrationCascade`/`homeCascade` uniformly (so the
// whole cascade's rhythm holds, just slower); `MOTION_DISTANCE_SCALE` is
// read directly by `EscuadraStrike` and `AnimatedScore` to exaggerate the
// ball's travel/overshoot, the frame's recoil, the trail's catch-up
// distance and the score's pop-in — set both back to 1 to restore exactly
// what shipped, nothing else needs to change.
export const MOTION_TIME_SCALE = 1.8;
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

// One rise-in duration shared by every title/subtitle/missed-card/button in
// the cascade below — only the per-element delay varies by tier, which is
// what actually shapes the cascade's rhythm.
export const celebrationRiseDuration = t(220);

export interface CelebrationCascade {
  score: { delay: number; duration: number; pop: boolean };
  title: number;
  subtitle: number;
  missedLabel?: number;
  missedBase?: number;
  missedStep?: number;
  actionsBase: number;
  actionsStep: number;
}

// Text/list/button cascade once the strike lands, keyed by results-screen
// tier. `score.pop` is true only for `excellent`: the flawless score has its
// own pop-in the other two tiers skip (their digits still count up, just
// without an entrance transform on the readout itself).
export const celebrationCascade: Record<'excellent' | 'passed' | 'fail', CelebrationCascade> = {
  excellent: {
    score: { delay: t(420), duration: t(260), pop: true },
    title: t(540),
    subtitle: t(620),
    actionsBase: t(660),
    actionsStep: t(40),
  },
  passed: {
    score: { delay: t(160), duration: t(380), pop: false },
    title: t(380),
    subtitle: t(440),
    missedLabel: t(460),
    missedBase: t(500),
    missedStep: t(40),
    actionsBase: t(580),
    actionsStep: t(40),
  },
  fail: {
    score: { delay: t(120), duration: t(420), pop: false },
    title: 0,
    subtitle: t(300),
    missedLabel: t(320),
    missedBase: t(360),
    missedStep: t(40),
    actionsBase: t(520),
    actionsStep: t(40),
  },
};

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

// Keyed by question-engine Level (1 | 2 | 3) — escalating hero/badge weight
// as difficulty rises, per the design's difficulty-ladder and hero-card specs.
export const heroCardSize = { 1: 220, 2: 130, 3: 108 } as const;
export const heroNumberSize = { 1: 104, 2: 64, 3: 52 } as const;
export const badgeSize = { 1: 40, 2: 48, 3: 56 } as const;
export const difficultyTitleSize = { 1: 15, 2: 17, 3: 19 } as const;
export const difficultyTitleWeight = { 1: '400', 2: '600', 3: '800' } as const;

export const sizes = {
  progressDot: 5,
  // Width of the difficulty ladder's badge column. Every badge (40-56px,
  // scaling with level) centres inside this fixed-width slot rather than
  // left-aligning, so the three differently-sized badges — and the connector
  // segments between them — share one vertical axis. Matches the widest
  // badge (level 3) so nothing overflows it.
  difficultyBadgeColumn: badgeSize[3],
  // Height of one connector segment between two ladder rungs. Drawn only in
  // the gap, never behind a badge — see `LadderConnector`.
  difficultyConnectorHeight: 26,
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
  // a club row in the picker keep identical metrics. Source images are
  // 70x46, so `flagMarker` at @3x is a near-exact 1:1 — there is no headroom
  // above these sizes.
  flagMarker: { width: 22, height: 15 },
  flagInline: { width: 18, height: 12 },
  flagRow: { width: 20, height: 13 },
  // Escuadra wordmark's mark, matching the 30px mark beside 23px type in the
  // design source's lockup.
  wordmarkMark: 30,
  // Home's centred lockup. The mark only reads its right angle at this size,
  // which is why the trail is shown here and nowhere else.
  wordmarkMarkHero: 86,
  // The a la escuadra celebration mark. Larger than Home's lockup because on
  // this screen the mark is the entire content.
  celebrationMark: 120,
  // Team-picker rows carry a progress sub-line, so they need a second line of
  // height.
  rowHeightTall: 64,
  missedNumberWidth: 24,
} as const;

export const iconSize = {
  markLarge: 18, // VerdictGlyph default size (AnswerOption's correct mark); also PartRail's upcoming/current bullet diameter
  markSmall: 13, // VerdictGlyph's smaller size, for AnswerOption's incorrect-picked mark
  chevron: 16, // TeamRow / DifficultyRow disclosure chevron
  chevronLarge: 18, // Home's continue-card chevron
  // The locked-badge padlock scales with its own badge (40/48/56, escalating
  // by level) rather than sitting at one fixed size regardless of the ring
  // around it — 48 * 0.46 ≈ 22, 56 * 0.46 ≈ 26.
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

// Single-layer shadows only — keep each usage to one shadow* set (+ elevation for Android).
export const elevation = {
  e1: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },
  e2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
