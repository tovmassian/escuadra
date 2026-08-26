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

// All under 300ms, per CLAUDE.md's motion rule.
export const durations = {
  press: 100,
  reveal: 180,
  pop: 100,
  popSettle: 120,
  transition: 150,
  collapse: 200,
  skeleton: 900,
} as const;

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
  studyColumn: { no: 26, position: 34, affiliation: 92 },
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
